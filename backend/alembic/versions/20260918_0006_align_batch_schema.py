"""Align batches with the consolidated active schema.

Revision ID: 20260918_0006
Revises: 20260916_0005
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260918_0006"
down_revision: Union[str, None] = "20260916_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


REMOVED_COLUMNS = (
    "residential_type",
    "delivery_mode",
    "residential_enrollments",
    "non_residential_enrollments",
    "total_feedback_score",
    "nps_imported_at",
    "nps_imported_by",
    "nps_source_filename",
    "retrospective_notes",
    "comments",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("batches")}

    for foreign_key in inspector.get_foreign_keys("batches"):
        constrained = foreign_key.get("constrained_columns", [])
        if constrained == ["nps_imported_by"] and foreign_key.get("name"):
            op.drop_constraint(foreign_key["name"], "batches", type_="foreignkey")

    for column in REMOVED_COLUMNS:
        if column in existing:
            op.drop_column("batches", column)


def downgrade() -> None:
    op.add_column("batches", sa.Column("residential_type", sa.String(length=20), nullable=False, server_default="NR"))
    op.add_column("batches", sa.Column("delivery_mode", sa.String(length=50), nullable=False, server_default="Online"))
    op.add_column("batches", sa.Column("residential_enrollments", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("batches", sa.Column("non_residential_enrollments", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("batches", sa.Column("total_feedback_score", sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column("batches", sa.Column("nps_imported_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("batches", sa.Column("nps_imported_by", sa.Uuid(), nullable=True))
    op.add_column("batches", sa.Column("nps_source_filename", sa.String(length=255), nullable=True))
    op.add_column("batches", sa.Column("retrospective_notes", sa.Text(), nullable=True))
    op.add_column("batches", sa.Column("comments", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_batches_nps_imported_by_users",
        "batches",
        "users",
        ["nps_imported_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("batches", "residential_type", server_default=None)
    op.alter_column("batches", "delivery_mode", server_default=None)
    op.alter_column("batches", "residential_enrollments", server_default=None)
    op.alter_column("batches", "non_residential_enrollments", server_default=None)
