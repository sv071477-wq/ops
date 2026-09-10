"""Create or update an administrator account.

Examples:
    python scripts/create_admin.py --email admin@example.com
    python scripts/create_admin.py --email admin@example.com --password-file .admin-password

The password is prompted securely when --password-file and ADMIN_PASSWORD are
not provided. Do not commit password files or place passwords in source code.
"""

import argparse
import getpass
import os
import sys
from pathlib import Path


# Allow this script to be run from backend/ without installing the app package.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.user import User  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update an admin user")
    parser.add_argument(
        "--email",
        default=os.getenv("ADMIN_EMAIL", "admin@enterprise-ops.com"),
        help="Admin email address (default: ADMIN_EMAIL or admin@enterprise-ops.com)",
    )
    parser.add_argument(
        "--full-name",
        default=os.getenv("ADMIN_FULL_NAME", "Operations System Administrator"),
        help="Admin display name",
    )
    parser.add_argument(
        "--password-file",
        type=Path,
        help="Read the password from a local file without echoing it",
    )
    return parser.parse_args()


def read_password(password_file: Path | None) -> str:
    if password_file:
        password = password_file.read_text(encoding="utf-8").strip()
    else:
        password = os.getenv("ADMIN_PASSWORD")
        if password is None:
            password = getpass.getpass("Admin password: ")

    if len(password) < 8:
        raise ValueError("Admin password must contain at least 8 characters")
    return password


def main() -> int:
    args = parse_args()

    if "@" not in args.email or not args.email.strip():
        print("Error: provide a valid admin email address", file=sys.stderr)
        return 2

    try:
        password = read_password(args.password_file)
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == args.email.lower().strip()).first()
        if admin is None:
            admin = User(email=args.email.lower().strip())
            db.add(admin)
            action = "Created"
        else:
            action = "Updated"

        admin.full_name = args.full_name.strip()
        admin.role = "Admin"
        admin.is_active = True
        admin.hashed_password = get_password_hash(password)
        db.commit()
        print(f"{action} admin account: {admin.email}")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())