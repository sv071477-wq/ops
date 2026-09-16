from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.session import TrainingSession
from app.models.batch import Batch
from app.schemas.faculty import (
    FacultyResponse,
    FacultyUtilizationOverview,
    DomainUtilization,
)


class FacultyService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, faculty_type: Optional[str] = None, domain: Optional[str] = None) -> List[FacultyResponse]:
        query = self.db.query(User).filter(
            User.role.ilike("faculty"),
            User.is_active == True,
        )
        faculty_users = query.order_by(User.full_name.asc()).all()

        results = []
        for fac in faculty_users:
            results.append(FacultyResponse(
                id=fac.id,
                full_name=fac.full_name,
                email=fac.email,
                role="Faculty",
                faculty_type=faculty_type or "Internal Full-time",
                domain=domain or "IT/ITES",
                is_active=fac.is_active,
                created_at=fac.created_at,
            ))
        return results

    def utilization(self) -> FacultyUtilizationOverview:
        faculty_users = self.db.query(User).filter(
            User.role.ilike("faculty"),
            User.is_active == True,
        ).all()
        total_faculty = len(faculty_users)

        deployed_rows = self.db.query(TrainingSession.faculty_id).filter(
            TrainingSession.status.notin_(["Cancelled"])
        ).distinct().all()
        deployed_ids = {row[0] for row in deployed_rows if row[0]}
        active_deployed = len(deployed_ids.intersection({f.id for f in faculty_users}))

        if total_faculty > 0:
            utilization_pct = Decimal(str(round((active_deployed / total_faculty) * 100, 1)))
        else:
            utilization_pct = Decimal("100.0")

        # Compute breakdown by domain across batches and sessions
        domains = ["IT/ITES", "Cloud", "DS/ML", "CyberSecurity", "FullStack"]
        breakdown = []
        for d in domains:
            domain_sessions = self.db.query(TrainingSession).join(
                Batch, TrainingSession.batch_id == Batch.id
            ).filter(
                Batch.domain.ilike(f"%{d}%"),
                TrainingSession.status.notin_(["Cancelled"])
            ).all()

            fac_in_domain = len({s.faculty_id for s in domain_sessions if s.faculty_id})
            hours = sum((s.no_of_hours for s in domain_sessions), Decimal("0.0"))
            breakdown.append(DomainUtilization(
                domain=d,
                faculty_count=fac_in_domain,
                hours_scheduled=hours,
            ))

        return FacultyUtilizationOverview(
            total_faculty_count=total_faculty,
            active_deployed_faculty=active_deployed,
            overall_utilization_percentage=utilization_pct,
            domain_breakdown=breakdown,
        )