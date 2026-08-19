from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead | None" = None


class UserRead(ORM):
    id: str
    email: EmailStr
    full_name: str | None
    is_email_verified: bool


class OtpRequest(BaseModel): email: EmailStr
class OtpVerifyRequest(OtpRequest): otp: str = Field(pattern=r"^\d{6}$")
class PasswordResetRequest(BaseModel): reset_token: str; new_password: str = Field(min_length=12, max_length=128)
class GoogleCallbackRequest(BaseModel): code: str; state: str


class ConversationCreate(BaseModel): title: str = Field(default="New conversation", max_length=300)
class ConversationRead(ORM): id: str; title: str; selected_model_id: str | None; is_archived: bool; created_at: datetime
class MessageCreate(BaseModel): role: str = Field(pattern="^(user|assistant|system)$"); content: str = Field(min_length=1); model_id: str | None = None
class MessageRead(ORM): id: str; conversation_id: str; role: str; content: str; model_id: str | None; created_at: datetime
MemoryCategory = Literal['Personal', 'Education', 'Career', 'Preferences', 'Projects', 'Goals', 'Skills', 'Other']
class MemoryCreate(BaseModel):
    content: str = Field(min_length=1); category: MemoryCategory = 'Other'; source_conversation_id: str | None = None
    importance: float = Field(default=0.5, ge=0, le=1); confidence: float = Field(default=0.7, ge=0, le=1)
class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1); category: MemoryCategory | None = None; importance: float | None = Field(default=None, ge=0, le=1)
    confidence: float | None = Field(default=None, ge=0, le=1); is_archived: bool | None = None; is_pinned: bool | None = None
class MemoryRead(ORM): id: str; content: str; category: str; source_conversation_id: str | None; importance: float; confidence: float; is_archived: bool; is_pinned: bool; created_at: datetime
class MemorySearch(BaseModel): query: str = Field(min_length=1); limit: int = Field(default=8, ge=1, le=20)
class MemorySearchResult(MemoryRead): score: float
class ProviderCreate(BaseModel): provider: str = Field(pattern="^(openai|gemini|anthropic|deepseek|groq|openrouter|ollama)$"); api_key: str | None = Field(default=None, min_length=8); is_enabled: bool = False
class ProviderRead(ORM): id: str; provider: str; is_enabled: bool; created_at: datetime
class ModelRead(ORM): id: str; provider: str; model_key: str; display_name: str; is_local: bool; is_active: bool
class AnalyticsRead(BaseModel): conversations: int; messages: int; memories: int

