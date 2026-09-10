from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth.service import AuthFeatureService as AuthService
from app.api.v1.batches.service import BatchFeatureService as BatchService
from app.api.v1.analytics.service import AnalyticsFeatureService as AnalyticsService
from app.api.v1.sessions.service import SessionFeatureService as SessionService
from app.api.v1.faculty.service import FacultyFeatureService as FacultyService
from app.api.v1.fms_sync.service import FmsSyncFeatureService as FmsSyncService
from app.api.v1.schedules.service import ScheduleFeatureService as ExcelIngestionService


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_batch_service(db: Session = Depends(get_db)) -> BatchService:
    return BatchService(db)


def get_analytics_service(db: Session = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


def get_session_service(db: Session = Depends(get_db)) -> SessionService:
    return SessionService(db)


def get_faculty_service(db: Session = Depends(get_db)) -> FacultyService:
    return FacultyService(db)


def get_fms_sync_service() -> FmsSyncService:
    return FmsSyncService()

def get_excel_ingestion_service() -> ExcelIngestionService:
    return ExcelIngestionService()