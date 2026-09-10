from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.batch import Batch


class BatchRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, batch_id: UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def get_by_batch_id(self, batch_id: str) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.batch_id == batch_id).first()

    def save(self, batch: Batch) -> Batch:
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def list_all(self) -> List[Batch]:
        return self.db.query(Batch).order_by(Batch.created_at.desc()).all()