"""drop batches.total_feedback_score

Revision ID: 20261005_0005
Revises: 20261005_0004
Create Date: 2026-10-05 16:05:00

`batches.total_feedback_score` was a cumulative rating-points total. It is not
declared on the `Batch` model, no application code reads it, and nothing
recomputes it: only the one-off `20260916_0001` import migration ever wrote it.
Quality Checkpoint 1 owns the only aggregate that is actually used,
`batch_avg_feedback`, and it is write-once.

The values are not reconstructible — the rated-delivery count is not stored — so
export `SELECT batch_id, total_feedback_score FROM batches` before deploying.
That migration must not be edited: it runs before this one and still inserts
into the column it created.
"""
from typing import Sequence, Union

try:
    from alembic import op
    import sqlalchemy as sa
except ImportError:
    op = None
    sa = None

# revision identifiers, used by Alembic.
revision: str = '20261005_0005'
down_revision: Union[str, None] = '20261005_0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "batches"
_COLUMN = "total_feedback_score"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if _TABLE not in inspector.get_table_names():
        return
    if _COLUMN not in {c["name"] for c in inspector.get_columns(_TABLE)}:
        return

    op.drop_column(_TABLE, _COLUMN)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if _TABLE not in inspector.get_table_names():
        return
    if _COLUMN in {c["name"] for c in inspector.get_columns(_TABLE)}:
        return

    op.add_column(_TABLE, sa.Column(_COLUMN, sa.Numeric(precision=10, scale=2), nullable=True))