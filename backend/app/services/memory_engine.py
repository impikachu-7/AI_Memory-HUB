"""User-owned long-term memory extraction, vector storage, and relevance ranking."""
from datetime import UTC, datetime
import hashlib
import math
import re
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Memory, Message

DIMENSIONS = 128
CATEGORY_RULES = {
    'Education': ('study', 'university', 'school', 'course', 'degree'),
    'Career': ('work', 'job', 'company', 'employer', 'career'),
    'Preferences': ('prefer', 'like ', 'favorite', 'dislike'),
    'Projects': ('project', 'building', 'working on'),
    'Goals': ('goal', 'want to', 'plan to', 'aim to'),
    'Skills': ('skill', 'experienced', 'proficient', 'programming'),
}

def embedding(text: str) -> list[float]:
    values = [0.0] * DIMENSIONS
    for token in re.findall(r"[a-z0-9]+", text.lower()):
        index = int(hashlib.sha256(token.encode()).hexdigest(), 16) % DIMENSIONS
        values[index] += 1.0
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return [value / norm for value in values]

class MemoryVectorStore:
    """Chroma-backed store. Each query always filters by authenticated user_id."""
    def __init__(self, client=None):
        self._client = client
    def collection(self):
        if self._client is None:
            import chromadb
            from app.core.config import get_settings
            self._client = chromadb.PersistentClient(path=get_settings().chroma_path)
        return self._client.get_or_create_collection('memories', metadata={'hnsw:space': 'cosine'})
    def upsert(self, memory: Memory):
        self.collection().upsert(ids=[memory.id], documents=[memory.content], embeddings=[embedding(memory.content)], metadatas=[{'user_id': memory.user_id, 'archived': memory.is_archived}])
    def delete(self, memory_id: str): self.collection().delete(ids=[memory_id])
    def search(self, user_id: str, query: str, limit: int) -> list[tuple[str, float]]:
        result = self.collection().query(query_embeddings=[embedding(query)], n_results=limit, where={'$and': [{'user_id': {'$eq': user_id}}, {'archived': {'$eq': False}}]})
        ids, distances = result.get('ids', [[]])[0], result.get('distances', [[]])[0]
        return list(zip(ids, [max(0.0, 1.0 - float(distance)) for distance in distances]))

vector_store = MemoryVectorStore()

def rank(memory: Memory, semantic_score: float) -> float:
    created = memory.created_at.replace(tzinfo=UTC) if memory.created_at.tzinfo is None else memory.created_at
    age_days = max(0, (datetime.now(UTC) - created).days)
    recency = math.exp(-age_days / 180)
    return .55 * semantic_score + .2 * memory.importance + .1 * memory.confidence + .1 * recency + (.15 if memory.is_pinned else 0)

def retrieve(db: Session, user_id: str, query: str, limit: int) -> list[tuple[Memory, float]]:
    candidates = vector_store.search(user_id, query, max(limit * 3, limit))
    by_id = {item.id: item for item in db.scalars(select(Memory).where(Memory.user_id == user_id, Memory.is_archived.is_(False), Memory.id.in_([item[0] for item in candidates]))) }
    ranked = [(by_id[memory_id], rank(by_id[memory_id], semantic)) for memory_id, semantic in candidates if memory_id in by_id]
    return sorted(ranked, key=lambda item: item[1], reverse=True)[:limit]

def infer_category(text: str) -> str:
    lower = text.lower()
    return next((category for category, words in CATEGORY_RULES.items() if any(word in lower for word in words)), 'Personal')

def extract_from_conversation(db: Session, user_id: str, conversation_id: str) -> list[Memory]:
    """Conservative heuristic: only durable first-person statements become candidates."""
    messages = db.scalars(select(Message).where(Message.user_id == user_id, Message.conversation_id == conversation_id, Message.role == 'user')).all()
    records = []
    for message in messages:
        for sentence in re.split(r'(?<=[.!?])\s+', message.content.strip()):
            lower = sentence.lower()
            if len(sentence) < 12 or not re.search(r'\b(i am|i work|i study|i prefer|i like|my goal|i want|i have|i\'m)\b', lower): continue
            if any(existing.content.lower() == sentence.lower() for existing in db.scalars(select(Memory).where(Memory.user_id == user_id))): continue
            records.append(Memory(user_id=user_id, content=sentence, category=infer_category(sentence), importance=.65, confidence=.7, source_conversation_id=conversation_id))
    db.add_all(records); db.commit()
    for record in records: db.refresh(record); vector_store.upsert(record)
    return records

