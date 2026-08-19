"""Phase 5 — LLM generation tests.

All provider calls are mocked.  No live API calls are made.
Tests cover:
  - Provider factory
  - Credential encrypt/decrypt roundtrip and key protection
  - /generate endpoint pipeline (auth, ownership, provider/model validation,
    message persistence, memory extraction, error handling)
  - Cross-user isolation for provider configs and conversations
  - Provider management endpoints (PUT/DELETE /providers/{name})
  - GET /models filtered by user's enabled providers
  - GET /providers/{name}/models
  - Context builder (memory scoping, history capping)
  - Streaming error handling
"""
import os
os.environ['JWT_SECRET'] = 'test-secret-that-is-long-enough-for-testing'
os.environ['OTP_PEPPER'] = 'separate-test-otp-pepper'
os.environ['EMAIL_BACKEND'] = 'test'
os.environ['OTP_RESEND_COOLDOWN_SECONDS'] = '0'
os.environ['CHAT_HISTORY_LIMIT'] = '3'

import json
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Message, ModelRegistry, ProviderConfiguration
from app.services.credentials import decrypt_api_key, encrypt_api_key
from app.services.email import email_service
from app.services.llm.registry import get_provider
from app.services.memory_engine import vector_store

# ---------------------------------------------------------------------------
# Test database and client setup
# ---------------------------------------------------------------------------

from app.core.config import get_settings
get_settings.cache_clear()

from test_auth_and_isolation import (
    Base,
    TestingSession,
    client,
    engine,
    headers,
    signup,
)

# Patch ChromaDB with the same fake client used by existing memory tests
class FakeCollection:
    def __init__(self): self.items = {}
    def upsert(self, ids, documents, embeddings, metadatas):
        for item_id, document, vector, metadata in zip(ids, documents, embeddings, metadatas):
            self.items[item_id] = (document, vector, metadata)
    def delete(self, ids):
        for item_id in ids: self.items.pop(item_id, None)
    def query(self, query_embeddings, n_results, where):
        user_id = where['$and'][0]['user_id']['$eq']
        archive = where['$and'][1]['archived']['$eq']
        query = query_embeddings[0]
        found = [
            (item_id, sum(a * b for a, b in zip(query, vector)))
            for item_id, (_, vector, metadata) in self.items.items()
            if metadata['user_id'] == user_id and metadata['archived'] == archive
        ]
        found.sort(key=lambda pair: pair[1], reverse=True)
        found = found[:n_results]
        return {'ids': [[item_id for item_id, _ in found]], 'distances': [[1 - score for _, score in found]]}


class FakeClient:
    def __init__(self): self.store = FakeCollection()
    def get_or_create_collection(self, *_args, **_kwargs): return self.store


vector_store._client = FakeClient()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def headers(token): return {'Authorization': f'Bearer {token}'}


def signup(email, password='safe-password-123'):
    r = client.post('/api/v1/auth/register', json={'email': email, 'password': password, 'full_name': 'Test'})
    assert r.status_code == 202, r.text
    otp = email_service.outbox[-1].otp
    r2 = client.post('/api/v1/auth/verify-email', json={'email': email, 'otp': otp})
    assert r2.status_code == 200, r2.text
    return r2.json()['access_token']


def get_user_id(email: str) -> str:
    """Look up user ID via the authenticated /auth/me endpoint."""
    # We need the token; re-login is cheaper and avoids DB session sharing issues
    r = client.post('/api/v1/auth/login', json={'email': email, 'password': 'safe-password-123'})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    token = r.json()['access_token']
    me = client.get('/api/v1/auth/me', headers=headers(token))
    assert me.status_code == 200, me.text
    return me.json()['id']


def seed_model(provider='openai', model_key='gpt-4o', display_name='GPT-4o', is_local=False):
    db = TestingSession()
    existing = db.scalar(select(ModelRegistry).where(ModelRegistry.model_key == model_key))
    if existing:
        db.close()
        return existing.id
    entry = ModelRegistry(
        id=str(uuid.uuid4()), provider=provider, model_key=model_key,
        display_name=display_name, is_local=is_local, is_active=True,
    )
    db.add(entry); db.commit()
    model_id = entry.id
    db.close()
    return model_id


def configure_provider(token, provider='openai', api_key='sk-test-key-abcdefgh', is_enabled=True):
    return client.post(
        '/api/v1/providers',
        headers=headers(token),
        json={'provider': provider, 'api_key': api_key, 'is_enabled': is_enabled},
    )


def make_conversation(token, title='Test chat'):
    r = client.post('/api/v1/conversations', headers=headers(token), json={'title': title})
    assert r.status_code == 201, r.text
    return r.json()['id']


# ---------------------------------------------------------------------------
# A. Credential round-trip and protection
# ---------------------------------------------------------------------------

def test_encrypt_decrypt_roundtrip():
    original = 'sk-super-secret-key-123456'
    assert decrypt_api_key(encrypt_api_key(original)) == original


def test_encrypted_ciphertext_does_not_contain_plaintext():
    original = 'sk-super-secret-key-123456'
    cipher = encrypt_api_key(original)
    assert original not in cipher


def test_decrypt_wrong_value_raises():
    import pytest
    with pytest.raises(Exception):
        decrypt_api_key('not-valid-fernet-ciphertext')


# ---------------------------------------------------------------------------
# B. Provider factory
# ---------------------------------------------------------------------------

def test_get_provider_returns_correct_classes():
    from app.services.llm.openai_provider import OpenAIProvider
    from app.services.llm.gemini_provider import GeminiProvider
    from app.services.llm.anthropic_provider import AnthropicProvider
    from app.services.llm.deepseek_provider import DeepSeekProvider
    from app.services.llm.groq_provider import GroqProvider
    from app.services.llm.openrouter_provider import OpenRouterProvider
    from app.services.llm.ollama_provider import OllamaProvider

    assert isinstance(get_provider('openai'), OpenAIProvider)
    assert isinstance(get_provider('gemini'), GeminiProvider)
    assert isinstance(get_provider('anthropic'), AnthropicProvider)
    assert isinstance(get_provider('deepseek'), DeepSeekProvider)
    assert isinstance(get_provider('groq'), GroqProvider)
    assert isinstance(get_provider('openrouter'), OpenRouterProvider)
    assert isinstance(get_provider('ollama'), OllamaProvider)


def test_get_provider_raises_on_unknown_name():
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc_info:
        get_provider('nonexistent-provider')
    assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# C. /generate endpoint — authentication
# ---------------------------------------------------------------------------

def test_generate_requires_authentication():
    conv_id = str(uuid.uuid4())
    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        json={'message': 'Hello', 'provider': 'openai', 'model_key': 'gpt-4o'},
    )
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# D. /generate — conversation ownership
# ---------------------------------------------------------------------------

def test_generate_rejects_wrong_owner_conversation():
    alice = signup('gen-alice@example.com')
    bob = signup('gen-bob@example.com')
    conv_id = make_conversation(alice)
    seed_model()
    configure_provider(bob)
    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        headers=headers(bob),
        json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# E. /generate — provider validation
# ---------------------------------------------------------------------------

def test_generate_rejects_unconfigured_provider():
    token = signup('gen-noprov@example.com')
    conv_id = make_conversation(token)
    seed_model()
    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        headers=headers(token),
        json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
    )
    assert r.status_code == 400
    assert 'not configured' in r.json()['detail'].lower()


def test_generate_rejects_disabled_provider():
    token = signup('gen-disabled@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token, is_enabled=False)
    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        headers=headers(token),
        json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
    )
    assert r.status_code == 400
    assert 'not enabled' in r.json()['detail'].lower()


def test_generate_rejects_model_not_in_registry():
    token = signup('gen-nomodel@example.com')
    conv_id = make_conversation(token)
    configure_provider(token)
    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        headers=headers(token),
        json={'message': 'Hi', 'provider': 'openai', 'model_key': 'nonexistent-model-xyz'},
    )
    assert r.status_code == 400
    assert 'not available' in r.json()['detail'].lower()


# ---------------------------------------------------------------------------
# F. /generate — successful streaming and message persistence
# ---------------------------------------------------------------------------

def test_generate_saves_user_and_assistant_messages():
    token = signup('gen-success@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token)

    mock_provider = MagicMock()
    mock_provider.stream.return_value = iter(['Hello ', 'world!'])

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        r = client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={'message': 'Hi there', 'provider': 'openai', 'model_key': 'gpt-4o'},
        )

    assert r.status_code == 200
    lines = [line for line in r.text.strip().split('\n') if line]
    events = [json.loads(line) for line in lines]
    chunk_types = [e['type'] for e in events]
    assert 'chunk' in chunk_types
    assert 'done' in chunk_types

    # Verify DB
    db = TestingSession()
    msgs = db.scalars(
        select(Message).where(Message.conversation_id == conv_id)
    ).all()
    db.close()
    roles = {m.role for m in msgs}
    assert 'user' in roles
    assert 'assistant' in roles
    contents = {m.content for m in msgs}
    assert 'Hi there' in contents
    assert 'Hello world!' in contents


def test_generate_assistant_message_stores_model_id():
    token = signup('gen-modelid@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token)

    mock_provider = MagicMock()
    mock_provider.stream.return_value = iter(['Response text'])

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={'message': 'Test', 'provider': 'openai', 'model_key': 'gpt-4o'},
        )

    db = TestingSession()
    asst = db.scalar(
        select(Message).where(Message.conversation_id == conv_id, Message.role == 'assistant')
    )
    db.close()
    assert asst is not None
    assert asst.model_id == 'gpt-4o'


# ---------------------------------------------------------------------------
# G. /generate — error handling (no key leakage)
# ---------------------------------------------------------------------------

def test_generate_provider_error_returns_safe_message_no_key_leak():
    from fastapi import HTTPException as FHE
    token = signup('gen-err@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token, api_key='sk-real-secret-key-xyz')

    def bad_stream(*_args, **_kwargs):
        raise FHE(401, 'Provider authentication failed')
        yield  # make it a generator

    mock_provider = MagicMock()
    mock_provider.stream.side_effect = bad_stream

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        r = client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
        )

    assert r.status_code == 200  # StreamingResponse always 200
    body = r.text
    # The raw key must never appear in the response body
    assert 'sk-real-secret-key-xyz' not in body
    events = [json.loads(line) for line in body.strip().split('\n') if line]
    error_events = [e for e in events if e['type'] == 'error']
    assert error_events
    assert 'sk-real-secret-key-xyz' not in error_events[0]['detail']


def test_generate_rate_limit_returns_safe_error():
    from fastapi import HTTPException as FHE
    token = signup('gen-ratelimit@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token)

    def rate_limited_stream(*_args, **_kwargs):
        raise FHE(429, 'Provider rate limit reached')
        yield

    mock_provider = MagicMock()
    mock_provider.stream.side_effect = rate_limited_stream

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        r = client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
        )

    events = [json.loads(line) for line in r.text.strip().split('\n') if line]
    assert any(e['type'] == 'error' for e in events)
    assert any('rate limit' in e.get('detail', '').lower() for e in events if e['type'] == 'error')


# ---------------------------------------------------------------------------
# H. Ollama unavailable
# ---------------------------------------------------------------------------

def test_generate_ollama_unavailable_returns_503_in_stream():
    from fastapi import HTTPException as FHE
    token = signup('gen-ollama5@example.com')
    conv_id = make_conversation(token)
    seed_model(provider='ollama', model_key='llama3:8b', display_name='Llama 3 8B', is_local=True)
    # Ollama does not need a real key; pass a dummy placeholder
    configure_provider(token, provider='ollama', api_key='ollama-no-key-needed', is_enabled=True)

    def unavailable_stream(*_args, **_kwargs):
        raise FHE(503, 'Ollama is not available')
        yield

    mock_provider = MagicMock()
    mock_provider.stream.side_effect = unavailable_stream

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        r = client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={'message': 'Hi', 'provider': 'ollama', 'model_key': 'llama3:8b'},
        )

    events = [json.loads(line) for line in r.text.strip().split('\n') if line]
    assert any(e['type'] == 'error' for e in events)
    assert any('ollama' in e.get('detail', '').lower() for e in events if e['type'] == 'error')


# ---------------------------------------------------------------------------
# I. Cross-user isolation — provider
# ---------------------------------------------------------------------------

def test_cross_user_cannot_use_another_users_provider():
    alice = signup('iso-alice@example.com')
    bob = signup('iso-bob@example.com')
    seed_model()
    configure_provider(alice)  # Alice configures OpenAI
    conv_id = make_conversation(bob)

    r = client.post(
        f'/api/v1/conversations/{conv_id}/generate',
        headers=headers(bob),
        json={'message': 'Hi', 'provider': 'openai', 'model_key': 'gpt-4o'},
    )
    # Bob has no provider config → 400
    assert r.status_code == 400
    assert 'not configured' in r.json()['detail'].lower()


def test_cross_user_cannot_access_another_users_provider_models():
    alice = signup('modiso-alice@example.com')
    bob = signup('modiso-bob@example.com')
    configure_provider(alice)  # Alice configures openai

    r = client.get('/api/v1/providers/openai/models', headers=headers(bob))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# J. GET /models — filtered by user's enabled providers (server-side)
# ---------------------------------------------------------------------------

def test_models_endpoint_filtered_by_enabled_providers():
    alice = signup('modelfilter-alice@example.com')
    seed_model(provider='openai', model_key='gpt-4o-filter-test', display_name='GPT-4o')
    seed_model(provider='anthropic', model_key='claude-sonnet-filter-test', display_name='Claude Sonnet')

    # Alice has no providers yet
    r = client.get('/api/v1/models', headers=headers(alice))
    assert r.status_code == 200
    assert r.json() == []

    # Configure openai only
    configure_provider(alice, provider='openai', is_enabled=True)
    r = client.get('/api/v1/models', headers=headers(alice))
    data = r.json()
    providers_returned = {m['provider'] for m in data}
    assert 'openai' in providers_returned
    assert 'anthropic' not in providers_returned


def test_models_endpoint_excludes_disabled_provider():
    user = signup('modelfilter-disabled@example.com')
    seed_model(provider='groq', model_key='llama-filter-test', display_name='Llama')
    configure_provider(user, provider='groq', is_enabled=False)

    r = client.get('/api/v1/models', headers=headers(user))
    assert r.status_code == 200
    data = r.json()
    # Disabled provider must not appear
    assert all(m['provider'] != 'groq' for m in data)


# ---------------------------------------------------------------------------
# K. Provider management — PUT /providers/{name}
# ---------------------------------------------------------------------------

def test_update_provider_re_encrypts_key():
    token = signup('provupd5@example.com')
    configure_provider(token, api_key='sk-original-key-12345')

    r = client.put(
        '/api/v1/providers/openai',
        headers=headers(token),
        json={'api_key': 'sk-new-key-abcdefgh'},
    )
    assert r.status_code == 200
    # Response must never contain plaintext key
    assert 'sk-new-key-abcdefgh' not in r.text
    assert 'sk-original-key-12345' not in r.text

    user_id = get_user_id('provupd5@example.com')
    db = TestingSession()
    config = db.scalar(
        select(ProviderConfiguration).where(
            ProviderConfiguration.user_id == user_id,
            ProviderConfiguration.provider == 'openai',
        )
    )
    # The stored value is encrypted (not the plaintext)
    assert config.encrypted_api_key != 'sk-new-key-abcdefgh'
    # But decrypts correctly
    assert decrypt_api_key(config.encrypted_api_key) == 'sk-new-key-abcdefgh'
    db.close()


def test_update_provider_rejects_wrong_owner():
    alice = signup('updiso-alice@example.com')
    bob = signup('updiso-bob@example.com')
    configure_provider(alice)

    r = client.put(
        '/api/v1/providers/openai',
        headers=headers(bob),
        json={'is_enabled': False},
    )
    assert r.status_code == 404


def test_update_provider_can_toggle_enabled():
    token = signup('provtoggle@example.com')
    configure_provider(token, is_enabled=True)

    r = client.put(
        '/api/v1/providers/openai',
        headers=headers(token),
        json={'is_enabled': False},
    )
    assert r.status_code == 200
    assert r.json()['is_enabled'] is False


# ---------------------------------------------------------------------------
# L. Provider management — DELETE /providers/{name}
# ---------------------------------------------------------------------------

def test_delete_provider_removes_config():
    token = signup('provdel@example.com')
    configure_provider(token)

    r = client.delete('/api/v1/providers/openai', headers=headers(token))
    assert r.status_code == 204

    # No longer listed
    r2 = client.get('/api/v1/providers', headers=headers(token))
    assert r2.json() == []


def test_delete_provider_rejects_wrong_owner():
    alice = signup('deliso-alice@example.com')
    bob = signup('deliso-bob@example.com')
    configure_provider(alice)

    r = client.delete('/api/v1/providers/openai', headers=headers(bob))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# M. GET /providers/{name}/models — live model list
# ---------------------------------------------------------------------------

def test_list_provider_models_calls_provider_and_returns_results():
    token = signup('provmodels@example.com')
    configure_provider(token)

    mock_provider = MagicMock()
    mock_provider.list_models.return_value = [
        {'model_key': 'gpt-4o', 'display_name': 'GPT-4o', 'is_local': False},
        {'model_key': 'gpt-4o-mini', 'display_name': 'GPT-4o mini', 'is_local': False},
    ]

    with patch('app.api.routes.get_provider', return_value=mock_provider):
        r = client.get('/api/v1/providers/openai/models', headers=headers(token))

    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]['model_key'] == 'gpt-4o'
    # Verify the API key was never returned
    assert all('api_key' not in item for item in data)
    assert all('key' not in str(item).lower() or 'model_key' in item for item in data)


def test_list_provider_models_requires_own_config():
    token = signup('provmodels-noconf@example.com')
    r = client.get('/api/v1/providers/openai/models', headers=headers(token))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# N. Context builder — memory scoping and history capping
# ---------------------------------------------------------------------------

def test_context_builder_caps_history():
    """Context builder must respect chat_history_limit (set to 3 in env above)."""
    from app.services.llm import context_builder

    token = signup('ctx-hist5@example.com')
    conv_id = make_conversation(token)

    # Post 5 messages (exceeds limit of 3)
    for i in range(5):
        client.post(
            f'/api/v1/conversations/{conv_id}/messages',
            headers=headers(token),
            json={'role': 'user', 'content': f'Message {i}'},
        )

    user_id = get_user_id('ctx-hist5@example.com')
    db = TestingSession()
    built = context_builder.build(db, user_id, conv_id, 'Current question')
    db.close()

    # Count non-system messages (exclude the current user message appended at end)
    history_msgs = [m for m in built if m['role'] in ('user', 'assistant') and m['content'] != 'Current question']
    assert len(history_msgs) <= 3


def test_context_builder_includes_system_message():
    from app.services.llm import context_builder

    token = signup('ctx-sys5@example.com')
    conv_id = make_conversation(token)

    user_id = get_user_id('ctx-sys5@example.com')
    db = TestingSession()
    built = context_builder.build(db, user_id, conv_id, 'Hello')
    db.close()

    assert built[0]['role'] == 'system'
    assert built[-1]['role'] == 'user'
    assert built[-1]['content'] == 'Hello'


def test_context_builder_does_not_include_other_users_memories():
    from app.services.llm import context_builder

    alice_token = signup('ctx-alice5@example.com')
    bob_token = signup('ctx-bob5@example.com')

    # Alice adds a distinctive memory
    client.post(
        '/api/v1/memories',
        headers=headers(alice_token),
        json={'content': 'ALICE_PRIVATE_SECRET_DATA I work at SecretCorp.', 'category': 'Career'},
    )

    conv_id = make_conversation(bob_token)
    user_id = get_user_id('ctx-bob5@example.com')
    db = TestingSession()
    built = context_builder.build(db, user_id, conv_id, 'SecretCorp career')
    db.close()

    # Alice's memory must not appear in Bob's context
    full_context = str(built)
    assert 'ALICE_PRIVATE_SECRET_DATA' not in full_context


# ---------------------------------------------------------------------------
# O. Memory extraction runs after successful generation
# ---------------------------------------------------------------------------

def test_memory_extraction_runs_after_generation():
    token = signup('gen-extract@example.com')
    conv_id = make_conversation(token)
    seed_model()
    configure_provider(token)

    mock_provider = MagicMock()
    mock_provider.stream.return_value = iter(['Sure, noted!'])

    with patch('app.api.routes.get_provider', return_value=mock_provider), \
         patch('app.api.routes.extract_from_conversation') as mock_extract:
        client.post(
            f'/api/v1/conversations/{conv_id}/generate',
            headers=headers(token),
            json={
                'message': 'I am studying machine learning at university.',
                'provider': 'openai',
                'model_key': 'gpt-4o',
            },
        )
        mock_extract.assert_called_once()


def test_update_conversation_selected_model():
    token = signup('convupd-model@example.com')
    conv_id = make_conversation(token)
    model_id = seed_model(provider='openai', model_key='gpt-4o-upd', display_name='GPT-4o Update')

    r = client.patch(
        f'/api/v1/conversations/{conv_id}',
        headers=headers(token),
        json={'selected_model_id': model_id},
    )
    assert r.status_code == 200
    assert r.json()['selected_model_id'] == model_id

