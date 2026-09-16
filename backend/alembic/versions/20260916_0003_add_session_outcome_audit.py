"""Add audited session outcome fields.

Revision ID: 20260916_0003
Revises: 20260916_0002
Create Date: 2026-09-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260916_0003"
down_revision: Union[str, None] = "20260916_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("training_sessions")}
    for name, column in (
        ("outcome_reason", sa.Column("outcome_reason", sa.Text(), nullable=True)),
        ("outcome_at", sa.Column("outcome_at", sa.DateTime(timezone=True), nullable=True)),
        ("outcome_by", sa.Column("outcome_by", sa.Uuid(), nullable=True)),
        ("replacement_session_id", sa.Column("replacement_session_id", sa.Uuid(), nullable=True)),
    ):
        if name not in columns:
            op.add_column("training_sessions", column)

    foreign_keys = inspector.get_foreign_keys("training_sessions")
    has_outcome_by_fk = any(
        fk.get("constrained_columns") == ["outcome_by"] and fk.get("referred_table") == "users"
        for fk in foreign_keys
    )
    has_replacement_fk = any(
        fk.get("constrained_columns") == ["replacement_session_id"] and fk.get("referred_table") == "training_sessions"
        for fk in foreign_keys
    )
    if not has_outcome_by_fk:
        op.create_foreign_key(
            "fk_training_sessions_outcome_by_users", "training_sessions", "users",
            ["outcome_by"], ["id"], ondelete="SET NULL",
        )
    if not has_replacement_fk:
        op.create_foreign_key(
            "fk_training_sessions_replacement_session", "training_sessions", "training_sessions",
            ["replacement_session_id"], ["id"], ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("training_sessions")}
    for name in ("fk_training_sessions_replacement_session", "fk_training_sessions_outcome_by_users"):
        if name in foreign_keys:
            op.drop_constraint(name, "training_sessions", type_="foreignkey")
    columns = {column["name"] for column in inspector.get_columns("training_sessions")}
    for name in ("replacement_session_id", "outcome_by", "outcome_at", "outcome_reason"):
        if name in columns:
            op.drop_column("training_sessions", name)
