"""add faculty_type_id to faculty_utilization

Revision ID: 20260930_0003
Revises: 20260929_0002
Create Date: 2026-09-30 09:55:00

The delivery ledger recorded the trainer's engagement type nowhere, so the
utilization CSV export filtered on `FacultyUtilization.faculty_type`, a column
that never existed, and the log form had no way to capture it. This adds a
nullable foreign key to `faculty_types` (SET NULL, so deleting a roster entry
never blocks on historical ledger rows).
"""
from typing import Sequence, Union

try:
    from alembic import op
    import sqlalchemy as sa
except ImportError:
    op = None
    sa = None

# revision identifiers, used by Alembic.
revision: str = '20260930_0003'
down_revision: Union[str, None] = '20260929_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "faculty_types" not in inspector.get_table_names():
        sa.Table(
            "faculty_types",
            sa.MetaData(),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        ).create_all(bind=connection)

    existing = {column["name"] for column in sa.inspect(connection).get_columns("faculty_utilization")}
    if "faculty_type_id" not in existing:
        op.add_column(
            "faculty_utilization",
            sa.Column("faculty_type_id", sa.Uuid(), nullable=True),
        )
        op.create_foreign_key(
            "fk_faculty_utilization_faculty_type_id",
            "faculty_utilization",
            "faculty_types",
            ["faculty_type_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_faculty_utilization_faculty_type_id",
            "faculty_utilization",
            ["faculty_type_id"],
        )


def downgrade() -> None:
    connection = op.get_bind()
    existing = {column["name"] for column in sa.inspect(connection).get_columns("faculty_utilization")}
    if "faculty_type_id" in existing:
        indexes = {index["name"] for index in sa.inspect(connection).get_indexes("faculty_utilization")}
        if "ix_faculty_utilization_faculty_type_id" in indexes:
            op.drop_index("ix_faculty_utilization_faculty_type_id", table_name="faculty_utilization")
        op.drop_constraint(
            "fk_faculty_utilization_faculty_type_id",
            "faculty_utilization",
            type_="foreignkey",
        )
        op.drop_column("faculty_utilization", "faculty_type_id")
