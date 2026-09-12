import uuid
from datetime import datetime, timezone, time
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text, Time, Uuid
from sqlalchemy.orm import relationship

from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    date_of_training = Column(DateTime(timezone=True), nullable=False, index=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    topic = Column(String(255), nullable=False)
    no_of_hours = Column(Numeric(5, 2), nullable=False, default=Decimal("8.0"))
    venue = Column(String(255), nullable=True)
    location_city = Column(String(100), nullable=True)
    mode_of_delivery = Column(String(50), nullable=False, default="Online")
    status = Column(String(30), nullable=False, default="Scheduled", index=True)
    feedback_submitted = Column(Boolean, nullable=False, default=False)
    feedback_rating = Column(Numeric(3, 2), nullable=True)
    feedback_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    batch = relationship("Batch", back_populates="sessions")
    faculty = relationship("User", foreign_keys=[faculty_id], back_populates="training_sessions")