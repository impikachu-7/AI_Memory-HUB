from cryptography.fernet import Fernet
from app.core.config import get_settings


def _legacy_key() -> bytes:
    import base64, hashlib
    return base64.urlsafe_b64encode(hashlib.sha256(get_settings().jwt_secret.encode()).digest())


def _configured_key() -> bytes | None:
    value = get_settings().provider_encryption_key
    return value.encode() if value else None


def encrypt_api_key(value: str) -> str:
    key = _configured_key() or _legacy_key()
    return Fernet(key).encrypt(value.encode()).decode()


def decrypt_api_key(value: str) -> str:
    """Decrypt a stored API key immediately before use.

    SECURITY RULES — callers must honour all of these:
    - Never assign the return value to a variable that is logged, returned in a response, or included in an exception message.
    - Call this only inside a backend route handler, immediately before passing the key to the provider SDK.
    - Do not cache or store the decrypted value.
    """
    configured_key = _configured_key()
    if configured_key:
        try:
            return Fernet(configured_key).decrypt(value.encode()).decode()
        except Exception:
            return Fernet(_legacy_key()).decrypt(value.encode()).decode()
    return Fernet(_legacy_key()).decrypt(value.encode()).decode()

