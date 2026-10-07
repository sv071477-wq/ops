from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from app.core.database import SessionLocal, Base, engine
from app.models.user import User, UserManagerMapping, Role, Team, AuditLog
from app.models.batch import (
    Accommodation,
    ApprovalConfiguration,
    Batch,
    BatchCategory,
    DeliveryMode,
    Entity,
    FacultyType,
    Vertical,
    ProgramType,
)
from app.models.session import TrainingSession


def init_db(db: Session = None) -> None:
    """Creates database schema tables, ensures migration columns exist, and seeds base roles without demo data."""
    Base.metadata.create_all(bind=engine)

    # Keep existing databases aligned without requiring a migration runner.
    # Every entry must correspond to a column that is actually declared on the
    # model. Listing a column the model does not have adds dead DDL that nothing
    # ever reads; omitting one leaves reads failing at runtime.
    try:
        with engine.connect() as conn:
            schema_columns = {
                "users": {
                    "role_id": "UUID REFERENCES roles(id) ON DELETE SET NULL",
                    "team_id": "UUID REFERENCES teams(id) ON DELETE SET NULL",
                    "manager_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "failed_login_attempts": "INTEGER DEFAULT 0 NOT NULL",
                    "locked_until": "TIMESTAMPTZ",
                    "last_login_at": "TIMESTAMPTZ",
                },
                "batches": {
                    # Lookup and ownership keys. Without these a batch cannot be
                    # attributed to a manager/coordinator/sales owner, so RBAC
                    # scoping on the batch list silently returns nothing.
                    "entity_id": "UUID REFERENCES entities(id) ON DELETE RESTRICT",
                    "category_id": "UUID REFERENCES batch_categories(id) ON DELETE RESTRICT",
                    "delivery_mode_id": "UUID REFERENCES delivery_modes(id) ON DELETE RESTRICT",
                    "accommodation_id": "UUID REFERENCES accommodations(id) ON DELETE RESTRICT",
                    "primary_manager_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "coordinator_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "sales_spoc_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    # Two-stage approval chain.
                    "approver_1_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "approver_2_id": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "approver_1_status": "VARCHAR(20) DEFAULT 'Pending' NOT NULL",
                    "approver_2_status": "VARCHAR(20) DEFAULT 'Pending' NOT NULL",
                    "approver_1_approved_at": "TIMESTAMPTZ",
                    "approver_2_approved_at": "TIMESTAMPTZ",
                    "finance_status": "VARCHAR(50) DEFAULT 'Pending' NOT NULL",
                    "finance_status_check_date": "DATE",
                    "finance_check": "INTEGER",
                    "batch_avg_feedback": "NUMERIC(3, 2)",
                    "batch_nps": "NUMERIC(6, 2)",
                    "nps_total_responses": "INTEGER",
                    "nps_promoters": "INTEGER",
                    "nps_passives": "INTEGER",
                    "nps_detractors": "INTEGER",
                    "faculty_members": "JSON",
                    "faculty_assigned_text": "VARCHAR(500)",
                },
                # The planned curriculum only. Delivery facts (faculty, topic,
                # hours, feedback, outcomes) live on faculty_utilization and
                # were wrongly listed here, so this table picked up four dead
                # columns on every existing database.
                "training_sessions": {
                    "sequence_number": "INTEGER",
                },
                "faculty_utilization": {
                    "training_session_id": "UUID REFERENCES training_sessions(id) ON DELETE SET NULL",
                    "venue": "VARCHAR(255)",
                    "location_city": "VARCHAR(100)",
                    "mode_of_delivery": "VARCHAR(50) DEFAULT 'Online' NOT NULL",
                    "feedback_submitted": "BOOLEAN DEFAULT FALSE NOT NULL",
                    "feedback_rating": "NUMERIC(3, 2)",
                    "feedback_notes": "TEXT",
                    "outcome_reason": "TEXT",
                    "outcome_at": "TIMESTAMPTZ",
                    "outcome_by": "UUID REFERENCES users(id) ON DELETE SET NULL",
                    "vertical": "VARCHAR(50)",
                    "program_type_id": "UUID REFERENCES program_types(id) ON DELETE SET NULL",
                    "faculty_type_id": "UUID REFERENCES faculty_types(id) ON DELETE SET NULL",
                },
            }

            # create_all() skips tables that already exist, so it never adds
            # indexes to them either. Re-add the ones the models declare.
            expected_indexes = {
                "batches": [
                    ("ix_batches_status", ["status"]),
                    ("ix_batches_start_date", ["start_date"]),
                ],
                "training_sessions": [
                    ("ix_training_sessions_batch_id", ["batch_id"]),
                    ("ix_training_sessions_session_date", ["session_date"]),
                ],
                "faculty_utilization": [
                    ("ix_faculty_utilization_batch_id", ["batch_id"]),
                    ("ix_faculty_utilization_training_session_id", ["training_session_id"]),
                    ("ix_faculty_utilization_faculty_name", ["faculty_name"]),
                    ("ix_faculty_utilization_date_of_training", ["date_of_training"]),
                    ("ix_faculty_utilization_status", ["status"]),
                    ("ix_faculty_utilization_program_type_id", ["program_type_id"]),
                    ("ix_faculty_utilization_faculty_type_id", ["faculty_type_id"]),
                ],
            }

            inspector = inspect(conn)
            for table_name, columns in schema_columns.items():
                if not inspector.has_table(table_name):
                    continue
                existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
                for column_name, definition in columns.items():
                    if column_name not in existing_columns:
                        conn.execute(text(
                            f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {definition}'
                        ))

            for table_name, index_specs in expected_indexes.items():
                if not inspector.has_table(table_name):
                    continue
                existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
                for index_name, index_columns in index_specs:
                    if index_name in existing_indexes:
                        continue
                    column_list = ", ".join(f'"{c}"' for c in index_columns)
                    conn.execute(text(
                        f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table_name}" ({column_list})'
                    ))
            conn.commit()
    except Exception as e:
        print(f"Note: Column migration check returned: {e}")

    if db is None:
        db = SessionLocal()

    try:
        # Seed Standard System Roles Only
        default_roles = [
            {"name": "Admin", "system_role": "Admin"},
            {"name": "Manager", "system_role": "Manager"},
            {"name": "Coordinator", "system_role": "Coordinator"},
            {"name": "Sales", "system_role": "Sales"},
            {"name": "Faculty", "system_role": "Faculty"},
        ]

        for r_spec in default_roles:
            role_obj = db.query(Role).filter(Role.name == r_spec["name"]).first()
            if not role_obj:
                role_obj = Role(
                    name=r_spec["name"],
                    system_role=r_spec["system_role"],
                    is_active=True
                )
                db.add(role_obj)

        # Seed Default Teams (Delivery, Sales, Finance by default under Ops department)
        default_teams = [
            {"name": "Delivery", "department": "Ops", "description": "Batch Delivery & Training Operations Team"},
            {"name": "Sales", "department": "Ops", "description": "Enterprise Accounts & Sales Operations Team"},
            {"name": "Finance", "department": "Ops", "description": "Financial Approvals, Invoicing & Billing Team"},
        ]
        for t_spec in default_teams:
            team_obj = db.query(Team).filter(Team.name == t_spec["name"]).first()
            if not team_obj:
                team_obj = Team(
                    name=t_spec["name"],
                    department=t_spec["department"],
                    description=t_spec["description"],
                    is_active=True
                )
                db.add(team_obj)

        default_options = [
            (BatchCategory, ["Bootcamp", "RBT", "PJP", "Workshop"]),
            (DeliveryMode, ["Online", "F2F", "Blended"]),
            (Accommodation, ["Residential", "Non-Residential"]),
            (Entity, ["Unext", "Unext BSFI"]),
            (Vertical, ["CG&O", "DS/ITES", "ET/BFSI", "ET/ITES", "ET/Merittrac", "IT/ITES"]),
            (ProgramType, ["RBT", "Bootcamp", "RGT"]),
            (FacultyType, ["Internal Full-time", "External Consultant", "HOP"]),
        ]
        for option_model, names in default_options:
            for name in names:
                if not db.query(option_model).filter(option_model.name == name).first():
                    db.add(option_model(name=name, is_active=True))

        if not db.query(ApprovalConfiguration).first():
            db.add(ApprovalConfiguration())

        db.commit()
        print("Database schema initialized and base roles configured (zero demo data).")
    except Exception as e:
        db.rollback()
        print(f"Error initializing database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
