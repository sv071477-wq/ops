from sqlalchemy.orm import Session


class ScheduleRepository:
    def __init__(self, db: Session):
        self.db = db