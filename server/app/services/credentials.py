from cryptography.fernet import Fernet
from app.core.config import get_settings


def encrypt_api_key(value: str) -> str:
    # Deployment must supply a dedicated FERNET key; this derivation keeps plaintext out of the database in the foundation.
    import base64, hashlib
    key = base64.urlsafe_b64encode(hashlib.sha256(get_settings().jwt_secret.encode()).digest())
    return Fernet(key).encrypt(value.encode()).decode()

