from datetime import UTC, datetime
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import decode_access_token
from app.database import get_db
from app.models import AuthSession, User

bearer = HTTPBearer(auto_error=False)
AUTH_COOKIE_NAME = "ai_memory_hub_session"


def current_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> dict:
    token = credentials.credentials if credentials else session_cookie
    if not token: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return decode_access_token(token)


def current_user(token: dict = Depends(current_token), db: Session = Depends(get_db)) -> User:
    session = db.get(AuthSession, token["sid"])
    user = db.get(User, token["sub"])
    expires_at = session.expires_at.replace(tzinfo=UTC) if session and session.expires_at.tzinfo is None else (session.expires_at if session else None)
    if not user or not session or session.user_id != user.id or session.revoked_at or expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not user or not user.is_active: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

