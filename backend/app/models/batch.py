import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Numeric, Text,
    ForeignKey, CheckConstraint, Index, Uuid
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    # Primary Key
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identifiers
    batch_id = Column(String(255), unique=True, index=True, nullable=False)  # Immutable locked ID e.g. DTA_PysparkScala_SOW56_ILT_B2
    approval_id = Column(String(100), nullable=True, index=True)  # Financial SOW Reference

    # Program & Category Classification
    category = Column(String(100), nullable=False, default="Bootcamp")  # Bootcamp, RBT, PJP, Workshop
    residential_type = Column(String(20), nullable=False, default="NR")  # R, NR
    program_name = Column(String(255), nullable=False, index=True)
    technology = Column(String(255), nullable=True)  # PySpark, Databricks, Java FullStack
    domain = Column(String(100), nullable=True)  # IT/ITES, Cloud, DS/ML, CyberSecurity

    # Client Account
    client_name = Column(String(255), nullable=True, index=True)

    # Delivery Logistics & Timeline
    delivery_mode = Column(String(50), nullable=False, default="Online")  # Online, F2F, Blended
    location_city = Column(String(100), nullable=True)  # Bengaluru, Hyderabad, Mumbai, Remote
    start_date = Column(DateTime(timezone=True), nullable=True, index=True)
    end_date = Column(DateTime(timezone=True), nullable=True, index=True)
    batch_request_date = Column(DateTime(timezone=True), nullable=True)
    training_days = Column(Integer, default=0, nullable=False)
    calendar_days = Column(Integer, default=0, nullable=True)
    total_hours = Column(Numeric(8, 2), default=Decimal("0.00"), nullable=False)

    # Student Headcount Breakdown
    total_enrollments = Column(Integer, default=0, nullable=False)
    residential_enrollments = Column(Integer, default=0, nullable=False)
    non_residential_enrollments = Column(Integer, default=0, nullable=False)

    # Lifecycle State & Governance Lock
    status = Column(String(50), default="Requested", nullable=False, index=True)
    is_schema_locked = Column(Boolean, default=False, nullable=False)

    # Ownership & Operational Roles
    primary_manager_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    coordinator_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_spoc_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    faculty_assigned_text = Column(String(500), nullable=True)  # Legacy faculty string

    # Financial Milestone Status
    finance_status = Column(String(50), default="Pending", nullable=False)  # Pending, Cleared, Invoiced

    # Quality Checkpoint Metrics (Gate 1 & Gate 2)
    batch_avg_feedback = Column(Numeric(3, 2), nullable=True)  # Average feedback score (1.0 - 5.0)
    total_feedback_score = Column(Numeric(10, 2), nullable=True)  # Cumulative rating score
    batch_nps = Column(Numeric(4, 2), nullable=True)  # NPS score (0 - 10)
    retrospective_notes = Column(Text, nullable=True)

    # Remarks & Notes
    remarks = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)

    # Audit Timestamps (UTC)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    primary_manager = relationship("User", foreign_keys=[primary_manager_id], back_populates="primary_managed_batches")
    coordinator = relationship("User", foreign_keys=[coordinator_id], back_populates="coordinated_batches")
    sales_spoc = relationship("User", foreign_keys=[sales_spoc_id], back_populates="sales_batches")
