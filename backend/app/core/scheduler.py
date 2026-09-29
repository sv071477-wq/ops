from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from app.core.database import SessionLocal
from app.api.v1.batches.lifecycle_service import BatchLifecycleService


scheduler = AsyncIOScheduler()


def run_batch_lifecycle_sync():
    """Run batch lifecycle synchronization - called by scheduler."""
    db = SessionLocal()
    try:
        service = BatchLifecycleService(db)
        result = service.sync_all()
        print(f"[BatchLifecycle] Sync completed: {result}")
    except Exception as e:
        print(f"[BatchLifecycle] Sync failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with daily cron job at 00:30 IST."""
    # 00:30 IST = 19:00 UTC (previous day)
    # We use timezone-aware cron trigger
    ist = pytz.timezone('Asia/Kolkata')
    
    scheduler.add_job(
        run_batch_lifecycle_sync,
        CronTrigger(hour=0, minute=30, timezone=ist),
        id='batch_lifecycle_sync',
        name='Batch Lifecycle Status Sync',
        replace_existing=True,
    )
    
    scheduler.start()
    print("[Scheduler] Started batch lifecycle sync job (daily at 00:30 IST)")


def stop_scheduler():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] Stopped")