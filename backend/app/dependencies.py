from datetime import UTC, datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import decode_access_token
from app.database import get_db
from app.models import AuthSession, User

bearer = HTTPBearer(auto_error=False)


def current_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not credentials: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return decode_access_token(credentials.credentials)


def current_user(token: dict = Depends(current_token), db: Session = Depends(get_db)) -> User:
    session = db.get(AuthSession, token["sid"])
    user = db.get(User, token["sub"])
    expires_at = session.expires_at.replace(tzinfo=UTC) if session and session.expires_at.tzinfo is None else (session.expires_at if session else None)
    if not user or not session or session.user_id != user.id or session.revoked_at or expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not user or not user.is_active: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

