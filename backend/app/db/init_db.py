import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, UserManagerMapping
from app.models.batch import Batch


def init_db(db: Session = None) -> None:
    """Creates tables if not exist and seeds initial development dataset with default admin and demo batches."""
    Base.metadata.create_all(bind=engine)

    if db is None:
        db = SessionLocal()

    try:
        # 1. Seed Default System Users
        admin = db.query(User).filter(User.email == "admin@enterprise-ops.com").first()
        if not admin:
            admin = User(
                email="admin@enterprise-ops.com",
                hashed_password=get_password_hash("Admin@12345"),
                full_name="Operations System Administrator",
                role="Admin",
                is_active=True
            )
            db.add(admin)

        manager = db.query(User).filter(User.email == "manager@enterprise-ops.com").first()
        if not manager:
            manager = User(
                email="manager@enterprise-ops.com",
                hashed_password=get_password_hash("Manager@12345"),
                full_name="Priya Sharma (Delivery Manager)",
                role="Manager",
                is_active=True
            )
            db.add(manager)

        coord = db.query(User).filter(User.email == "coordinator@enterprise-ops.com").first()
        if not coord:
            coord = User(
                email="coordinator@enterprise-ops.com",
                hashed_password=get_password_hash("Coord@12345"),
                full_name="Rahul Verma (Operations Coordinator)",
                role="Coordinator",
                is_active=True
            )
            db.add(coord)

        sales = db.query(User).filter(User.email == "sales@enterprise-ops.com").first()
        if not sales:
            sales = User(
                email="sales@enterprise-ops.com",
                hashed_password=get_password_hash("Sales@12345"),
                full_name="Ananya Roy (Enterprise Sales SPOC)",
                role="Sales",
                is_active=True
            )
            db.add(sales)

        db.flush()

        # 2. Map Coordinator to Manager
        if manager and coord:
            mapping = db.query(UserManagerMapping).filter(
                UserManagerMapping.coordinator_id == coord.id,
                UserManagerMapping.manager_id == manager.id
            ).first()
            if not mapping:
                db.add(UserManagerMapping(coordinator_id=coord.id, manager_id=manager.id))

        # 3. Seed Realistic Active Batches
        now = datetime.now(timezone.utc)
        sample_batches_data = [
            {
                "batch_id": "DTA_PysparkScala_SOW56_ILT_B2",
                "approval_id": "SOW-2026-DEL-089",
                "client_name": "Deloitte USI",
                "category": "Bootcamp",
                "residential_type": "NR",
                "domain": "IT/ITES",
                "program_name": "Enterprise Big Data & PySpark Scala Immersion",
                "technology": "PySpark, Scala, Databricks, Delta Lake",
                "delivery_mode": "Blended",
                "location_city": "Bengaluru",
                "start_date": now - timedelta(days=10),
                "end_date": now + timedelta(days=20),
                "batch_request_date": now - timedelta(days=25),
                "training_days": 20,
                "calendar_days": 30,
                "total_hours": Decimal("160.00"),
                "total_enrollments": 45,
                "residential_enrollments": 0,
                "non_residential_enrollments": 45,
                "status": "Ongoing",
                "primary_manager_id": manager.id,
                "coordinator_id": coord.id,
                "sales_spoc_id": sales.id,
                "faculty_assigned_text": "Nagabhushan / Srinivas P",
                "finance_status": "Cleared",
                "batch_avg_feedback": Decimal("4.82"),
                "total_feedback_score": Decimal("86.76"),
                "is_schema_locked": True,
                "remarks": "Mid-term evaluation conducted. Positive client response.",
            },
            {
                "batch_id": "IBM_FullStackCloud_2026_B1",
                "approval_id": "SOW-IBM-EXP-441",
                "client_name": "IBM India",
                "category": "Bootcamp",
                "residential_type": "R",
                "domain": "Cloud",
                "program_name": "Graduate Engineer Cloud Native & Spring Boot Bootcamp",
                "technology": "Java 21, Spring Boot, Microservices, Docker, AWS",
                "delivery_mode": "F2F",
                "location_city": "Hyderabad",
                "start_date": now + timedelta(days=5),
                "end_date": now + timedelta(days=45),
                "batch_request_date": now - timedelta(days=15),
                "training_days": 30,
                "calendar_days": 40,
                "total_hours": Decimal("240.00"),
                "total_enrollments": 60,
                "residential_enrollments": 60,
                "non_residential_enrollments": 0,
                "status": "Approved",
                "primary_manager_id": manager.id,
                "coordinator_id": coord.id,
                "sales_spoc_id": sales.id,
                "faculty_assigned_text": "Kiran Shankar / Priya Shetty",
                "finance_status": "Invoiced",
                "is_schema_locked": True,
                "remarks": "Classrooms booked at Hyderabad campus. Hardware provisioned.",
            },
            {
                "batch_id": "CAPG_GenAI_LLMOps_2026_Q1",
                "approval_id": None,
                "client_name": "Capgemini",
                "category": "Workshop",
                "residential_type": "NR",
                "domain": "DS/ML",
                "program_name": "Generative AI & LLMOps Architecture Masterclass",
                "technology": "LangChain, LlamaIndex, OpenAI, vLLM, Vector DBs",
                "delivery_mode": "Online",
                "location_city": "Remote",
                "start_date": now + timedelta(days=14),
                "end_date": now + timedelta(days=21),
                "batch_request_date": now - timedelta(days=2),
                "training_days": 5,
                "calendar_days": 7,
                "total_hours": Decimal("40.00"),
                "total_enrollments": 35,
                "residential_enrollments": 0,
                "non_residential_enrollments": 35,
                "status": "Requested",
                "primary_manager_id": None,
                "coordinator_id": coord.id,
                "sales_spoc_id": sales.id,
                "faculty_assigned_text": "Dr. Ronak Dave",
                "finance_status": "Pending",
                "is_schema_locked": False,
                "remarks": "Awaiting Manager Approval for SOW rate card sign-off.",
            },
            {
                "batch_id": "SOCIETE_DevSecOps_B4",
                "approval_id": "SOW-SOCGEN-99",
                "client_name": "Societe Generale",
                "category": "RBT",
                "residential_type": "NR",
                "domain": "CyberSecurity",
                "program_name": "Enterprise DevSecOps & Kubernetes Security",
                "technology": "Kubernetes, Terraform, Vault, SonarQube, GitHub Actions",
                "delivery_mode": "Online",
                "location_city": "Bengaluru",
                "start_date": now - timedelta(days=40),
                "end_date": now - timedelta(days=10),
                "batch_request_date": now - timedelta(days=60),
                "training_days": 20,
                "calendar_days": 30,
                "total_hours": Decimal("160.00"),
                "total_enrollments": 28,
                "residential_enrollments": 0,
                "non_residential_enrollments": 28,
                "status": "Completed",
                "primary_manager_id": manager.id,
                "coordinator_id": coord.id,
                "sales_spoc_id": sales.id,
                "faculty_assigned_text": "Manjunath Reddy",
                "finance_status": "Cleared",
                "batch_avg_feedback": Decimal("4.91"),
                "total_feedback_score": Decimal("137.48"),
                "batch_nps": Decimal("9.40"),
                "retrospective_notes": "Successfully completed with 98% attendance and 4.91 feedback score.",
                "is_schema_locked": True,
                "remarks": "Gate 2 NPS Closure completed.",
            },
            {
                "batch_id": "FRACTAL_DataEngg_Airflow_B1",
                "approval_id": None,
                "client_name": "Fractal Analytics",
                "category": "PJP",
                "residential_type": "NR",
                "domain": "IT/ITES",
                "program_name": "Advanced Data Pipelines with Apache Airflow & Snowflake",
                "technology": "Python, Airflow, Snowflake, dbt",
                "delivery_mode": "Online",
                "location_city": "Mumbai",
                "start_date": now + timedelta(days=25),
                "end_date": now + timedelta(days=55),
                "batch_request_date": now - timedelta(days=1),
                "training_days": 15,
                "calendar_days": 30,
                "total_hours": Decimal("120.00"),
                "total_enrollments": 50,
                "residential_enrollments": 0,
                "non_residential_enrollments": 50,
                "status": "Requested",
                "primary_manager_id": None,
                "coordinator_id": coord.id,
                "sales_spoc_id": sales.id,
                "faculty_assigned_text": "Anala Kumar",
                "finance_status": "Pending",
                "is_schema_locked": False,
                "remarks": "Curriculum customized for Snowflake data warehouse migration.",
            }
        ]

        for b_data in sample_batches_data:
            existing_b = db.query(Batch).filter(Batch.batch_id == b_data["batch_id"]).first()
            if not existing_b:
                b_obj = Batch(**b_data)
                db.add(b_obj)

        db.commit()
        print("Database initialization and initial dataset seeding completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
