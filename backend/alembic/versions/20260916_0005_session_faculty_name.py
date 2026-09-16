"""Store training session faculty as a name string.

Revision ID: 20260916_0005
Revises: 20260916_0004
Create Date: 2026-09-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260916_0005"
down_revision: Union[str, None] = "20260916_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("training_sessions")}
    if "faculty_name" not in columns:
        op.add_column("training_sessions", sa.Column("faculty_name", sa.String(length=255), nullable=True))
    if "faculty_id" in columns:
        op.execute(
            "UPDATE training_sessions ts "
            "SET faculty_name = u.full_name "
            "FROM users u WHERE ts.faculty_id = u.id AND ts.faculty_name IS NULL"
        )
    op.execute(
        "UPDATE training_sessions SET faculty_name = 'Unknown Faculty' "
        "WHERE faculty_name IS NULL"
    )
    op.alter_column("training_sessions", "faculty_name", nullable=False)
    if "faculty_id" in columns:
        foreign_keys = inspector.get_foreign_keys("training_sessions")
        for foreign_key in foreign_keys:
            if "faculty_id" in foreign_key.get("constrained_columns", []):
                name = foreign_key.get("name")
                if name:
                    op.drop_constraint(name, "training_sessions", type_="foreignkey")
        op.drop_column("training_sessions", "faculty_id")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("training_sessions")}
    if "faculty_id" not in columns:
        op.add_column("training_sessions", sa.Column("faculty_id", sa.Uuid(), nullable=True))
        if "faculty_name" in columns:
            op.execute(
                "UPDATE training_sessions ts SET faculty_id = u.id "
                "FROM users u WHERE lower(ts.faculty_name) = lower(u.full_name)"
            )
        op.create_foreign_key(
            "training_sessions_faculty_id_fkey", "training_sessions", "users",
            ["faculty_id"], ["id"], ondelete="RESTRICT",
        )
    if "faculty_name" in columns:
        op.drop_column("training_sessions", "faculty_name")