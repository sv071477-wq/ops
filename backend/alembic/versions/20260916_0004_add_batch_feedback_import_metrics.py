"""Add persisted final feedback import metrics to batches.

Revision ID: 20260916_0004
Revises: 20260916_0003
Create Date: 2026-09-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260916_0004"
down_revision: Union[str, None] = "20260916_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("batches")}
    new_columns = (
        ("nps_total_responses", sa.Integer()),
        ("nps_promoters", sa.Integer()),
        ("nps_passives", sa.Integer()),
        ("nps_detractors", sa.Integer()),
        ("nps_imported_at", sa.DateTime(timezone=True)),
        ("nps_imported_by", sa.Uuid()),
        ("nps_source_filename", sa.String(length=255)),
    )
    for name, column_type in new_columns:
        if name not in columns:
            op.add_column("batches", sa.Column(name, column_type, nullable=True))
    op.alter_column("batches", "batch_nps", type_=sa.Numeric(precision=6, scale=2))
    foreign_keys = inspector.get_foreign_keys("batches")
    has_imported_by_fk = any(
        fk.get("constrained_columns") == ["nps_imported_by"] and fk.get("referred_table") == "users"
        for fk in foreign_keys
    )
    if not has_imported_by_fk:
        op.create_foreign_key(
            "fk_batches_nps_imported_by_users", "batches", "users",
            ["nps_imported_by"], ["id"], ondelete="SET NULL",
        )


def downgrade() -> None:
    op.drop_constraint("fk_batches_nps_imported_by_users", "batches", type_="foreignkey")
    op.alter_column("batches", "batch_nps", type_=sa.Numeric(precision=5, scale=2))
    op.drop_column("batches", "nps_source_filename")
    op.drop_column("batches", "nps_imported_by")
    op.drop_column("batches", "nps_imported_at")
    op.drop_column("batches", "nps_detractors")
    op.drop_column("batches", "nps_passives")
    op.drop_column("batches", "nps_promoters")
    op.drop_column("batches", "nps_total_responses")
