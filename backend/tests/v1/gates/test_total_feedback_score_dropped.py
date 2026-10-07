"""The `batches.total_feedback_score` column is dead surface: it is not
declared on the `Batch` model, no application code reads it, and the
20261005_0005 migration drops it. These tests pin both halves so the
column cannot quietly come back."""
import importlib.util
from pathlib import Path

from sqlalchemy import create_engine, inspect

from app.models.batch import Batch

_MIGRATION = Path(__file__).resolve().parents[3] / "alembic" / "versions" / "20261005_0005_drop_batches_total_feedback_score.py"


def _load_migration():
    spec = importlib.util.spec_from_file_location("drop_total_feedback_score", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_batch_model_does_not_declare_total_feedback_score():
    assert "total_feedback_score" not in Batch.__table__.columns.keys()


def test_migration_drops_total_feedback_score_and_is_rerunnable():
    """The drop is inspector-guarded: running it against a database that
    still has the column removes it, and running it again is a no-op."""
    from app.core.database import Base
    import app.models  # noqa: F401  (registers every model)

    engine = create_engine("sqlite:///:memory:")
    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as connection:
            # The model no longer declares the column, so simulate the
            # pre-migration database the 0001 import left behind.
            connection.exec_driver_sql(
                "ALTER TABLE batches ADD COLUMN total_feedback_score NUMERIC(10, 2)"
            )

        migration = _load_migration()

        with engine.begin() as connection:
            migration.op = _make_op(connection)
            migration.upgrade()

        assert "total_feedback_score" not in _batches_columns(engine)

        # Re-running must not raise: the guard sees the column is gone.
        with engine.begin() as connection:
            migration.op = _make_op(connection)
            migration.upgrade()

        assert "total_feedback_score" not in _batches_columns(engine)

        # Downgrade restores the column.
        with engine.begin() as connection:
            migration.op = _make_op(connection)
            migration.downgrade()

        assert "total_feedback_score" in _batches_columns(engine)
    finally:
        engine.dispose()


def _batches_columns(engine):
    return {c["name"] for c in inspect(engine).get_columns("batches")}


class _MakeOp:
    """Minimal stand-in for `alembic.op` bound to a live connection."""

    def __init__(self, connection):
        self._connection = connection

    def get_bind(self):
        return self._connection

    def drop_column(self, table_name, column_name):
        self._connection.exec_driver_sql(f"ALTER TABLE {table_name} DROP COLUMN {column_name}")

    def add_column(self, table_name, column):
        self._connection.exec_driver_sql(
            f"ALTER TABLE {table_name} ADD COLUMN {column.name} NUMERIC(10, 2)"
        )


def _make_op(connection):
    return _MakeOp(connection)
