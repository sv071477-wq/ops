"""Resolve imported Excel owner names to application user IDs.

Revision ID: 20260916_0002
Revises: 20260916_0001
Create Date: 2026-09-16

"""
import os
from datetime import datetime, timezone
from typing import Sequence, Union

import pandas as pd
from alembic import op
import sqlalchemy as sa

revision: str = "20260916_0002"
down_revision: Union[str, None] = "20260916_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MARKER = "%[Auto-Imported 2026 MBR]%"


def find_excel_file() -> str:
    possible_paths = [
        os.path.join(os.getcwd(), "project_data", "1.MBR_Active Batches.xlsx"),
        "/app/project_data/1.MBR_Active Batches.xlsx",
        "/project_data/1.MBR_Active Batches.xlsx",
    ]
    for path in possible_paths:
        absolute_path = os.path.abspath(path)
        if os.path.exists(absolute_path):
            return absolute_path
    raise FileNotFoundError("Could not find '1.MBR_Active Batches.xlsx' in project_data")


def normalize_name(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return " ".join(str(value).strip().lower().split())


def clean_name(value: object) -> str | None:
    name = " ".join(str(value).strip().split()) if value is not None and not pd.isna(value) else ""
    return name or None


def load_2026_owner_rows(excel_path: str) -> list[dict[str, str | None]]:
    columns = ["Batch ID", "Start Date", "End Date", "Program Manager", "Sales SPOC", "Spoc"]
    data = pd.read_excel(excel_path, sheet_name="Enrollment", usecols=columns)
    start_dates = pd.to_datetime(data["Start Date"], errors="coerce")
    end_dates = pd.to_datetime(data["End Date"], errors="coerce")
    data = data[(start_dates.dt.year == 2026) | (end_dates.dt.year == 2026)]

    rows = []
    seen_batch_ids: set[str] = set()
    for _, row in data.iterrows():
        batch_id = clean_name(row.get("Batch ID"))
        if not batch_id or batch_id in seen_batch_ids:
            continue
        seen_batch_ids.add(batch_id)
        rows.append(
            {
                "batch_id": batch_id,
                "manager_name": clean_name(row.get("Program Manager")),
                "sales_name": clean_name(row.get("Sales SPOC")),
                "coordinator_name": clean_name(row.get("Spoc")),
            }
        )
    return rows


def upgrade() -> None:
    connection = op.get_bind()
    excel_path = find_excel_file()
    owner_rows = load_2026_owner_rows(excel_path)

    user_rows = connection.execute(
        sa.text(
            "SELECT id, full_name, role "
            "FROM users "
            "WHERE is_active = TRUE"
        )
    ).mappings().all()

    users_by_name: dict[str, list[dict]] = {}
    for user in user_rows:
        normalized = normalize_name(user["full_name"])
        if normalized:
            users_by_name.setdefault(normalized, []).append(dict(user))

    def resolve(name: str | None, allowed_roles: set[str]) -> tuple[object | None, str]:
        if not name:
            return None, "empty"
        matches = [
            user
            for user in users_by_name.get(normalize_name(name), [])
            if str(user["role"]).strip().lower() in allowed_roles
        ]
        if len(matches) == 1:
            return matches[0]["id"], "matched"
        if len(matches) > 1:
            return None, "ambiguous"
        return None, "unmatched"

    matched = {"manager": 0, "sales": 0, "coordinator": 0}
    unresolved: dict[str, set[str]] = {"manager": set(), "sales": set(), "coordinator": set()}
    ambiguous: dict[str, set[str]] = {"manager": set(), "sales": set(), "coordinator": set()}
    updated_batches = 0

    for row in owner_rows:
        batch = connection.execute(
            sa.text(
                "SELECT batch_id, primary_manager_id, sales_spoc_id, coordinator_id "
                "FROM batches "
                "WHERE batch_id = :batch_id AND remarks LIKE :marker"
            ),
            {"batch_id": row["batch_id"], "marker": MARKER},
        ).mappings().first()
        if not batch:
            continue

        updates: dict[str, object] = {}
        assignments = [
            ("manager_name", "primary_manager_id", {"manager", "admin"}, "manager", batch["primary_manager_id"]),
            ("sales_name", "sales_spoc_id", {"sales"}, "sales", batch["sales_spoc_id"]),
            ("coordinator_name", "coordinator_id", {"coordinator"}, "coordinator", batch["coordinator_id"]),
        ]
        for source_field, target_field, roles, report_key, existing_id in assignments:
            source_name = row[source_field]
            if existing_id is not None:
                continue
            user_id, result = resolve(source_name, roles)
            if result == "matched":
                updates[target_field] = user_id
                matched[report_key] += 1
            elif source_name and result == "ambiguous":
                ambiguous[report_key].add(source_name)
            elif source_name:
                unresolved[report_key].add(source_name)

        if updates:
            set_clause = ", ".join(f"{field} = :{field}" for field in updates)
            params = {**updates, "batch_id": row["batch_id"], "marker": MARKER}
            connection.execute(
                sa.text(
                    f"UPDATE batches SET {set_clause}, updated_at = :updated_at "
                    "WHERE batch_id = :batch_id AND remarks LIKE :marker"
                ),
                {**params, "updated_at": datetime.now(timezone.utc)},
            )
            updated_batches += 1

    print(f"[ALEMBIC] Owner resolution checked {len(owner_rows)} Excel rows.")
    print(f"[ALEMBIC] Batches updated: {updated_batches}")
    print(
        "[ALEMBIC] Matches: "
        f"managers={matched['manager']}, "
        f"sales={matched['sales']}, "
        f"coordinators={matched['coordinator']}"
    )
    for owner_type in ("manager", "sales", "coordinator"):
        if unresolved[owner_type]:
            print(f"[ALEMBIC] Unmatched {owner_type} names: {sorted(unresolved[owner_type])}")
        if ambiguous[owner_type]:
            print(f"[ALEMBIC] Ambiguous {owner_type} names: {sorted(ambiguous[owner_type])}")


def downgrade() -> None:
    print("[ALEMBIC] Ownership backfill is intentionally not reversed to avoid removing manual assignments.")
