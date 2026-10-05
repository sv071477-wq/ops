from typing import List

from sqlalchemy.orm import Session

from app.api.v1.fms_sync.repository_interfaces import IFmsSyncRepository


class FmsSyncRepository(IFmsSyncRepository):
    """FMS dispatch history.

    The external FMS integration is not wired up yet and no dispatch log table
    exists, so this returns an empty history rather than pretending to persist.
    """

    def __init__(self, db: Session):
        self.db = db

    def list_logs(self, skip: int, limit: int) -> List[dict]:
        return []