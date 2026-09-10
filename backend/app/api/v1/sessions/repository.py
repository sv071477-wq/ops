from sqlalchemy.orm import Session


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db