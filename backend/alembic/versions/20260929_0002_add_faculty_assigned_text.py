"""add faculty_assigned_text to batches

Revision ID: 20260929_0002
Revises: 20260916_0001
Create Date: 2026-09-29 17:40:00

The column is part of the documented batches schema and is read/written by the
API and the frontend, but it was missing from the SQLAlchemy model. Creating a
batch raised `TypeError: 'faculty_assigned_text' is an invalid keyword argument
for Batch`, and schedules service crashed with an AttributeError when reading it.
"""
from typing import Sequence, Union

try:
    from alembic import op
    import sqlalchemy as sa
except ImportError:
    op = None
    sa = None

# revision identifiers, used by Alembic.
revision: str = '20260929_0002'
down_revision: Union[str, None] = '20260916_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    existing = {column["name"] for column in sa.inspect(connection).get_columns("batches")}
    if "faculty_assigned_text" not in existing:
        op.add_column(
            "batches",
            sa.Column("faculty_assigned_text", sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("batches", "faculty_assigned_text")
