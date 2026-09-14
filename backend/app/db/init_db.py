from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import SessionLocal, Base, engine
from app.models.user import User, UserManagerMapping, Role, Team
from app.models.batch import (
    Accommodation,
    ApprovalConfiguration,
    Batch,
    BatchCategory,
    DeliveryMode,
    Entity,
)
from app.models.session import TrainingSession


def init_db(db: Session = None) -> None:
    """Creates database schema tables, ensures migration columns exist, and seeds base roles without demo data."""
    Base.metadata.create_all(bind=engine)

    # Auto-migrate schema columns if tables were created previously
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;"))
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
            (Entity, ["Default"]),
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
