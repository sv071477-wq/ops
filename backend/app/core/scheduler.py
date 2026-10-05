from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from typing import Optional
import pytz
from app.core.database import SessionLocal
from app.api.v1.batches.lifecycle_repository import BatchLifecycleRepository
from app.api.v1.batches.lifecycle_service import BatchLifecycleService


# Held per-lifespan rather than at import time: AsyncIOScheduler binds to
# whichever event loop is running when start() is called, so a module-level
# instance would stay pinned to a closed loop across restarts.
_scheduler: Optional[AsyncIOScheduler] = None


def run_batch_lifecycle_sync():
    """Run batch lifecycle synchronization - called by scheduler."""
    db = SessionLocal()
    try:
        service = BatchLifecycleService(BatchLifecycleRepository(db))
        result = service.sync_all()
        print(f"[BatchLifecycle] Sync completed: {result}")
    except Exception as e:
        print(f"[BatchLifecycle] Sync failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with daily cron job at 00:30 IST."""
    global _scheduler

    # 00:30 IST = 19:00 UTC (previous day)
    # We use timezone-aware cron trigger
    ist = pytz.timezone('Asia/Kolkata')

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_batch_lifecycle_sync,
        CronTrigger(hour=0, minute=30, timezone=ist),
        id='batch_lifecycle_sync',
        name='Batch Lifecycle Status Sync',
        replace_existing=True,
    )

    _scheduler.start()
    print("[Scheduler] Started batch lifecycle sync job (daily at 00:30 IST)")


def stop_scheduler():
    """Stop the scheduler."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown()
        print("[Scheduler] Stopped")
    _scheduler = None