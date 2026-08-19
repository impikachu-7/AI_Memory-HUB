from datetime import UTC, datetime, timedelta
import jwt
from fastapi import HTTPException, status
from pwdlib import PasswordHash
from app.core.config import get_settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    payload = {"sub": user_id, "exp": datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    try:
        return str(jwt.decode(token, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])["sub"])
    except (jwt.InvalidTokenError, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token") from exc

