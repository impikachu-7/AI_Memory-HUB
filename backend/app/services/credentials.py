from cryptography.fernet import Fernet
from app.core.config import get_settings


def encrypt_api_key(value: str) -> str:
    # Deployment must supply a dedicated FERNET key; this derivation keeps plaintext out of the database in the foundation.
    import base64, hashlib
    key = base64.urlsafe_b64encode(hashlib.sha256(get_settings().jwt_secret.encode()).digest())
    return Fernet(key).encrypt(value.encode()).decode()


def decrypt_api_key(value: str) -> str:
    """Decrypt a stored API key immediately before use.

    SECURITY RULES — callers must honour all of these:
    - Never assign the return value to a variable that is logged, returned in a response, or included in an exception message.
    - Call this only inside a backend route handler, immediately before passing the key to the provider SDK.
    - Do not cache or store the decrypted value.
    """
    import base64, hashlib
    key = base64.urlsafe_b64encode(hashlib.sha256(get_settings().jwt_secret.encode()).digest())
    return Fernet(key).decrypt(value.encode()).decode()

