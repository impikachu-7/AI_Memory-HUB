from datetime import UTC, datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.security import decode_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import current_token, current_user
from app.models import Conversation, Memory, Message, ModelRegistry, OAuthIdentity, ProviderConfiguration, User
from app.repositories.owned import OwnedRepository
from app.schemas import *
from app.services.auth import clear_login_failures, consume_otp, create_session, issue_otp, login_allowed, record_login_failure, revoke_all_sessions, revoke_session
from app.services.credentials import encrypt_api_key
from app.services.oauth import exchange_google_code, google_authorization_url

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

@router.get('/conversations', response_model=list[ConversationRead])
def list_conversations(db: Session = Depends(get_db), user: User = Depends(current_user)): return conversations.list(db, user.id)
@router.post('/conversations', response_model=ConversationRead, status_code=201)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db), user: User = Depends(current_user)): return conversations.create(db, Conversation(user_id=user.id, title=body.title))

@router.get('/conversations/{conversation_id}/messages', response_model=list[MessageRead])
def list_messages(conversation_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    conversations.get(db, user.id, conversation_id); return list(db.scalars(select(Message).where(Message.user_id == user.id, Message.conversation_id == conversation_id)))
@router.post('/conversations/{conversation_id}/messages', response_model=MessageRead, status_code=201)
def create_message(conversation_id: str, body: MessageCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    conversations.get(db, user.id, conversation_id); return messages.create(db, Message(user_id=user.id, conversation_id=conversation_id, **body.model_dump()))

@router.get('/memories', response_model=list[MemoryRead])
def list_memories(db: Session = Depends(get_db), user: User = Depends(current_user)): return memories.list(db, user.id)
@router.post('/memories', response_model=MemoryRead, status_code=201)
def create_memory(body: MemoryCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if body.source_conversation_id: conversations.get(db, user.id, body.source_conversation_id)
    return memories.create(db, Memory(user_id=user.id, **body.model_dump()))
@router.patch('/memories/{memory_id}', response_model=MemoryRead)
def update_memory(memory_id: str, body: MemoryUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id)
    for field, value in body.model_dump(exclude_unset=True).items(): setattr(item, field, value)
    db.commit(); db.refresh(item); return item
@router.delete('/memories/{memory_id}', status_code=204)
def delete_memory(memory_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = memories.get(db, user.id, memory_id); db.delete(item); db.commit()

@router.get('/providers', response_model=list[ProviderRead])
def list_providers(db: Session = Depends(get_db), user: User = Depends(current_user)): return providers.list(db, user.id)
@router.post('/providers', response_model=ProviderRead, status_code=201)
def configure_provider(body: ProviderCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    existing = db.scalar(select(ProviderConfiguration).where(ProviderConfiguration.user_id == user.id, ProviderConfiguration.provider == body.provider))
    if existing: raise HTTPException(409, 'Provider already configured')
    return providers.create(db, ProviderConfiguration(user_id=user.id, provider=body.provider, encrypted_api_key=encrypt_api_key(body.api_key) if body.api_key else None, is_enabled=body.is_enabled))

@router.get('/models', response_model=list[ModelRead])
def list_models(db: Session = Depends(get_db), user: User = Depends(current_user)): return list(db.scalars(select(ModelRegistry).where(ModelRegistry.is_active.is_(True))))

@router.get('/analytics', response_model=AnalyticsRead)
def analytics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    count = lambda model: db.scalar(select(func.count()).select_from(model).where(model.user_id == user.id)) or 0
    return AnalyticsRead(conversations=count(Conversation), messages=count(Message), memories=count(Memory))

@router.get('/privacy/export')
def privacy_export(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {"user": UserRead.model_validate(user), "conversations": conversations.list(db, user.id), "memories": memories.list(db, user.id)}

