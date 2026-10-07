"""create audit_logs and program_types

Revision ID: 20261005_0004
Revises: 20260930_0003
Create Date: 2026-10-05 06:05:00

`app.models.__init__` did not import `AuditLog` or `ProgramType`, so neither
model was registered in `Base.metadata`. Consequences:

  * `alembic/env.py` autogenerate compared against 14 of 16 tables and would
    emit spurious DROP statements for these two.
  * Revision 0001's `Base.metadata.create_all()` skipped them, so a database
    built purely through Alembic never got the tables at all.
  * They only existed because `init_db()` imports both models directly, and
    that path is skipped when `ENVIRONMENT=production`. On a fresh production
    database every login wrote to `audit_logs` and the insert failed silently
    (`log_audit_event` swallows exceptions).

Both are created here from the model definitions rather than hand-written DDL,
so they cannot drift from `user.py` / `batch.py` again.
"""
from typing import Sequence, Union

try:
    from alembic import op
    import sqlalchemy as sa
except ImportError:
    op = None
    sa = None

# revision identifiers, used by Alembic.
revision: str = '20261005_0004'
down_revision: Union[str, None] = '20260930_0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MISSING_TABLES = ("audit_logs", "program_types")


def upgrade() -> None:
    from app.core.database import Base
    import app.models  # noqa: F401  (registers every model on Base.metadata)

    connection = op.get_bind()
    inspector = sa.inspect(connection)
    present = set(inspector.get_table_names())

    for name in _MISSING_TABLES:
        if name in present:
            continue
        Base.metadata.tables[name].create(bind=connection, checkfirst=True)

    # `program_types` is created without its unique index on `name` when the
    # table predates the mixin; create_all() never repairs indexes on tables it
    # skips, so add the ones the model declares.
    if "program_types" in present:
        existing_indexes = {i["name"] for i in sa.inspect(connection).get_indexes("program_types")}
        for index in Base.metadata.tables["program_types"].indexes:
            if index.name not in existing_indexes:
                index.create(bind=connection, checkfirst=True)


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    present = set(inspector.get_table_names())

    # `audit_logs` holds the security trail, so it is intentionally left in
    # place on downgrade rather than destroying history. Only `program_types`,
    # which is a seeded lookup table, is dropped.
    if "program_types" in present:
        op.drop_table("program_types")