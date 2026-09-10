from sqlalchemy.orm import Session


class FmsSyncRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_logs(self, skip: int, limit: int) -> list:
        return []