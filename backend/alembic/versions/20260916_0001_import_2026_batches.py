"""Extract and import 2026 batches from MBR Active Batches Excel sheet

Revision ID: 20260916_0001
Revises: None
Create Date: 2026-09-16 08:20:00

"""
import os
import uuid
from typing import Sequence, Union
from datetime import datetime, timezone
from decimal import Decimal

try:
    from alembic import op
    import sqlalchemy as sa
except ImportError:
    op = None
    sa = None
import pandas as pd

# revision identifiers, used by Alembic.
revision: str = '20260916_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def find_excel_file() -> str:
    possible_paths = [
        os.path.join(os.getcwd(), "project_data", "1.MBR_Active Batches.xlsx"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "project_data", "1.MBR_Active Batches.xlsx"),
        os.path.join(os.path.dirname(__file__), "..", "..", "project_data", "1.MBR_Active Batches.xlsx"),
        r"d:\projects and files\ops\project_data\1.MBR_Active Batches.xlsx",
        "/project_data/1.MBR_Active Batches.xlsx",
        "/app/project_data/1.MBR_Active Batches.xlsx",
        "/app/../project_data/1.MBR_Active Batches.xlsx",
    ]
    for p in possible_paths:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            return abs_p
    raise FileNotFoundError("Could not find '1.MBR_Active Batches.xlsx' in project_data directory")


def clean_str(val) -> Union[str, None]:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s else None


def clean_int(val, default: int = 0) -> int:
    if pd.isna(val) or val is None:
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def clean_decimal(val, default: Decimal = Decimal("0.00")) -> Decimal:
    if pd.isna(val) or val is None:
        return default
    try:
        return Decimal(str(round(float(val), 2)))
    except (ValueError, TypeError, ArithmeticError):
        return default


def clean_date(val) -> Union[datetime, None]:
    if pd.isna(val) or val is None:
        return None
    try:
        dt = pd.to_datetime(val, errors='coerce')
        if pd.isna(dt):
            return None
        py_dt = dt.to_pydatetime()
        if py_dt.tzinfo is None:
            py_dt = py_dt.replace(tzinfo=timezone.utc)
        return py_dt
    except Exception:
        return None


def normalize_mode(mode_val, location_val) -> tuple[str, Union[str, None]]:
    m_clean = clean_str(mode_val)
    loc_clean = clean_str(location_val)
    if not m_clean:
        return "Online", loc_clean

    m_lower = m_clean.lower()
    if "online" in m_lower:
        return "Online", None
    elif "blend" in m_lower:
        return "Blended", loc_clean or "Remote"
    elif "f2f" in m_lower or "offline" in m_lower:
        return "F2F", loc_clean or "Bengaluru"
    elif m_clean in ["Hyderabad", "Bengaluru", "Mumbai", "Chennai", "Pune", "Delhi", "Noida", "Gurgaon"]:
        return "F2F", m_clean
    else:
        return "Online", loc_clean


def normalize_status(status_val) -> str:
    s = clean_str(status_val)
    if not s:
        return "Requested"
    s_lower = s.lower().replace(" ", "").replace("_", "")
    if "complete" in s_lower:
        return "Completed"
    elif "ongoing" in s_lower:
        return "Ongoing"
    elif "upcoming" in s_lower:
        return "Upcoming"
    elif "cancel" in s_lower:
        return "Cancelled"
    elif "onhold" in s_lower or "hold" in s_lower:
        return "OnHold"
    elif "approve" in s_lower:
        return "Approved"
    return "Requested"


def parse_and_normalize_2026_batches(excel_path: str) -> list[dict]:
    df = pd.read_excel(excel_path, sheet_name="Enrollment")
    start_dt = pd.to_datetime(df["Start Date"], errors="coerce")
    end_dt = pd.to_datetime(df["End Date"], errors="coerce")
    b2026 = df[(start_dt.dt.year == 2026) | (end_dt.dt.year == 2026)].copy()

    batches_parsed = []
    seen_batch_ids = set()
    now_utc = datetime.now(timezone.utc)

    for _, row in b2026.iterrows():
        raw_bid = clean_str(row.get("Batch ID"))
        if not raw_bid or raw_bid in seen_batch_ids:
            continue

        seen_batch_ids.add(raw_bid)

        mode, loc = normalize_mode(row.get("Mode ( F2F,online/\nblended)"), row.get("Program Location"))
        status = normalize_status(row.get("Status"))
        r_type_raw = clean_str(row.get("R/NR")) or "NR"
        residential_type = "R" if ("R" in r_type_raw.upper() and "NR" not in r_type_raw.upper()) else "NR"
        s_date = clean_date(row.get("Start Date"))
        e_date = clean_date(row.get("End Date"))
        req_date = clean_date(row.get("Batch Request Date")) or s_date or now_utc

        total_enr = clean_int(row.get("Total Enrollments"), 0)
        resi_enr = clean_int(row.get("Resi. Enrollments"), 0)
        non_resi_enr = clean_int(row.get("Enrolments"), total_enr)

        training_days = clean_int(row.get("Training days"), 0)
        cal_days = clean_int(row.get("Calender days"), 0)
        total_hours = clean_decimal(row.get("Total Hours"), Decimal("0.00"))

        avg_feedback = clean_decimal(row.get("Batch Avg Feedback*"), None)
        tot_feedback = clean_decimal(row.get("Total Feedback"), None)
        nps = clean_decimal(row.get("Batch NPS*"), None)

        remarks_str = clean_str(row.get("Remarks"))
        marker = "[Auto-Imported 2026 MBR]"
        full_remarks = f"{remarks_str} {marker}".strip() if remarks_str else marker

        record = {
            "id": uuid.uuid4(),
            "batch_id": raw_bid,
            "approval_id": clean_str(row.get("Approval ID")),
            "sow_number": clean_str(row.get("Approval ID")),
            "category": clean_str(row.get("Category")) or "Bootcamp",
            "residential_type": residential_type,
            "program_name": clean_str(row.get("ProgramName")) or raw_bid,
            "technology": clean_str(row.get("Technology")),
            "domain": clean_str(row.get("Domain")) or "IT/ITES",
            "client_name": clean_str(row.get("Client")),
            "delivery_mode": mode,
            "location_city": loc,
            "start_date": s_date,
            "end_date": e_date,
            "batch_request_date": req_date,
            "training_days": training_days,
            "calendar_days": cal_days,
            "total_hours": total_hours,
            "total_enrollments": total_enr,
            "residential_enrollments": resi_enr,
            "non_residential_enrollments": non_resi_enr,
            "status": status,
            "is_schema_locked": status in ("Approved", "Ongoing", "Completed"),
            "approver_1_status": "Pending",
            "approver_2_status": "Pending",
            "faculty_assigned_text": clean_str(row.get("Faculty assigned")),
            "finance_status": clean_str(row.get("Finance Status Check")) or "Pending",
            "batch_avg_feedback": avg_feedback,
            "total_feedback_score": tot_feedback,
            "batch_nps": nps,
            "remarks": full_remarks,
            "comments": clean_str(row.get("Spoc")),
            "created_at": now_utc,
            "updated_at": now_utc,
        }
        batches_parsed.append(record)

    return batches_parsed


def upgrade() -> None:
    connection = op.get_bind()

    # Ensure schema tables exist before seeding
    try:
        from app.core.database import Base
        Base.metadata.create_all(bind=connection)
    except Exception as e:
        print(f"[ALEMBIC] Table creation check note: {e}")

    excel_path = find_excel_file()
    print(f"[ALEMBIC] Reading 2026 batches from: {excel_path}")

    all_2026_records = parse_and_normalize_2026_batches(excel_path)
    print(f"[ALEMBIC] Found {len(all_2026_records)} records with year 2026 in sheet 'Enrollment'.")

    # Existing databases may have narrower legacy precision for these metrics.
    # Only alter columns that exist in the active schema.
    batch_columns = {column["name"] for column in sa.inspect(connection).get_columns("batches")}
    if "total_feedback_score" in batch_columns:
        op.alter_column(
            "batches",
            "total_feedback_score",
            existing_type=sa.Numeric(4, 2),
            type_=sa.Numeric(10, 2),
        )
    if "batch_nps" in batch_columns:
        op.alter_column(
            "batches",
            "batch_nps",
            existing_type=sa.Numeric(4, 2),
            type_=sa.Numeric(5, 2),
        )

    # Fetch existing batch IDs to ensure idempotency
    existing_result = connection.execute(sa.text("SELECT batch_id FROM batches")).fetchall()
    existing_batch_ids = {row[0] for row in existing_result}

    batches_to_insert = [b for b in all_2026_records if b["batch_id"] not in existing_batch_ids]

    if batches_to_insert:
        column_types = {
            "id": sa.Uuid,
            "batch_id": sa.String,
            "approval_id": sa.String,
            "sow_number": sa.String,
            "category": sa.String,
            "residential_type": sa.String,
            "program_name": sa.String,
            "technology": sa.String,
            "domain": sa.String,
            "client_name": sa.String,
            "delivery_mode": sa.String,
            "location_city": sa.String,
            "start_date": sa.DateTime(timezone=True),
            "end_date": sa.DateTime(timezone=True),
            "batch_request_date": sa.DateTime(timezone=True),
            "training_days": sa.Integer,
            "calendar_days": sa.Integer,
            "total_hours": sa.Numeric,
            "total_enrollments": sa.Integer,
            "residential_enrollments": sa.Integer,
            "non_residential_enrollments": sa.Integer,
            "status": sa.String,
            "is_schema_locked": sa.Boolean,
            "approver_1_status": sa.String,
            "approver_2_status": sa.String,
            "faculty_assigned_text": sa.String,
            "finance_status": sa.String,
            "batch_avg_feedback": sa.Numeric,
            "total_feedback_score": sa.Numeric,
            "batch_nps": sa.Numeric,
            "remarks": sa.Text,
            "comments": sa.Text,
            "created_at": sa.DateTime(timezone=True),
            "updated_at": sa.DateTime(timezone=True),
        }
        insert_columns = [name for name in column_types if name in batch_columns]
        batches_table = sa.table(
            "batches",
            *(sa.column(name, column_types[name]) for name in insert_columns),
        )
        batches_to_insert = [
            {name: record.get(name) for name in insert_columns}
            for record in batches_to_insert
        ]

        # Batch insert in chunks of 100
        chunk_size = 100
        for i in range(0, len(batches_to_insert), chunk_size):
            chunk = batches_to_insert[i:i + chunk_size]
            op.bulk_insert(batches_table, chunk)

        print(f"[ALEMBIC] Successfully inserted {len(batches_to_insert)} new 2026 batches into 'batches' table.")
    else:
        print("[ALEMBIC] All 2026 batches were already present in 'batches' table. No new inserts needed.")


def downgrade() -> None:
    connection = op.get_bind()
    marker = "%[Auto-Imported 2026 MBR]%"
    result = connection.execute(sa.text("DELETE FROM batches WHERE remarks LIKE :marker"), {"marker": marker})
    print(f"[ALEMBIC DOWNGRADE] Removed auto-imported 2026 batches.")
