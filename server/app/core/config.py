from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://memoryhub:memoryhub@localhost:5432/memoryhub"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    otp_pepper: str | None = None
    otp_expiry_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    login_max_attempts: int = 5
    login_window_seconds: int = 300
    cookie_secure: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None
    frontend_origins: str = "http://localhost:5173"
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None
    email_backend: str = "console"
    email_from: str = "no-reply@example.com"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    chroma_path: str = "./data/chroma"
    memory_retrieval_limit: int = 8
    ollama_base_url: str = "http://localhost:11434"
    chat_history_limit: int = 20
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()

