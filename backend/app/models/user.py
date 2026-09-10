import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Coordinator")  # Admin, Manager, Coordinator, Sales, Faculty
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    managed_coordinators = relationship(
        "UserManagerMapping",
        foreign_keys="UserManagerMapping.manager_id",
        back_populates="manager",
        cascade="all, delete-orphan"
    )
    assigned_managers = relationship(
        "UserManagerMapping",
        foreign_keys="UserManagerMapping.coordinator_id",
        back_populates="coordinator",
        cascade="all, delete-orphan"
    )

    primary_managed_batches = relationship("Batch", foreign_keys="Batch.primary_manager_id", back_populates="primary_manager")
    coordinated_batches = relationship("Batch", foreign_keys="Batch.coordinator_id", back_populates="coordinator")
    sales_batches = relationship("Batch", foreign_keys="Batch.sales_spoc_id", back_populates="sales_spoc")


class UserManagerMapping(Base):
    __tablename__ = "user_manager_mappings"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coordinator_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    manager_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    coordinator = relationship("User", foreign_keys=[coordinator_id], back_populates="assigned_managers")
    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_coordinators")
