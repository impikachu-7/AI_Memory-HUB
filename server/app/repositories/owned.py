from typing import Generic, TypeVar
from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class OwnedRepository(Generic[T]):
    def __init__(self, model: type[T]): self.model = model
    def list(self, db: Session, user_id: str) -> list[T]: return list(db.scalars(select(self.model).where(self.model.user_id == user_id)))
    def get(self, db: Session, user_id: str, resource_id: str) -> T:
        item = db.scalar(select(self.model).where(self.model.id == resource_id, self.model.user_id == user_id))
        if not item: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        return item
    def create(self, db: Session, item: T) -> T:
        db.add(item); db.commit(); db.refresh(item); return item

