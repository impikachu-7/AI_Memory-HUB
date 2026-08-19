from datetime import UTC, datetime, timedelta
import json
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.security import decode_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import current_token, current_user
from app.models import Conversation, Memory, Message, ModelRegistry, OAuthIdentity, ProviderConfiguration, User
from app.repositories.owned import OwnedRepository
from app.schemas import *
from app.services.auth import clear_login_failures, consume_otp, create_session, issue_otp, login_allowed, record_login_failure, revoke_all_sessions, revoke_session
from app.services.credentials import decrypt_api_key, encrypt_api_key
from app.services.oauth import exchange_google_code, google_authorization_url
from app.services.memory_engine import extract_from_conversation, retrieve, vector_store
from app.services.llm import get_provider
from app.services.llm import context_builder
from app.services.data_export import export_conversations, export_memories, export_user_data

log = logging.getLogger(__name__)

router = APIRouter()
conversations, messages, memories, providers = (OwnedRepository(x) for x in (Conversation, Message, Memory, ProviderConfiguration))

@router.post('/auth/register', status_code=202)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        if existing.is_email_verified: raise HTTPException(409, 'Email already registered')
        issue_otp(db, existing, 'verify_email')
        return {"detail": "Verification code sent"}
    user = User(email=body.email.lower(), password_hash=hash_password(body.password), full_name=body.full_name, is_active=False, is_email_verified=False)
    db.add(user); db.commit(); db.refresh(user); issue_otp(db, user, 'verify_email')
    return {"detail": "Verification code sent"}

@router.post('/auth/verify-email', response_model=TokenResponse)
def verify_email(body: OtpVerifyRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user: raise HTTPException(400, 'Invalid or expired code')
    consume_otp(db, user, 'verify_email', body.otp)
    user.is_email_verified, user.is_active = True, True; db.commit(); db.refresh(user)
    return TokenResponse(access_token=create_session(db, user), user=user)

@router.post('/auth/resend-verification', status_code=202)
def resend_verification(body: OtpRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and not user.is_email_verified: issue_otp(db, user, 'verify_email')
    return {"detail": "If needed, a verification code has been sent"}

@router.post('/auth/login', response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower(); login_allowed(db, email)
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_email_verified or not user.is_active or not verify_password(body.password, user.password_hash):
        record_login_failure(db, email); raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid email or password')
    clear_login_failures(db, email)
    return TokenResponse(access_token=create_session(db, user), user=user)

@router.post('/auth/logout', status_code=204)
def logout(token: dict = Depends(current_token), db: Session = Depends(get_db)):
    revoke_session(db, token['sid'])

@router.post('/auth/forgot-password', status_code=202)
def forgot_password(body: OtpRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and user.is_email_verified: issue_otp(db, user, 'reset_password')
    return {"detail": "If an account exists, a reset code has been sent"}

@router.post('/auth/verify-reset')
def verify_reset(body: OtpVerifyRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user: raise HTTPException(400, 'Invalid or expired code')
    consume_otp(db, user, 'reset_password', body.otp)
    from app.core.config import get_settings
    import jwt
    settings = get_settings()
    return {'reset_token': jwt.encode({'sub': user.id, 'purpose': 'password_reset', 'version': user.auth_version, 'exp': datetime.now(UTC) + timedelta(minutes=10)}, settings.jwt_secret, algorithm=settings.jwt_algorithm)}

@router.post('/auth/reset-password', status_code=204)
def reset_password(body: PasswordResetRequest, db: Session = Depends(get_db)):
    from app.core.config import get_settings
    import jwt
    try:
        claims = jwt.decode(body.reset_token, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])
        if claims.get('purpose') != 'password_reset': raise jwt.InvalidTokenError()
    except jwt.InvalidTokenError as exc: raise HTTPException(400, 'Invalid or expired reset token') from exc
    user = db.get(User, claims['sub'])
    if not user or claims.get('version') != user.auth_version: raise HTTPException(400, 'Invalid or expired reset token')
    user.password_hash = hash_password(body.new_password); user.auth_version += 1; db.commit(); revoke_all_sessions(db, user.id)

@router.get('/auth/me', response_model=UserRead)
def auth_me(user: User = Depends(current_user)): return user

@router.get('/auth/google/start')
def google_start():
    # Signed state is validated on callback; it contains no account credentials.
    from app.core.config import get_settings
    from jwt import encode
    state = encode({'nonce': secrets.token_urlsafe(24), 'exp': datetime.now(UTC) + timedelta(minutes=10)}, get_settings().jwt_secret, algorithm=get_settings().jwt_algorithm)
    return {'authorization_url': google_authorization_url(state)}

@router.post('/auth/google/callback', response_model=TokenResponse)
def google_callback(body: GoogleCallbackRequest, db: Session = Depends(get_db)):
    from app.core.config import get_settings
    import jwt
    try: jwt.decode(body.state, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])
    except jwt.InvalidTokenError as exc: raise HTTPException(400, 'Invalid OAuth state') from exc
    claims = exchange_google_code(body.code)
    identity = db.scalar(select(OAuthIdentity).where(OAuthIdentity.provider == 'google', OAuthIdentity.subject == claims['sub']))
    if identity: user = db.get(User, identity.user_id)
    else:
        user = db.scalar(select(User).where(User.email == claims['email'].lower()))
        if not user:
            user = User(email=claims['email'].lower(), full_name=claims.get('name'), password_hash=hash_password(secrets.token_urlsafe(32)), is_active=True, is_email_verified=True)
            db.add(user); db.flush()
        user.is_active, user.is_email_verified = True, True
        db.add(OAuthIdentity(user_id=user.id, provider='google', subject=claims['sub'])); db.commit(); db.refresh(user)
    return TokenResponse(access_token=create_session(db, user), user=user)

@router.get('/users/me', response_model=UserRead)
def me(user: User = Depends(current_user)): return user

@router.patch('/users/me', response_model=UserRead)
def update_me(body: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    user.full_name = body.full_name
    db.commit(); db.refresh(user)
    return user

@router.get('/conversations', response_model=list[ConversationRead])
def list_conversations(db: Session = Depends(get_db), user: User = Depends(current_user)): return conversations.list(db, user.id)
@router.post('/conversations', response_model=ConversationRead, status_code=201)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db), user: User = Depends(current_user)): return conversations.create(db, Conversation(user_id=user.id, title=body.title))
@router.patch('/conversations/{conversation_id}', response_model=ConversationRead)
def update_conversation(conversation_id: str, body: ConversationUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = conversations.get(db, user.id, conversation_id)
    changes = body.model_dump(exclude_unset=True)
    if 'selected_model_id' in changes and changes['selected_model_id'] is not None:
        model = db.scalar(select(ModelRegistry).where(ModelRegistry.id == changes['selected_model_id'], ModelRegistry.is_active.is_(True)))
        if model is None:
            raise HTTPException(400, 'Model not available')
        provider_config = db.scalar(select(ProviderConfiguration).where(ProviderConfiguration.user_id == user.id, ProviderConfiguration.provider == model.provider))
        if provider_config is None:
            raise HTTPException(400, 'Provider not configured')
        if not provider_config.is_enabled:
            raise HTTPException(400, 'Provider not enabled')
        if model.provider != 'ollama' and not provider_config.encrypted_api_key:
            raise HTTPException(400, 'Provider credentials unavailable')
    for field, value in changes.items(): setattr(item, field, value)
    db.commit(); db.refresh(item); return item

@router.get('/conversations/{conversation_id}/messages', response_model=list[MessageRead])
def list_messages(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    conversations.get(db, user.id, conversation_id); return list(db.scalars(select(Message).where(Message.user_id == user.id, Message.conversation_id == conversation_id)))
@router.post('/conversations/{conversation_id}/messages', response_model=MessageRead, status_code=201)
def create_message(conversation_id: str, body: MessageCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    conversations.get(db, user.id, conversation_id); return messages.create(db, Message(user_id=user.id, conversation_id=conversation_id, **body.model_dump()))

@router.post('/conversations/{conversation_id}/extract-memories', response_model=list[MemoryRead])
def extract_memories(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    conversations.get(db, user.id, conversation_id)
    return extract_from_conversation(db, user.id, conversation_id)

# ---------------------------------------------------------------------------
# Phase 5 — LLM generation endpoint
# ---------------------------------------------------------------------------

@router.post('/conversations/{conversation_id}/generate')
def generate(
    conversation_id: str,
    body: GenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Stream an LLM response into the conversation.

    Pipeline:
    1. Verify conversation ownership.
    2. Verify the user has an *enabled* ProviderConfiguration for body.provider.
    3. Verify body.model_key exists in ModelRegistry for body.provider.
    4. Save the user message.
    5. Build context (relevant memories + recent history).
    6. Decrypt key immediately before calling the provider.
    7. Stream response chunks as newline-delimited JSON.
    8. On completion: save assistant message, run memory extraction.
    9. On error: emit safe JSON error chunk — never expose the key.
    """
    # 1. Conversation ownership
    conversations.get(db, user.id, conversation_id)

    # 2. Provider config — must exist and be enabled
    config = db.scalar(
        select(ProviderConfiguration).where(
            ProviderConfiguration.user_id == user.id,
            ProviderConfiguration.provider == body.provider,
        )
    )
    if config is None:
        raise HTTPException(400, 'Provider not configured')
    if not config.is_enabled:
        raise HTTPException(400, 'Provider not enabled')

    # 3. Model must exist in registry for this provider
    model_entry = db.scalar(
        select(ModelRegistry).where(
            ModelRegistry.provider == body.provider,
            ModelRegistry.model_key == body.model_key,
            ModelRegistry.is_active.is_(True),
        )
    )
    if model_entry is None:
        raise HTTPException(400, 'Model not available')

    # 4. Save user message
    user_msg = messages.create(
        db,
        Message(
            user_id=user.id,
            conversation_id=conversation_id,
            role='user',
            content=body.message,
            provider=body.provider,
            model_id=body.model_key,
        ),
    )

    # 5. Build context (captures db state before streaming begins)
    llm_messages = context_builder.build(db, user.id, conversation_id, body.message)

    # 6. Capture encrypted key — decryption happens inside the generator
    encrypted_key = config.encrypted_api_key

    provider_name = body.provider
    model_key = body.model_key
    user_id = user.id

    def event_stream():
        accumulated = []
        try:
            provider = get_provider(provider_name)
            # Decrypt immediately before use; result is local to this generator
            api_key = decrypt_api_key(encrypted_key) if encrypted_key else None
            for chunk in provider.stream(llm_messages, api_key, model_key):
                accumulated.append(chunk)
                yield json.dumps({'type': 'chunk', 'text': chunk}) + '\n'
        except HTTPException as exc:
            safe_details = {
                401: f'{provider_name} credentials were rejected.',
                429: f'{provider_name} is rate limited.',
                503: f'{provider_name} is temporarily unavailable.',
            }
            detail = safe_details.get(exc.status_code, 'The selected model could not complete this request.')
            yield json.dumps({
                'type': 'error',
                'detail': detail,
                'provider': provider_name,
                'model_key': model_key,
                'recoverable': True,
                'partial': bool(accumulated),
            }) + '\n'
            return
        except Exception:
            log.exception("Unexpected error during streaming for provider=%s", provider_name)
            yield json.dumps({
                'type': 'error',
                'detail': 'The selected model could not complete this request.',
                'provider': provider_name,
                'model_key': model_key,
                'recoverable': True,
                'partial': bool(accumulated),
            }) + '\n'
            return

        # Save completed assistant message and run extraction on success
        final_text = ''.join(accumulated)
        if final_text:
            try:
                asst_msg = Message(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    role='assistant',
                    content=final_text,
                    provider=provider_name,
                    model_id=model_key,
                )
                db.add(asst_msg)
                db.commit()
                db.refresh(asst_msg)
                # Run existing memory extraction heuristic
                extract_from_conversation(db, user_id, conversation_id)
                yield json.dumps({'type': 'done', 'message_id': asst_msg.id}) + '\n'
            except Exception:
                log.exception("Failed to persist assistant message")
                yield json.dumps({'type': 'error', 'detail': 'Failed to save response'}) + '\n'

    return StreamingResponse(event_stream(), media_type='application/x-ndjson')


# ---------------------------------------------------------------------------
# Provider management
# ---------------------------------------------------------------------------

@router.get('/memories', response_model=list[MemoryRead])
def list_memories(db: Session = Depends(get_db), user: User = Depends(current_user)): return memories.list(db, user.id)
@router.post('/memories', response_model=MemoryRead, status_code=201)
def create_memory(body: MemoryCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if body.source_conversation_id: conversations.get(db, user.id, body.source_conversation_id)
    memory = memories.create(db, Memory(user_id=user.id, **body.model_dump())); vector_store.upsert(memory); return memory
@router.patch('/memories/{memory_id}', response_model=MemoryRead)
def update_memory(memory_id: str, body: MemoryUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id)
    for field, value in body.model_dump(exclude_unset=True).items(): setattr(item, field, value)
    db.commit(); db.refresh(item)
    if item.is_archived: vector_store.delete(item.id)
    else: vector_store.upsert(item)
    return item
@router.delete('/memories/{memory_id}', status_code=204)
def delete_memory(memory_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id); vector_store.delete(item.id); db.delete(item); db.commit()

@router.post('/memories/{memory_id}/archive', response_model=MemoryRead)
def archive_memory(memory_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id); item.is_archived = True; db.commit(); db.refresh(item); vector_store.delete(item.id); return item

@router.post('/memories/{memory_id}/restore', response_model=MemoryRead)
def restore_memory(memory_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id); item.is_archived = False; db.commit(); db.refresh(item); vector_store.upsert(item); return item

@router.post('/memories/{memory_id}/pin', response_model=MemoryRead)
def pin_memory(memory_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id); item.is_pinned = True; db.commit(); db.refresh(item); vector_store.upsert(item); return item

@router.get('/memories/search', response_model=list[MemorySearchResult])
def search_memories(query: str, limit: int = 8, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [MemorySearchResult(**MemoryRead.model_validate(memory).model_dump(), score=score) for memory, score in retrieve(db, user.id, query, limit)]

@router.get('/providers', response_model=list[ProviderRead])
def list_providers(db: Session = Depends(get_db), user: User = Depends(current_user)): return providers.list(db, user.id)

@router.post('/providers', response_model=ProviderRead, status_code=201)
def configure_provider(body: ProviderCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    existing = db.scalar(select(ProviderConfiguration).where(ProviderConfiguration.user_id == user.id, ProviderConfiguration.provider == body.provider))
    if existing: raise HTTPException(409, 'Provider already configured')
    return providers.create(db, ProviderConfiguration(user_id=user.id, provider=body.provider, encrypted_api_key=encrypt_api_key(body.api_key) if body.api_key else None, is_enabled=body.is_enabled))

@router.put('/providers/{provider_name}', response_model=ProviderRead)
def update_provider(provider_name: str, body: ProviderUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Update API key and/or enabled state for an existing provider configuration."""
    config = db.scalar(
        select(ProviderConfiguration).where(
            ProviderConfiguration.user_id == user.id,
            ProviderConfiguration.provider == provider_name,
        )
    )
    if config is None:
        raise HTTPException(404, 'Provider not configured')
    if body.api_key is not None:
        config.encrypted_api_key = encrypt_api_key(body.api_key)
    if body.is_enabled is not None:
        config.is_enabled = body.is_enabled
    db.commit()
    db.refresh(config)
    return config

@router.delete('/providers/{provider_name}', status_code=204)
def delete_provider(provider_name: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Remove a provider configuration for the authenticated user."""
    config = db.scalar(
        select(ProviderConfiguration).where(
            ProviderConfiguration.user_id == user.id,
            ProviderConfiguration.provider == provider_name,
        )
    )
    if config is None:
        raise HTTPException(404, 'Provider not configured')
    db.delete(config)
    db.commit()

@router.get('/providers/{provider_name}/models', response_model=list[ProviderModelRead])
def list_provider_models(provider_name: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """List live models available from the provider.

    Requires the authenticated user to have a ProviderConfiguration row for this
    provider (enabled or not).  Decrypts the key immediately before the call;
    never returns it.
    """
    config = db.scalar(
        select(ProviderConfiguration).where(
            ProviderConfiguration.user_id == user.id,
            ProviderConfiguration.provider == provider_name,
        )
    )
    if config is None:
        raise HTTPException(404, 'Provider not configured')
    provider = get_provider(provider_name)
    # Decrypt key only for the duration of this call; never stored or returned
    api_key = decrypt_api_key(config.encrypted_api_key) if config.encrypted_api_key else None
    raw_models = provider.list_models(api_key)
    return [ProviderModelRead(**m) for m in raw_models]

# ---------------------------------------------------------------------------
# GET /models — filtered by the user's enabled ProviderConfiguration rows
# Security: backend is the authoritative gate; frontend filter is UX only.
# ---------------------------------------------------------------------------

@router.get('/models', response_model=list[ModelRead])
def list_models(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Return ModelRegistry rows only for providers the user has enabled."""
    enabled_providers = db.scalars(
        select(ProviderConfiguration.provider).where(
            ProviderConfiguration.user_id == user.id,
            ProviderConfiguration.is_enabled.is_(True),
        )
    ).all()
    if not enabled_providers:
        return []
    return list(
        db.scalars(
            select(ModelRegistry).where(
                ModelRegistry.is_active.is_(True),
                ModelRegistry.provider.in_(enabled_providers),
            )
        )
    )

@router.get('/analytics', response_model=AnalyticsRead)
def analytics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    count = lambda model: db.scalar(select(func.count()).select_from(model).where(model.user_id == user.id)) or 0
    return AnalyticsRead(conversations=count(Conversation), messages=count(Message), memories=count(Memory))

@router.get('/privacy/export')
def privacy_export(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return export_user_data(db, user)

@router.get('/privacy/export/memories')
def privacy_export_memories(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return export_memories(db, user.id)

@router.get('/privacy/export/conversations')
def privacy_export_conversations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return export_conversations(db, user.id)
