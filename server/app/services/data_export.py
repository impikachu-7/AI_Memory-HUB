from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Conversation, Memory, Message, User
from app.schemas import ConversationRead, MemoryRead, MessageRead, UserRead


def export_memories(db: Session, user_id: str) -> dict:
    memories = db.scalars(
        select(Memory).where(Memory.user_id == user_id).order_by(Memory.created_at.asc())
    ).all()
    return {
        "memories": [MemoryRead.model_validate(memory).model_dump(mode="json") for memory in memories],
    }


def export_conversations(db: Session, user_id: str) -> dict:
    conversations = db.scalars(
        select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.created_at.asc())
    ).all()
    conversation_ids = [conversation.id for conversation in conversations]
    message_rows = []
    if conversation_ids:
        message_rows = db.scalars(
            select(Message)
            .where(Message.user_id == user_id, Message.conversation_id.in_(conversation_ids))
            .order_by(Message.created_at.asc())
        ).all()
    messages_by_conversation: dict[str, list[dict]] = {conversation.id: [] for conversation in conversations}
    for message in message_rows:
        messages_by_conversation[message.conversation_id].append(
            MessageRead.model_validate(message).model_dump(mode="json")
        )
    return {
        "conversations": [
            {
                **ConversationRead.model_validate(conversation).model_dump(mode="json"),
                "messages": messages_by_conversation[conversation.id],
            }
            for conversation in conversations
        ],
    }


def export_user_data(db: Session, user: User) -> dict:
    return {
        "user": UserRead.model_validate(user).model_dump(mode="json"),
        **export_conversations(db, user.id),
        **export_memories(db, user.id),
    }
