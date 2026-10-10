# Training Session Validation Fix Plan

## Problem Summary
The validation for `training_days` limit has a bug where:
1. `list_scheduled_sessions_for_batch` excludes `Completed` sessions from the count
2. Unused statuses (`Cancelled`, `NotConducted`, `Rescheduled`, `InProgress`) exist in enum but have no backend endpoints
3. Frontend calls non-existent endpoints for cancel/not-conducted/reschedule
4. Missing validation: session date must be <= batch end_date

## Changes Required

### 1. Backend: Clean up SessionStatus enum (`backend/app/models/session.py`)
- Keep only: `Scheduled`, `Completed`
- Remove: `InProgress`, `Cancelled`, `NotConducted`, `Rescheduled`

### 2. Backend: Fix validation query (`backend/app/api/v1/schedules/repository.py`)
- Replace `list_scheduled_sessions_for_batch` to count ALL sessions for batch_id (no status filter)
- Use `COUNT(DISTINCT session_date)` for unique training days

### 3. Backend: Add end_date validation in schedule apply (`backend/app/api/v1/schedules/service.py`)
- Check `item_date <= batch.end_date.date()` when batch.end_date exists
- Already partially exists at line 665 but skipped if end_date is NULL

### 4. Backend: Ensure training_days validation uses correct count
- Update `apply_schedule_items` to use the new count method
- Validate `total_unique_dates <= batch.training_days`

### 5. Frontend: Remove unused API calls (`frontend/lib/api.ts`)
- Remove `cancelSession`, `markSessionNotConducted`, `rescheduleSession` methods
- Remove corresponding UI handlers in `BatchDetailDrawer.tsx`

### 6. Frontend: Update status filter options
- Remove unused statuses from filter dropdowns in `ActiveBatchesView.tsx` and `FacultyUtilizationView.tsx`

### 7. Database Migration
- Create Alembic migration to handle enum change (if existing data has removed statuses)
- Check existing data first: `SELECT DISTINCT status FROM training_sessions;`

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/models/session.py` | Clean SessionStatus enum |
| `backend/app/api/v1/schedules/repository.py` | Fix list_scheduled_sessions_for_batch query |
| `backend/app/api/v1/schedules/service.py` | Ensure end_date validation runs, use correct count |
| `frontend/lib/api.ts` | Remove unused API methods |
| `frontend/components/BatchDetailDrawer.tsx` | Remove cancel/not-conducted/reschedule handlers |
| `frontend/app/dashboard/components/ActiveBatchesView.tsx` | Update status filter options |
| `frontend/app/dashboard/components/FacultyUtilizationView.tsx` | Update status filter options |

## Validation Steps
1. Run existing tests to ensure no regressions
2. Test schedule upload with 16th session for 15-day batch → should fail
3. Test schedule upload with date > batch end_date → should fail
4. Test schedule upload within limits → should succeed
5. Verify Completed sessions count toward training_days limit

## Migration Note
Check existing data before migration:
```sql
SELECT DISTINCT status FROM training_sessions;
SELECT DISTINCT status FROM faculty_utilization;
```
If only 'Scheduled' and 'Completed' exist, migration is simple enum change.
If other statuses exist, need data migration first.