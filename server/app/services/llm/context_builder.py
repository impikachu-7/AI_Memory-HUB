"""LLM context builder.

Assembles the messages list sent to a provider:
  1. System message — app instructions + relevant long-term memories (user-scoped)
  2. Recent conversation history — capped at chat_history_limit messages
  3. Current user message

Memory retrieval uses the existing retrieve() function from memory_engine.py.
The full memory database is NEVER sent — only semantically relevant records.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Memory, Message
from app.services.memory_engine import retrieve

_SYSTEM_PREFIX = (
    "You are a helpful AI assistant with access to the user's long-term memory. "
    "Use the provided memory context to give personalized, relevant responses. "
    "Do not invent facts about the user that are not in the memory context."
)


def build(
    db: Session,
    user_id: str,
    conversation_id: str,
    user_message: str,
) -> list[dict]:
    """Return the messages list ready to be sent to any LLM provider."""
    settings = get_settings()

    # 1. Retrieve relevant memories (user-scoped, not full DB)
    relevant_pairs = retrieve(db, user_id, user_message, limit=settings.memory_retrieval_limit)
    memory_context = _format_memories(relevant_pairs)

    system_content = _SYSTEM_PREFIX
    if memory_context:
        system_content += f"\n\n### Relevant memory context\n{memory_context}"

    messages: list[dict] = [{"role": "system", "content": system_content}]

    # 2. Recent conversation history (capped)
    history = _load_history(db, user_id, conversation_id, settings.chat_history_limit)
    messages.extend(history)

    # 3. Current user message
    messages.append({"role": "user", "content": user_message})

    return messages


def _format_memories(pairs: list[tuple[Memory, float]]) -> str:
    if not pairs:
        return ""
    lines = []
    for memory, score in pairs:
        lines.append(f"- [{memory.category}] {memory.content}  (relevance: {score:.2f})")
    return "\n".join(lines)


def _load_history(
    db: Session,
    user_id: str,
    conversation_id: str,
    limit: int,
) -> list[dict]:
    """Load the last `limit` messages from the conversation (user + assistant only)."""
    rows = db.scalars(
        select(Message)
        .where(
            Message.user_id == user_id,
            Message.conversation_id == conversation_id,
            Message.role.in_(["user", "assistant"]),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    ).all()
    # Reverse so oldest → newest
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]
