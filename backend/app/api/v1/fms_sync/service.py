from datetime import datetime, timezone

from app.api.v1.fms_sync.repository_interfaces import IFmsSyncRepository


class FmsSyncService:
    def __init__(self, fms_repo: IFmsSyncRepository):
        self.fms_repo = fms_repo

    def sync(self, faculty_id: str, event_type: str) -> dict:
        return {
            "status": "SUCCESS",
            "message": f"FMS sync event {event_type} dispatched for {faculty_id}.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def list_logs(self, skip: int, limit: int) -> list:
        return self.fms_repo.list_logs(skip, limit)