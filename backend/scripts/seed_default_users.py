"""Create or synchronize the default operations user hierarchy.

Set DEFAULT_USER_PASSWORD to a temporary password before running this script.
Existing users keep their current passwords.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import Role, Team, User


DEFAULT_USERS = (
    ("Ravish", "Manager", "Delivery", None),
    ("Manjunath", "Manager", "Delivery", "Ravish"),
    ("Charan", "Coordinator", "Delivery", "Manjunath"),
    ("Pradeep", "Coordinator", "Delivery", "Manjunath"),
    ("Krishna", "Manager", "Delivery", "Ravish"),
    ("Ramesh", "Coordinator", "Delivery", "Krishna"),
    ("Bhavy", "Coordinator", "Delivery", "Krishna"),
    ("Rajesh", "Manager", "Finance", "Ravish"),
)


def main() -> int:
    password = os.getenv("DEFAULT_USER_PASSWORD")
    if not password or len(password) < 8:
        print("Error: DEFAULT_USER_PASSWORD must contain at least 8 characters", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        roles = {}
        for role_name in {role for _, role, _, _ in DEFAULT_USERS}:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, system_role=role_name, is_active=True)
                db.add(role)
                db.flush()
            else:
                role.system_role = role_name
                role.is_active = True
            roles[role_name] = role

        teams = {}
        for team_name in {team for _, _, team, _ in DEFAULT_USERS}:
            team = db.query(Team).filter(Team.name == team_name).first()
            if not team:
                team = Team(name=team_name, department="Ops", is_active=True)
                db.add(team)
                db.flush()
            else:
                team.is_active = True
            teams[team_name] = team

        users = {}
        password_hash = get_password_hash(password)
        for full_name, role_name, team_name, manager_name in DEFAULT_USERS:
            email = f"{full_name.lower()}@example.com"
            user = db.query(User).filter(User.email == email).first()
            action = "Created" if user is None else "Updated"
            if user is None:
                user = User(
                    email=email,
                    hashed_password=password_hash,
                    full_name=full_name,
                    role=role_name,
                    role_id=roles[role_name].id,
                    team_id=teams[team_name].id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
            user.full_name = full_name
            user.role = role_name
            user.role_id = roles[role_name].id
            user.team_id = teams[team_name].id
            user.is_active = True
            if action == "Created":
                user.hashed_password = password_hash
            users[full_name] = user
            print(f"{action} {email} ({role_name}, {team_name})")

        for full_name, _, _, manager_name in DEFAULT_USERS:
            users[full_name].manager_id = users[manager_name].id if manager_name else None

        db.commit()
        print("Default user hierarchy synchronized successfully.")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
