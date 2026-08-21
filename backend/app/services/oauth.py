"""Server-side Google OpenID Connect helpers; browser passwords never touch this service."""
from urllib.parse import urlencode
import httpx
from fastapi import HTTPException, status
from app.core.config import get_settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

def google_authorization_url(state: str) -> str:
    settings = get_settings()
    if not all([settings.google_oauth_client_id, settings.google_oauth_redirect_uri]):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")
    return GOOGLE_AUTH_URL + "?" + urlencode({"client_id": settings.google_oauth_client_id, "redirect_uri": settings.google_oauth_redirect_uri, "response_type": "code", "scope": "openid email profile", "state": state, "prompt": "select_account"})

def exchange_google_code(code: str) -> dict:
    settings = get_settings()
    if not all([settings.google_oauth_client_id, settings.google_oauth_client_secret, settings.google_oauth_redirect_uri]):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")
    response = httpx.post(GOOGLE_TOKEN_URL, data={"code": code, "client_id": settings.google_oauth_client_id, "client_secret": settings.google_oauth_client_secret, "redirect_uri": settings.google_oauth_redirect_uri, "grant_type": "authorization_code"}, timeout=10)
    if response.status_code != 200: raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google authorization failed")
    return validate_google_id_token(response.json().get("id_token", ""))

def validate_google_id_token(token: str) -> dict:
    settings = get_settings()
    if not settings.google_oauth_client_id: raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(token, Request(), settings.google_oauth_client_id)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google identity token") from exc
    if not claims.get("sub") or not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account email is not verified")
    return claims

def validate_firebase_id_token(token: str) -> dict:
    settings = get_settings()
    if not settings.firebase_project_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Firebase authentication is not configured")
    try:
        import firebase_admin
        from firebase_admin import auth
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
        claims = auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Firebase identity token") from exc
    if not claims.get("uid") or not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Firebase account email is not verified")
    return claims

