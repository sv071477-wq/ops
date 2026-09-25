#!/usr/bin/env python3
"""
=============================================================================
  OPS PLATFORM — REAL ENTERPRISE DATA INGESTION SCRIPT
=============================================================================
  Imports authentic production data directly from:
    1. project_data/1.MBR_Active Batches.xlsx (Sheet1)
    2. project_data/Faculty_Utilisation - Ver 2.0.xlsx

  Replaces synthetic/dummy demo data with actual enterprise clients,
  programs, managers, coordinators, faculty, batches, and sessions.
=============================================================================
"""

import sys
import os
import uuid
import re
from datetime import datetime, timezone, date, time
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import openpyxl
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.user import User, Role, Team, UserManagerMapping
from app.models.batch import (
    Batch, BatchCategory, DeliveryMode, Accommodation, Entity, ApprovalConfiguration
)
from app.models.session import TrainingSession, FacultyUtilization

MBR_FILE = Path("/app/project_data/1.MBR_Active Batches.xlsx")
FACULTY_FILE = Path("/app/project_data/Faculty_Utilisation - Ver 2.0.xlsx")

# Use strong password from environment
IMPORT_PASSWORD = os.getenv("IMPORT_DATA_PASSWORD") or "Import@SecurePass2024!"

def uid():
    return uuid.uuid4()

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return None if s.lower() in ("none", "nan", "null", "") else s

def clean_int(val, default=0):
    if val is None:
        return default
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return default

def clean_dec(val, default=Decimal("0.00")):
    if val is None:
        return default
    try:
        f = float(str(val).strip())
        return Decimal(str(round(f, 2)))
    except (ValueError, TypeError):
        return default

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day, 9, 0, 0, tzinfo=timezone.utc)
    s = str(val).strip()
    if not s or s.lower() in ("none", "nan", "null"):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y"):
        try:
            d = datetime.strptime(s, fmt)
            return d.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None

def normalize_status(raw_status, start_dt, end_dt, now_dt):
    s = str(raw_status).strip().lower() if raw_status else ""
    if "cancel" in s:
        return "Cancelled"
    if "hold" in s or "postpone" in s:
        return "OnHold"
    if "complete" in s:
        return "Completed"
    if "ongoing" in s:
        return "Ongoing"
    if "upcoming" in s:
        return "Upcoming"
    if "request" in s:
        return "Requested"
    if "approv" in s:
        return "Approved"
    
    # Fallback to date-based
    if end_dt and end_dt < now_dt:
        return "Completed"
    if start_dt and end_dt and start_dt <= now_dt <= end_dt:
        return "Ongoing"
    if start_dt and start_dt > now_dt:
        return "Upcoming"
    return "Completed"

def main():
    print("=" * 65)
    print("  OPS PLATFORM — REAL ENTERPRISE DATA INGESTION")
    print("=" * 65)

    if not MBR_FILE.exists():
        print(f"Error: {MBR_FILE} not found!")
        return
    if not FACULTY_FILE.exists():
        print(f"Error: {FACULTY_FILE} not found!")
        return

    db = SessionLocal()
    now_utc = datetime.now(timezone.utc)

    try:
        # ── 1. Taxonomy & Options ──────────────────────────────────────────
        print("\n[1/6] Loading & syncing taxonomies...")
        categories = {c.name.lower(): c for c in db.query(BatchCategory).all()}
        modes = {m.name.lower(): m for m in db.query(DeliveryMode).all()}
        entities = {e.name.lower(): e for e in db.query(Entity).all()}

        # Ensure standard options
        for cat_name in ["Bootcamp", "RBT", "PJP", "Workshop", "EPGMAI", "WILP", "IPBA"]:
            if cat_name.lower() not in categories:
                c = BatchCategory(id=uid(), name=cat_name, is_active=True)
                db.add(c)
                db.flush()
                categories[cat_name.lower()] = c

        for mode_name in ["Online", "F2F", "Blended"]:
            if mode_name.lower() not in modes:
                m = DeliveryMode(id=uid(), name=mode_name, is_active=True)
                db.add(m)
                db.flush()
                modes[mode_name.lower()] = m

        for ent_name in ["Unext", "Unext BSFI", "Jigsaw", "ET/ITeS"]:
            if ent_name.lower() not in entities:
                e = Entity(id=uid(), name=ent_name, is_active=True)
                db.add(e)
                db.flush()
                entities[ent_name.lower()] = e

        manager_role = db.query(Role).filter(Role.system_role == "Manager").first()
        coord_role = db.query(Role).filter(Role.system_role == "Coordinator").first()
        faculty_role = db.query(Role).filter(Role.system_role == "Faculty").first()
        admin_role = db.query(Role).filter(Role.system_role == "Admin").first()
        sales_role = db.query(Role).filter(Role.system_role == "Sales").first()

        delivery_team = db.query(Team).filter(Team.name == "Delivery").first()
        finance_team = db.query(Team).filter(Team.name == "Finance").first()
        sales_team = db.query(Team).filter(Team.name == "Sales").first()

        # ── 2. Create Real Operations Staff & Hierarchy ─────────────────────
        print("\n[2/6] Setting up real operations management hierarchy...")
        pwd_hash = get_password_hash(IMPORT_PASSWORD)

        # Top Executive Manager
        ravish = db.query(User).filter(User.email == "ravish@enterprise-ops.com").first()
        if not ravish:
            ravish = User(
                id=uid(), email="ravish@enterprise-ops.com", full_name="Ravish",
                role="Manager", role_id=manager_role.id, team_id=delivery_team.id,
                is_active=True, hashed_password=pwd_hash
            )
            db.add(ravish)
            db.flush()

        # Managers under Ravish
        managers_data = [
            ("Manjunath Reddy", "manjunath.reddy@enterprise-ops.com", "Delivery Operations Manager", delivery_team),
            ("Krishna Kumari Shetty", "krishna.shetty@enterprise-ops.com", "Delivery Operations Manager", delivery_team),
            ("Pulikeshi M", "pulikeshi.m@enterprise-ops.com", "Bootcamp Operations Lead", delivery_team),
            ("Lokesh Kumar", "lokesh.kumar@enterprise-ops.com", "Enterprise Delivery Lead", delivery_team),
            ("Rajesh Kumar", "rajesh.kumar@enterprise.com", "Finance Operations Manager", finance_team),
        ]
        mgr_map = {"ravish": ravish}
        for name, email, title, team in managers_data:
            mgr = db.query(User).filter(User.email == email).first()
            if not mgr:
                mgr = User(
                    id=uid(), email=email, full_name=name,
                    role="Manager", role_id=manager_role.id, team_id=team.id,
                    manager_id=ravish.id, is_active=True, hashed_password=pwd_hash
                )
                db.add(mgr)
                db.flush()
            mgr_map[name.lower()] = mgr
            # link mapping
            exists_m = db.query(UserManagerMapping).filter(
                UserManagerMapping.coordinator_id == mgr.id,
                UserManagerMapping.manager_id == ravish.id
            ).first()
            if not exists_m:
                db.add(UserManagerMapping(id=uid(), coordinator_id=mgr.id, manager_id=ravish.id))

        # Coordinators and their manager links
        coordinators_data = [
            ("Charan", "charan@enterprise-ops.com", "manjunath reddy"),
            ("Pradeep", "pradeep@enterprise-ops.com", "manjunath reddy"),
            ("Shushma", "shushma@enterprise-ops.com", "manjunath reddy"),
            ("Ramya N", "ramya.n@enterprise-ops.com", "manjunath reddy"),
            ("Bhavya K", "bhavya.k@enterprise-ops.com", "krishna kumari shetty"),
            ("Ramesh", "ramesh@enterprise-ops.com", "krishna kumari shetty"),
            ("Bhavy", "bhavy@enterprise-ops.com", "krishna kumari shetty"),
            ("Sneha M P", "sneha.mp@enterprise-ops.com", "pulikeshi m"),
            ("Nitin Kumar", "nitin.kumar@enterprise-ops.com", "pulikeshi m"),
            ("Manfred", "manfred@enterprise-ops.com", "lokesh kumar"),
            ("Ramya S", "ramya.s@enterprise-ops.com", "lokesh kumar"),
            ("Priya Shetty", "priya.shetty@enterprise-ops.com", "ravish"),
            ("Shabaresh", "shabaresh@enterprise-ops.com", "ravish"),
            ("Deepak Narendra", "deepak.narendra@enterprise-ops.com", "ravish"),
            ("Bnil Nath", "bnil.nath@enterprise-ops.com", "ravish"),
            ("Renuk Prasad", "renuk.prasad@enterprise-ops.com", "ravish"),
            ("Kiran Shankar", "kiran.shankar@enterprise-ops.com", "ravish"),
            ("Anala B", "anala.b@enterprise-ops.com", "ravish"),
            ("Poornima", "poornima@enterprise-ops.com", "ravish"),
        ]
        coord_map = {}
        for cname, cemail, mname in coordinators_data:
            c_user = db.query(User).filter(User.email == cemail).first()
            parent_mgr = mgr_map.get(mname, ravish)
            if not c_user:
                c_user = User(
                    id=uid(), email=cemail, full_name=cname,
                    role="Coordinator", role_id=coord_role.id, team_id=delivery_team.id,
                    manager_id=parent_mgr.id, is_active=True, hashed_password=pwd_hash
                )
                db.add(c_user)
                db.flush()
            else:
                c_user.manager_id = parent_mgr.id
            coord_map[cname.lower()] = c_user

            exists_map = db.query(UserManagerMapping).filter(
                UserManagerMapping.coordinator_id == c_user.id,
                UserManagerMapping.manager_id == parent_mgr.id
            ).first()
            if not exists_map:
                db.add(UserManagerMapping(id=uid(), coordinator_id=c_user.id, manager_id=parent_mgr.id))

        # Admin user
        admin = db.query(User).filter(User.email == "admin@enterprise-ops.com").first()
        if not admin:
            admin = User(
                id=uid(), email="admin@enterprise-ops.com", full_name="System Administrator",
                role="Admin", role_id=admin_role.id, team_id=delivery_team.id,
                is_active=True, hashed_password=get_password_hash(IMPORT_PASSWORD)
            )
            db.add(admin)
            db.flush()

        db.commit()
        print(f"   ✓ Configured {len(mgr_map)} Managers and {len(coord_map)} Coordinators with real reporting lines.")

        # ── 3. Parse & Create Real Faculty ─────────────────────────────────
        print("\n[3/6] Extracting real faculty roster from Faculty_Utilisation - Ver 2.0.xlsx...")
        wb_fac = openpyxl.load_workbook(str(FACULTY_FILE), read_only=True)
        faculty_users = {}

        # Scan active sheet and Master for faculty names
        sheets_to_scan = [s for s in ["Master", wb_fac.sheetnames[0]] if s in wb_fac.sheetnames]
        raw_fac_names = set()

        for sheet_name in sheets_to_scan:
            ws = wb_fac[sheet_name]
            for row in ws.iter_rows(values_only=True):
                if not row or len(row) < 10:
                    continue
                name = row[9]
                if name and isinstance(name, str):
                    clean_n = name.strip()
                    if clean_n and len(clean_n) > 2 and clean_n.lower() not in ("faculty full name", "none", "nan"):
                        raw_fac_names.add(clean_n)

        print(f"   Found {len(raw_fac_names)} unique faculty instructor names.")
        used_emails = {u.email.lower() for u in db.query(User.email).all()}
        created_fac_count = 0
        for fname in sorted(raw_fac_names):
            base_slug = re.sub(r'[^a-zA-Z0-9]+', '.', fname).strip('.').lower()
            if not base_slug:
                base_slug = "faculty"
            f_email = f"{base_slug}@enterprise-faculty.com"
            counter = 2
            while f_email.lower() in used_emails:
                f_email = f"{base_slug}{counter}@enterprise-faculty.com"
                counter += 1
            used_emails.add(f_email.lower())

            f_user = db.query(User).filter(User.email == f_email).first()
            if not f_user:
                f_user = User(
                    id=uid(), email=f_email, full_name=fname,
                    role="Faculty", role_id=faculty_role.id, is_active=True,
                    hashed_password=pwd_hash
                )
                db.add(f_user)
                created_fac_count += 1
            faculty_users[fname.lower()] = f_user

        db.flush()
        print(f"   ✓ Synchronized {len(faculty_users)} faculty accounts in system.")

        # ── 4. Import Real Batches ─────────────────────────────────────────
        print("\n[4/6] Ingesting real client batches from 1.MBR_Active Batches.xlsx...")
        wb_mbr = openpyxl.load_workbook(str(MBR_FILE), read_only=True)
        ws_mbr = wb_mbr['Sheet1'] if 'Sheet1' in wb_mbr.sheetnames else wb_mbr.active

        existing_batches = {b.batch_id.lower(): b for b in db.query(Batch).all()}
        batch_objects = {}
        inserted_batches = 0
        updated_batches = 0

        # Helper to match coordinator & manager
        def resolve_batch_staff(coord_raw):
            if not coord_raw:
                # default round-robin
                mgr = list(mgr_map.values())[0]
                coord = list(coord_map.values())[0]
                return mgr, coord
            c_str = str(coord_raw).lower()
            matched_coord = None
            for key, c in coord_map.items():
                if key in c_str:
                    matched_coord = c
                    break
            matched_mgr = None
            for key, m in mgr_map.items():
                if key in c_str:
                    matched_mgr = m
                    break
            if matched_coord and not matched_mgr:
                matched_mgr = db.get(User, matched_coord.manager_id) if matched_coord.manager_id else ravish
            if not matched_mgr:
                matched_mgr = ravish
            if not matched_coord:
                matched_coord = coord_map.get("priya shetty", list(coord_map.values())[0])
            return matched_mgr, matched_coord

        for i, row in enumerate(ws_mbr.iter_rows(values_only=True)):
            if i == 0 or not row:
                continue
            b_id_raw = row[10] if len(row) > 10 else None
            if not b_id_raw or str(b_id_raw).strip().lower() in ("none", "nan", ""):
                continue
            batch_id_str = str(b_id_raw).strip()

            client = clean_str(row[6]) if len(row) > 6 else None
            prog = clean_str(row[9]) if len(row) > 9 else None or f"{client or 'Enterprise'} Program"
            tech = clean_str(row[11]) if len(row) > 11 else None
            domain = clean_str(row[3]) if len(row) > 3 else "IT/ITES"
            cat_str = clean_str(row[4]) if len(row) > 4 else "Bootcamp"
            mode_str = clean_str(row[5]) if len(row) > 5 else "Online"
            city = clean_str(row[2]) if len(row) > 2 else "Bengaluru"
            start_d = parse_date(row[12]) if len(row) > 12 else None
            end_d = parse_date(row[13]) if len(row) > 13 else None
            enroll = clean_int(row[14] if len(row) > 14 else 0, 0)
            fb = clean_dec(row[17] if len(row) > 17 else None, None)
            nps = clean_dec(row[19] if len(row) > 19 else None, None)
            raw_stat = row[20] if len(row) > 20 else None
            coord_raw = row[21] if len(row) > 21 else None
            t_days = clean_int(row[25] if len(row) > 25 else 0, 0)
            fac_assigned = clean_str(row[26]) if len(row) > 26 else None
            sow = clean_str(row[1]) if len(row) > 1 else None

            stat = normalize_status(raw_stat, start_d, end_d, now_utc)
            mgr_obj, coord_obj = resolve_batch_staff(coord_raw)

            # Match mode & cat
            mode_match = modes.get(mode_str.lower() if mode_str else "online", modes.get("online"))
            cat_match = categories.get(cat_str.lower() if cat_str else "bootcamp", categories.get("bootcamp"))
            tot_hours = Decimal(str(t_days * 8)) if t_days > 0 else Decimal("40.00")

            b = existing_batches.get(batch_id_str.lower())
            if not b:
                b = Batch(
                    id=uid(),
                    batch_id=batch_id_str,
                    approval_id=sow,
                    sow_number=sow,
                    program_name=prog,
                    client_name=client,
                    technology=tech,
                    domain=domain,
                    category=cat_str or "Bootcamp",
                    category_id=cat_match.id if cat_match else None,
                    delivery_mode_id=mode_match.id if mode_match else None,
                    location_city=city,
                    start_date=start_d,
                    end_date=end_d,
                    total_enrollments=enroll,
                    training_days=t_days,
                    total_hours=tot_hours,
                    batch_avg_feedback=fb,
                    batch_nps=nps,
                    status=stat,
                    primary_manager_id=mgr_obj.id if mgr_obj else None,
                    coordinator_id=coord_obj.id if coord_obj else None,
                    faculty_assigned_text=fac_assigned,
                    finance_status="Cleared" if stat == "Completed" else "Pending",
                    created_at=start_d or now_utc,
                )
                db.add(b)
                existing_batches[batch_id_str.lower()] = b
                inserted_batches += 1
            else:
                b.program_name = prog
                b.client_name = client
                b.technology = tech
                b.domain = domain
                b.start_date = start_d
                b.end_date = end_d
                b.total_enrollments = enroll
                b.batch_avg_feedback = fb
                b.batch_nps = nps
                b.status = stat
                b.primary_manager_id = mgr_obj.id if mgr_obj else b.primary_manager_id
                b.coordinator_id = coord_obj.id if coord_obj else b.coordinator_id
                updated_batches += 1

            batch_objects[batch_id_str.lower()] = b

        db.flush()
        print(f"   ✓ Ingested {inserted_batches} new batches and updated {updated_batches} batches from MBR Sheet1.")

        # ── 5. Import Real 2025-2026 Batches & Sessions from Faculty Utilisation ──
        print("\n[5/6] Ingesting real sessions & 2025-2026 batches from Faculty_Utilisation Master sheet...")
        ws_master = wb_fac['Master'] if 'Master' in wb_fac.sheetnames else wb_fac[wb_fac.sheetnames[0]]
        sess_inserted = 0

        # Also purge any legacy DTA dummy batches if present
        dta_deleted = db.query(Batch).filter(Batch.batch_id.like("DTA_%")).delete(synchronize_session=False)
        if dta_deleted:
            print(f"   ✓ Purged {dta_deleted} legacy dummy DTA batches.")

        batch_dates_map = {}

        for row in ws_master.iter_rows(values_only=True):
            if not row or len(row) < 13:
                continue
            b_id_raw = row[6]
            fac_raw = row[9]
            dt_raw = row[7]
            if not b_id_raw or not fac_raw or not dt_raw:
                continue

            dt = parse_date(dt_raw)
            if not dt or dt.year < 2025:
                continue

            b_id_str = str(b_id_raw).strip()
            fac_str = str(fac_raw).strip()

            # Track date span for each batch
            if b_id_str.lower() not in batch_dates_map:
                batch_dates_map[b_id_str.lower()] = [dt, dt]
            else:
                if dt < batch_dates_map[b_id_str.lower()][0]:
                    batch_dates_map[b_id_str.lower()][0] = dt
                if dt > batch_dates_map[b_id_str.lower()][1]:
                    batch_dates_map[b_id_str.lower()][1] = dt

            # Ensure batch exists
            b = existing_batches.get(b_id_str.lower())
            if not b:
                client = clean_str(row[4])
                prog = clean_str(row[5]) or f"{client or 'Enterprise'} Program"
                domain = clean_str(row[3]) or "IT/ITES"
                cat_str = clean_str(row[2]) or "RBT"
                mode_str = clean_str(row[16]) if len(row) > 16 else "Online"
                city = clean_str(row[15]) if len(row) > 15 else "Bengaluru"
                coord_raw = row[17] if len(row) > 17 else None
                mgr_obj, coord_obj = resolve_batch_staff(coord_raw)
                mode_match = modes.get(mode_str.lower() if mode_str else "online", modes.get("online"))
                cat_match = categories.get(cat_str.lower() if cat_str else "bootcamp", categories.get("bootcamp"))

                stat = normalize_status(None, dt, dt, now_utc)

                b = Batch(
                    id=uid(),
                    batch_id=b_id_str,
                    program_name=prog,
                    client_name=client,
                    domain=domain,
                    category=cat_str,
                    category_id=cat_match.id if cat_match else None,
                    delivery_mode_id=mode_match.id if mode_match else None,
                    location_city=city,
                    start_date=dt,
                    end_date=dt,
                    total_enrollments=25,
                    training_days=1,
                    total_hours=Decimal("8.00"),
                    status=stat,
                    primary_manager_id=mgr_obj.id if mgr_obj else None,
                    coordinator_id=coord_obj.id if coord_obj else None,
                    finance_status="Cleared" if stat == "Completed" else "Pending",
                    created_at=dt,
                )
                db.add(b)
                db.flush()
                existing_batches[b_id_str.lower()] = b
                batch_objects[b_id_str.lower()] = b
            else:
                # Update batch dates and status if dates expanded
                if b.start_date is None or dt < b.start_date:
                    b.start_date = dt
                if b.end_date is None or dt > b.end_date:
                    b.end_date = dt
                b.status = normalize_status(None, b.start_date, b.end_date, now_utc)

            # Link faculty
            f_user = faculty_users.get(fac_str.lower())
            if not f_user:
                slug = re.sub(r'[^a-zA-Z0-9]+', '.', fac_str).strip('.').lower()
                if not slug:
                    slug = "faculty"
                f_email = f"{slug}@enterprise-faculty.com"
                f_user = db.query(User).filter(User.email == f_email).first()
                if not f_user:
                    counter = 2
                    while db.query(User).filter(User.email == f_email).first():
                        f_email = f"{slug}{counter}@enterprise-faculty.com"
                        counter += 1
                    f_user = User(
                        id=uid(), email=f_email, full_name=fac_str,
                        role="Faculty", role_id=faculty_role.id, is_active=True, hashed_password=pwd_hash
                    )
                    db.add(f_user)
                    db.flush()
                faculty_users[fac_str.lower()] = f_user

            topic = clean_str(row[8]) or "Core Curriculum Delivery"
            hours = clean_dec(row[12], Decimal("8.00"))
            mod_fb = clean_dec(row[13] if len(row) > 13 else None, None)
            venue = clean_str(row[14]) if len(row) > 14 else "Conference Room / Online"
            city = clean_str(row[15]) if len(row) > 15 else b.location_city or "Bengaluru"
            mode_s = clean_str(row[16]) if len(row) > 16 else b.delivery_mode or "Online"

            sess_stat = "Completed" if dt.date() < now_utc.date() else "InProgress" if dt.date() == now_utc.date() else "Scheduled"

            # Check if utilization record exists for this batch, date, and faculty
            exists_util = db.query(FacultyUtilization).filter(
                FacultyUtilization.batch_id == b.id,
                FacultyUtilization.date_of_training == dt,
                FacultyUtilization.faculty_name == f_user.full_name
            ).first()

            if not exists_util:
                util = FacultyUtilization(
                    id=uid(),
                    batch_id=b.id,
                    faculty_name=f_user.full_name,
                    date_of_training=dt,
                    topic=topic,
                    no_of_hours=hours,
                    feedback_rating=mod_fb,
                    feedback_submitted=mod_fb is not None,
                    feedback_notes=f"Delivered topic: {topic}",
                    status=sess_stat,
                    venue=venue,
                    location_city=city,
                    mode_of_delivery=mode_s,
                    created_at=dt,
                )
                db.add(util)
                sess_inserted += 1

                # Also create scheduled training session
                ts = TrainingSession(
                    id=uid(),
                    batch_id=b.id,
                    session_date=dt.date(),
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                    duration_hours=hours,
                    module=topic,
                    trainer_name=f_user.full_name,
                    status=sess_stat,
                    created_at=dt,
                )
                db.add(ts)

            if sess_inserted > 0 and sess_inserted % 500 == 0:
                db.flush()
                print(f"   ... ingested {sess_inserted} sessions so far")

        db.commit()
        print(f"   ✓ Ingested {sess_inserted} real training sessions and faculty utilization entries.")

        # ── 6. Final Summary ───────────────────────────────────────────────
        total_b = db.query(Batch).count()
        total_u = db.query(User).count()
        total_s = db.query(TrainingSession).count()
        total_f = db.query(FacultyUtilization).count()

        print("\n" + "=" * 65)
        print("  ✅ REAL PRODUCTION DATA IMPORT COMPLETE")
        print("=" * 65)
        print(f"  Total Real Batches            : {total_b}")
        print(f"  Total Organization Users      : {total_u}")
        print(f"  Total Training Sessions       : {total_s}")
        print(f"  Total Faculty Utilization Recs: {total_f}")
        print("=" * 65)
        print("  Admin: admin@enterprise-ops.com / AdminPassword123!")
        print("  Staff: ravish@enterprise-ops.com, manjunath.reddy@enterprise-ops.com,")
        print("         krishna.shetty@enterprise-ops.com, pulikeshi.m@enterprise-ops.com,")
        print("         rajesh.kumar@enterprise.com (Password: Demo@1234)")
        print("=" * 65 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during data ingestion: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
