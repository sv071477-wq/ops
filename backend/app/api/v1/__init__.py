from fastapi import APIRouter

from app.api.v1.analytics.controller import router as analytics_router
from app.api.v1.auth.controller import router as auth_router
from app.api.v1.batches.controller import router as batches_router
from app.api.v1.faculty.controller import router as faculty_router
from app.api.v1.fms_sync.controller import router as fms_sync_router
from app.api.v1.roles.controller import router as roles_router
from app.api.v1.schedules.controller import router as schedules_router
from app.api.v1.sessions.controller import router as sessions_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth & User Hierarchy"])
api_router.include_router(roles_router, prefix="/roles", tags=["Role & Position Titles Management"])
api_router.include_router(batches_router, prefix="/batches", tags=["Workflow 1: Batch Lifecycle"])
api_router.include_router(schedules_router, prefix="/schedules", tags=["Workflow 2: Schedule Ingestion & Conflict Engine"])
api_router.include_router(sessions_router, prefix="/sessions", tags=["Workflow 3: Sessions & Gate 1"])
api_router.include_router(faculty_router, prefix="/faculty", tags=["Faculty Directory & Utilization"])
api_router.include_router(fms_sync_router, prefix="/integrations/fms", tags=["Optional FMS Integration"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Real-time Manager Analytics"])

__all__ = ["api_router"]
