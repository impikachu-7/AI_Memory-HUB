import os
os.environ['JWT_SECRET'] = 'test-secret-that-is-long-enough-for-testing'
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app

engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)
def override_db():
    db = TestingSession()
    try: yield db
    finally: db.close()
app.dependency_overrides[get_db] = override_db
client = TestClient(app)

def token(email: str) -> str:
    response = client.post('/api/v1/auth/register', json={'email': email, 'password': 'safe-password-123', 'full_name': 'Test'})
    assert response.status_code == 201
    return response.json()['access_token']
def headers(value: str): return {'Authorization': f'Bearer {value}'}

def test_user_cannot_read_another_users_conversation_or_messages():
    alice, bob = token('alice@example.com'), token('bob@example.com')
    created = client.post('/api/v1/conversations', headers=headers(alice), json={'title': 'private'}).json()
    conversation_id = created['id']
    assert client.get(f'/api/v1/conversations/{conversation_id}/messages', headers=headers(bob)).status_code == 404
    assert client.get('/api/v1/conversations', headers=headers(bob)).json() == []

def test_user_cannot_read_or_mutate_another_users_memory_or_provider():
    alice, bob = token('memory-alice@example.com'), token('memory-bob@example.com')
    memory = client.post('/api/v1/memories', headers=headers(alice), json={'content': 'private memory'}).json()
    assert client.patch(f"/api/v1/memories/{memory['id']}", headers=headers(bob), json={'content': 'stolen'}).status_code == 404
    client.post('/api/v1/providers', headers=headers(alice), json={'provider': 'openai', 'api_key': 'abcdefghijk', 'is_enabled': True})
    assert client.get('/api/v1/providers', headers=headers(bob)).json() == []

