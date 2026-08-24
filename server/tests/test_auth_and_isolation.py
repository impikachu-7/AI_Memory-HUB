import os
os.environ['JWT_SECRET'] = 'test-secret-that-is-long-enough-for-testing'
os.environ['OTP_PEPPER'] = 'separate-test-otp-pepper'
os.environ['EMAIL_BACKEND'] = 'test'
os.environ['OTP_RESEND_COOLDOWN_SECONDS'] = '0'
os.environ['COOKIE_SECURE'] = 'false'
from datetime import UTC, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models import AuthOtp, User
from app.services.email import email_service
from app.services.oauth import validate_google_id_token
from app.core.config import get_settings
from app.api import routes as api_routes
import jwt

engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
def override_db():
    db = TestingSession()
    try: yield db
    finally: db.close()
app.dependency_overrides[get_db] = override_db
client = TestClient(app)

def headers(token): return {'Authorization': f'Bearer {token}'}
def signup(email):
    response = client.post('/api/v1/auth/register', json={'email': email, 'password': 'safe-password-123', 'full_name': 'Test'})
    assert response.status_code == 202
    otp = email_service.outbox[-1].otp
    verified = client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': otp})
    assert verified.status_code == 200
    return verified.json()['access_token']

def test_registration_hashes_password_and_email_verification_is_single_use():
    email = 'registration@example.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': 'safe-password-123'}).status_code == 202
    otp = email_service.outbox[-1].otp
    db = TestingSession(); user = db.scalar(select(User).where(User.email == email)); assert user.password_hash != 'safe-password-123'; assert not user.is_active; db.close()
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': otp}).status_code == 200
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': otp}).status_code == 400

def test_invalid_and_expired_otp_are_rejected():
    email = 'expired@example.com'; client.post('/api/v1/auth/register', json={'email': email, 'password': 'safe-password-123'})
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': '000000'}).status_code == 400
    db = TestingSession(); otp = db.scalar(select(AuthOtp).join(User).where(User.email == email)); otp.expires_at = datetime.now(UTC) - timedelta(seconds=1); db.commit(); db.close()
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': email_service.outbox[-1].otp}).status_code == 400

def test_otp_attempt_limit_and_resend_cooldown():
    email = 'attempts@example.com'; client.post('/api/v1/auth/register', json={'email': email, 'password': 'safe-password-123'})
    for _ in range(4): assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': '000000'}).status_code == 400
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': '000000'}).status_code == 400
    assert client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': '000000'}).status_code == 400
    cooldown_email = 'cooldown@example.com'; client.post('/api/v1/auth/register', json={'email': cooldown_email, 'password': 'safe-password-123'})
    settings = get_settings(); previous = settings.otp_resend_cooldown_seconds; settings.otp_resend_cooldown_seconds = 60
    try: assert client.post('/api/v1/auth/resend-verification', json={'email': cooldown_email}).status_code == 429
    finally: settings.otp_resend_cooldown_seconds = previous

def test_login_logout_and_protected_routes():
    token = signup('login@example.com')
    assert client.get('/api/v1/auth/me', headers=headers(token)).status_code == 200
    assert client.post('/api/v1/auth/logout', headers=headers(token)).status_code == 204
    assert client.get('/api/v1/auth/me', headers=headers(token)).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': 'login@example.com', 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': 'login@example.com', 'password': 'safe-password-123'}).status_code == 200

def test_login_rate_limit():
    email = 'limit@example.com'; signup(email)
    for _ in range(5): assert client.post('/api/v1/auth/login', json={'email': email, 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': email, 'password': 'wrong-password'}).status_code == 429

def test_password_reset_does_not_enumerate_and_invalidates_sessions():
    token = signup('reset@example.com')
    assert client.post('/api/v1/auth/forgot-password', json={'email': 'missing@example.com'}).status_code == 202
    assert client.post('/api/v1/auth/forgot-password', json={'email': 'reset@example.com'}).status_code == 202
    otp = email_service.outbox[-1].otp
    proof = client.post('/api/v1/auth/verify-reset', json={'email': 'reset@example.com', 'otp': otp}).json()['reset_token']
    assert client.post('/api/v1/auth/reset-password', json={'reset_token': proof, 'new_password': 'new-safe-password-123'}).status_code == 204
    assert client.get('/api/v1/auth/me', headers=headers(token)).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': 'reset@example.com', 'password': 'new-safe-password-123'}).status_code == 200

def test_user_cannot_read_another_users_conversation_memory_or_provider():
    alice, bob = signup('alice@example.com'), signup('bob@example.com')
    conversation = client.post('/api/v1/conversations', headers=headers(alice), json={'title': 'private'}).json()
    assert client.get(f"/api/v1/conversations/{conversation['id']}/messages", headers=headers(bob)).status_code == 404
    memory = client.post('/api/v1/memories', headers=headers(alice), json={'content': 'private memory'}).json()
    assert client.patch(f"/api/v1/memories/{memory['id']}", headers=headers(bob), json={'content': 'stolen'}).status_code == 404
    client.post('/api/v1/providers', headers=headers(alice), json={'provider': 'openai', 'api_key': 'abcdefghijk', 'is_enabled': True})
    assert client.get('/api/v1/providers', headers=headers(bob)).json() == []

def test_google_token_validation_rejects_unverifiable_tokens():
    try: validate_google_id_token('not-a-google-token')
    except Exception as exc: assert getattr(exc, 'status_code', 0) in {401, 503}
    else: raise AssertionError('Invalid token was accepted')

def oauth_state():
    settings = get_settings()
    return jwt.encode({'nonce': 'test-nonce', 'exp': datetime.now(UTC) + timedelta(minutes=10)}, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def test_google_callback_rejects_missing_state_cookie():
    state = oauth_state()
    client.cookies.clear()
    response = client.get('/api/v1/auth/google/callback', params={'code': 'test-code', 'state': state})
    assert response.status_code == 400

def test_google_callback_rejects_mismatched_state_cookie():
    state = oauth_state()
    client.cookies.set('ai_memory_hub_oauth_state', oauth_state())
    response = client.get('/api/v1/auth/google/callback', params={'code': 'test-code', 'state': state + 'mismatch'})
    assert response.status_code == 400

def test_google_callback_rejects_invalid_state():
    client.cookies.set('ai_memory_hub_oauth_state', 'invalid-state')
    response = client.get('/api/v1/auth/google/callback', params={'code': 'test-code', 'state': 'invalid-state'})
    assert response.status_code == 400

def test_google_callback_sets_cookie_session_and_rejects_state_replay(monkeypatch):
    state = oauth_state()
    user_subject = 'google-test-subject'
    monkeypatch.setattr(api_routes, 'exchange_google_code', lambda _: {'sub': user_subject, 'email': 'oauth-cookie@example.com', 'email_verified': True, 'name': 'OAuth Test'})
    client.cookies.set('ai_memory_hub_oauth_state', state)

    response = client.get('/api/v1/auth/google/callback', params={'code': 'test-code', 'state': state}, follow_redirects=False)

    assert response.status_code == 303
    assert 'access_token' not in response.headers['location']
    assert 'ai_memory_hub_session=' in response.headers['set-cookie']
    assert 'ai_memory_hub_oauth_state=' in response.headers['set-cookie']
    assert client.get('/api/v1/auth/me').status_code == 200

    client.cookies.clear()
    replay = client.get('/api/v1/auth/google/callback', params={'code': 'test-code', 'state': state}, follow_redirects=False)
    assert replay.status_code == 400

def test_profile_update_is_user_scoped():
    token = signup('profile-phase6@example.com')
    response = client.patch('/api/v1/users/me', headers=headers(token), json={'full_name': 'Updated Name'})
    assert response.status_code == 200
    assert response.json()['full_name'] == 'Updated Name'

def test_exports_are_user_scoped_and_exclude_provider_secrets():
    alice = signup('export-alice@example.com')
    bob = signup('export-bob@example.com')
    client.post('/api/v1/memories', headers=headers(alice), json={'content': 'Alice private export memory'})
    client.post('/api/v1/memories', headers=headers(bob), json={'content': 'Bob private export memory'})
    client.post('/api/v1/providers', headers=headers(alice), json={'provider': 'openai', 'api_key': 'alice-secret-key', 'is_enabled': True})

    memories = client.get('/api/v1/privacy/export/memories', headers=headers(alice))
    conversations = client.get('/api/v1/privacy/export/conversations', headers=headers(alice))
    combined = client.get('/api/v1/privacy/export', headers=headers(alice))
    assert memories.status_code == conversations.status_code == combined.status_code == 200
    assert 'Alice private export memory' in str(memories.json())
    assert 'Bob private export memory' not in str(memories.json())
    assert 'alice-secret-key' not in combined.text
    assert 'encrypted_api_key' not in combined.text
    assert 'password_hash' not in combined.text

