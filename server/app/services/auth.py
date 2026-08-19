from datetime import UTC, datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.security import create_access_token, generate_otp, otp_hash, verify_otp
from app.models import AuthOtp, AuthRateLimit, AuthSession, User
from app.services.email import email_service


def now() -> datetime: return datetime.now(UTC)


def is_expired(value: datetime) -> bool:
    """SQLite test databases may return naive timestamps; production Postgres preserves UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value < now()

def issue_otp(db: Session, user: User, purpose: str) -> None:
    settings = get_settings()
    latest = db.scalar(select(AuthOtp).where(AuthOtp.user_id == user.id, AuthOtp.purpose == purpose, AuthOtp.used_at.is_(None)).order_by(AuthOtp.sent_at.desc()))
    if latest and (now() - latest.sent_at).total_seconds() < settings.otp_resend_cooldown_seconds:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Please wait before requesting another code")
    db.execute(update(AuthOtp).where(AuthOtp.user_id == user.id, AuthOtp.purpose == purpose, AuthOtp.used_at.is_(None)).values(used_at=now()))
    code = generate_otp()
    db.add(AuthOtp(user_id=user.id, purpose=purpose, code_hash=otp_hash(code), expires_at=now() + timedelta(minutes=settings.otp_expiry_minutes), max_attempts=settings.otp_max_attempts, sent_at=now()))
    db.commit()
    email_service.send_otp(user.email, purpose, code)

def consume_otp(db: Session, user: User, purpose: str, code: str) -> None:
    otp = db.scalar(select(AuthOtp).where(AuthOtp.user_id == user.id, AuthOtp.purpose == purpose, AuthOtp.used_at.is_(None)).order_by(AuthOtp.sent_at.desc()))
    if not otp or is_expired(otp.expires_at): raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    if otp.attempts >= otp.max_attempts:
        otp.used_at = now(); db.commit(); raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many verification attempts")
    if not verify_otp(code, otp.code_hash):
        otp.attempts += 1
        if otp.attempts >= otp.max_attempts: otp.used_at = now()
        db.commit(); raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    otp.used_at = now(); db.commit()

def create_session(db: Session, user: User) -> str:
    session = AuthSession(user_id=user.id, expires_at=now() + timedelta(minutes=get_settings().access_token_minutes))
    db.add(session); db.commit(); db.refresh(session)
    return create_access_token(user.id, session.id)

def revoke_session(db: Session, session_id: str) -> None:
    session = db.get(AuthSession, session_id)
    if session and not session.revoked_at: session.revoked_at = now(); db.commit()

def revoke_all_sessions(db: Session, user_id: str) -> None:
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)).values(revoked_at=now())); db.commit()

def login_allowed(db: Session, subject: str) -> None:
    limit = db.scalar(select(AuthRateLimit).where(AuthRateLimit.subject == subject, AuthRateLimit.action == 'login'))
    if not limit: return
    started = limit.window_started_at.replace(tzinfo=UTC) if limit.window_started_at.tzinfo is None else limit.window_started_at
    if (now() - started).total_seconds() >= get_settings().login_window_seconds:
        db.delete(limit); db.commit(); return
    if limit.attempts >= get_settings().login_max_attempts: raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many login attempts')

def record_login_failure(db: Session, subject: str) -> None:
    limit = db.scalar(select(AuthRateLimit).where(AuthRateLimit.subject == subject, AuthRateLimit.action == 'login'))
    if not limit:
        db.add(AuthRateLimit(subject=subject, action='login', attempts=1, window_started_at=now()))
    else: limit.attempts += 1
    db.commit()

def clear_login_failures(db: Session, subject: str) -> None:
    limit = db.scalar(select(AuthRateLimit).where(AuthRateLimit.subject == subject, AuthRateLimit.action == 'login'))
    if limit: db.delete(limit); db.commit()

