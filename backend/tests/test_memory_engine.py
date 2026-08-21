from app.services.memory_engine import vector_store
from test_auth_and_isolation import client, headers, signup

class FakeCollection:
    def __init__(self): self.items = {}
    def upsert(self, ids, documents, embeddings, metadatas):
        for item_id, document, vector, metadata in zip(ids, documents, embeddings, metadatas): self.items[item_id] = (document, vector, metadata)
    def delete(self, ids):
        for item_id in ids: self.items.pop(item_id, None)
    def query(self, query_embeddings, n_results, where):
        user_id = where['$and'][0]['user_id']['$eq']; archive = where['$and'][1]['archived']['$eq']; query = query_embeddings[0]
        found = [(item_id, sum(a*b for a,b in zip(query, vector))) for item_id, (_, vector, metadata) in self.items.items() if metadata['user_id'] == user_id and metadata['archived'] == archive]
        found.sort(key=lambda pair: pair[1], reverse=True); found = found[:n_results]
        return {'ids': [[item_id for item_id, _ in found]], 'distances': [[1 - score for _, score in found]]}
class FakeClient:
    def __init__(self): self.store = FakeCollection()
    def get_or_create_collection(self, *_args, **_kwargs): return self.store

vector_store._client = FakeClient()

def test_memory_create_retrieve_update_delete_and_archive():
    alice = signup('memory-engine@example.com')
    created = client.post('/api/v1/memories', headers=headers(alice), json={'content': 'I work at Acme as a data engineer.', 'category': 'Career', 'importance': .9, 'confidence': .8}).json()
    assert created['category'] == 'Career'
    found = client.get('/api/v1/memories/search', headers=headers(alice), params={'query': 'What company does my data engineering job involve?'}).json()
    assert found[0]['id'] == created['id']
    assert client.patch(f"/api/v1/memories/{created['id']}", headers=headers(alice), json={'content': 'I work at Globex as a data engineer.'}).status_code == 200
    assert client.post(f"/api/v1/memories/{created['id']}/archive", headers=headers(alice)).status_code == 200
    assert client.get('/api/v1/memories/search', headers=headers(alice), params={'query': 'Globex'}).json() == []
    assert client.post(f"/api/v1/memories/{created['id']}/restore", headers=headers(alice)).status_code == 200
    assert client.delete(f"/api/v1/memories/{created['id']}", headers=headers(alice)).status_code == 204

def test_memory_vector_search_is_user_scoped_and_pins_rank_higher():
    alice, bob = signup('rank-alice@example.com'), signup('rank-bob@example.com')
    first = client.post('/api/v1/memories', headers=headers(alice), json={'content': 'I prefer Python for backend systems.', 'category': 'Preferences'}).json()
    pinned = client.post('/api/v1/memories', headers=headers(alice), json={'content': 'Python is my preferred language for services.', 'category': 'Preferences'}).json()
    client.post(f"/api/v1/memories/{pinned['id']}/pin", headers=headers(alice))
    client.post('/api/v1/memories', headers=headers(bob), json={'content': 'I prefer Python for secret systems.', 'category': 'Preferences'})
    results = client.get('/api/v1/memories/search', headers=headers(alice), params={'query': 'preferred Python services'}).json()
    assert results[0]['id'] == pinned['id']
    assert {result['id'] for result in results} == {first['id'], pinned['id']}

def test_extracts_only_durable_first_person_conversation_information():
    token = signup('extract@example.com')
    conversation = client.post('/api/v1/conversations', headers=headers(token), json={'title': 'Plans'}).json()
    client.post(f"/api/v1/conversations/{conversation['id']}/messages", headers=headers(token), json={'role': 'user', 'content': 'Hello! I am studying computer science at university. What is the weather?'})
    extracted = client.post(f"/api/v1/conversations/{conversation['id']}/extract-memories", headers=headers(token)).json()
    assert len(extracted) == 1 and extracted[0]['category'] == 'Education'

