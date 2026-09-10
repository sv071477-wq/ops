from sqlalchemy.orm import Session


class GateRepository:
    def __init__(self, db: Session):
        self.db = db