from datetime import datetime, timezone


class FmsSyncService:
    def sync(self, faculty_id: str, event_type: str) -> dict:
        return {
            "status": "SUCCESS",
            "message": f"FMS sync event {event_type} dispatched for {faculty_id}.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def list_logs(self, skip: int, limit: int) -> list:
        return []