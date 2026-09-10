from fastapi import APIRouter
from app.api.v1 import auth, batches, schedules, sessions, faculty, fms_sync, analytics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth & User Hierarchy"])
api_router.include_router(batches.router, prefix="/batches", tags=["Workflow 1: Batch Lifecycle"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["Workflow 2: Schedule Ingestion & Conflict Engine"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Workflow 3: Sessions & Gate 1"])
api_router.include_router(faculty.router, prefix="/faculty", tags=["Faculty Directory & Utilization"])
api_router.include_router(fms_sync.router, prefix="/integrations/fms", tags=["Optional FMS Integration"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Real-time Manager Analytics"])
