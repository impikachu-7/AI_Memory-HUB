from test_auth_and_isolation import client, headers, signup

# Rename signup to token to keep the rest of the file unchanged
token = signup

def test_user_cannot_read_another_users_conversation_or_messages():
    alice, bob = token('alice-iso@example.com'), token('bob-iso@example.com')
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

