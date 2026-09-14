import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.models.user import Team

def main():
    db = SessionLocal()
    try:
        # Delete old placeholder teams without users
        for old in ['Core Operations', 'Faculty Operations', 'Sales Operations']:
            t = db.query(Team).filter(Team.name == old).first()
            if t:
                db.delete(t)
        db.commit()

        # Desired default teams - all belong to Ops department
        default_teams = [
            ("Delivery", "Ops", "Batch Delivery & Training Operations Team"),
            ("Sales", "Ops", "Enterprise Accounts & Sales Operations Team"),
            ("Finance", "Ops", "Financial Approvals, Invoicing & Billing Team"),
        ]

        for name, dept, desc in default_teams:
            team_obj = db.query(Team).filter(Team.name == name).first()
            if not team_obj:
                team_obj = Team(name=name, department=dept, description=desc, is_active=True)
                db.add(team_obj)
            else:
                team_obj.department = dept
                team_obj.description = desc
                team_obj.is_active = True
        db.commit()

        print("Successfully synchronized default teams:")
        for t in db.query(Team).order_by(Team.name).all():
            print(f"  * {t.name} (Department: {t.department}) - Active: {t.is_active}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
