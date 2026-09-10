from sqlalchemy.orm import Session


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db