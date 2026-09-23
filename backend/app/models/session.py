import uuid
from datetime import datetime, timezone, time, date
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time, Uuid
from sqlalchemy.orm import relationship

from app.core.database import Base


class TrainingSession(Base):
    """Stores the ingested day-wise curriculum schedule for a batch."""
    __tablename__ = "training_sessions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=True)
    week = Column(String(50), nullable=True)
    session_date = Column(Date, nullable=False, index=True)
    day_name = Column(String(20), nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    duration_hours = Column(Numeric(5, 2), nullable=False, default=Decimal("8.0"))
    module = Column(Text, nullable=False)
    trainer_name = Column(String(255), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="Scheduled", index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    batch = relationship("Batch", back_populates="scheduled_sessions")
    utilizations = relationship("FacultyUtilization", back_populates="training_session")


class FacultyUtilization(Base):
    """Tracks actual delivery, attendance, timesheet hours, and feedback ratings per faculty session."""
    __tablename__ = "faculty_utilization"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    training_session_id = Column(Uuid(as_uuid=True), ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    faculty_name = Column(String(255), nullable=False, index=True)
    date_of_training = Column(DateTime(timezone=True), nullable=False, index=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    topic = Column(Text, nullable=False)
    no_of_hours = Column(Numeric(5, 2), nullable=False, default=Decimal("8.0"))
    venue = Column(String(255), nullable=True)
    location_city = Column(String(100), nullable=True)
    mode_of_delivery = Column(String(50), nullable=False, default="Online")
    status = Column(String(30), nullable=False, default="Scheduled", index=True)
    feedback_submitted = Column(Boolean, nullable=False, default=False)
    feedback_rating = Column(Numeric(3, 2), nullable=True)
    feedback_notes = Column(Text, nullable=True)
    outcome_reason = Column(Text, nullable=True)
    outcome_at = Column(DateTime(timezone=True), nullable=True)
    outcome_by = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    replacement_session_id = Column(Uuid(as_uuid=True), ForeignKey("faculty_utilization.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    batch = relationship("Batch", back_populates="faculty_utilizations")
    training_session = relationship("TrainingSession", foreign_keys=[training_session_id], back_populates="utilizations")
    replacement_session = relationship("FacultyUtilization", remote_side=[id], foreign_keys=[replacement_session_id])