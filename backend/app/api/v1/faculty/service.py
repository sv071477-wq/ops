from typing import Optional

from sqlalchemy.orm import Session


class FacultyService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, faculty_type: Optional[str], domain: Optional[str]) -> list:
        return []

    def utilization(self) -> list:
        return []