from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import current_user
from app.models import Conversation, Memory, Message, ModelRegistry, ProviderConfiguration, User
from app.repositories.owned import OwnedRepository
from app.schemas import *
from app.services.credentials import encrypt_api_key

router = APIRouter()
conversations, messages, memories, providers = (OwnedRepository(x) for x in (Conversation, Message, Memory, ProviderConfiguration))

@router.post('/auth/register', response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())): raise HTTPException(409, 'Email already registered')
    user = User(email=body.email.lower(), password_hash=hash_password(body.password), full_name=body.full_name)
    db.add(user); db.commit(); db.refresh(user); return TokenResponse(access_token=create_access_token(user.id))

@router.post('/auth/login', response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash): raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid email or password')
    return TokenResponse(access_token=create_access_token(user.id))

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

