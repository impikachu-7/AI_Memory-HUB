from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import jwt
import secrets
from fastapi import HTTPException, status
from pwdlib import PasswordHash
from app.core.config import get_settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user_id: str, session_id: str) -> str:
    settings = get_settings()
    payload = {"sub": user_id, "sid": session_id, "exp": datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[get_settings().jwt_algorithm])
        if not payload.get("sub") or not payload.get("sid"): raise KeyError("Missing required token claim")
        return payload
    except (jwt.InvalidTokenError, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token") from exc


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def otp_hash(otp: str) -> str:
    pepper = get_settings().otp_pepper or get_settings().jwt_secret
    return hmac.new(pepper.encode(), otp.encode(), hashlib.sha256).hexdigest()


def verify_otp(otp: str, digest: str) -> bool:
    return hmac.compare_digest(otp_hash(otp), digest)

