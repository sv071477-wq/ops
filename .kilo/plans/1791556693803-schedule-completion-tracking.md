# Plan: Schedule Completion Tracking & Validation Changes

## Goal
- Remove intra-upload faculty time overlap check
- Prevent schedule upload if it would exceed `training_days`
- Add `schedule_complete` boolean field on Batch (default false)
- Set `schedule_complete = true` when `scheduled_session_count == training_days`
- Changes via `init_db.py` (no Alembic migration)

---

## Changes Required

### 1. Database Model (`backend/app/models/batch.py`)
- Add `schedule_complete` column to `Batch` model:
  ```python
  schedule_complete = Column(Boolean, default=False, nullable=False)
  ```

### 2. Database Initialization (`backend/app/db/init_db.py`)
- Add `schedule_complete` column to `batches` table in `schema_columns` dict:
  ```python
  "batches": {
      ...,
      "schedule_complete": "BOOLEAN DEFAULT FALSE NOT NULL",
  }
  ```

### 3. Schema (`backend/app/schemas/batch.py`)
- Add `schedule_complete: bool = False` to `BatchResponse`
- Add to `BatchDetailResponse` (inherits)

### 4. Schedule Service (`backend/app/api/v1/schedules/service.py`)

#### Remove time overlap check (lines 674-681)
```python
# REMOVE this block:
# slot_key = (faculty_name.lower(), s_date)
# for previous_start, previous_end, previous_row in running_slots.get(slot_key, []):
#     if item.start_time and item.end_time and previous_start and previous_end and previous_start < item.end_time and previous_end > item.start_time:
#         errors.append({"source_row": item.source_row, "message": f"Overlaps another uploaded session from row {previous_row}"})
# running_slots.setdefault(slot_key, []).append((item.start_time, item.end_time, item.source_row))
```

#### Add training_days limit validation
Before processing items, count unique dates in upload + existing sessions:
```python
# Count existing scheduled dates for this batch
existing_dates = {s.session_date for s in schedule_repo.list_scheduled_sessions_for_batch(batch.id)}
# Count unique dates in current upload
upload_dates = {item.date_of_training.date() for item in items}
# Total unique dates after upload
total_unique_dates = len(existing_dates.union(upload_dates))

if total_unique_dates > batch.training_days:
    raise HTTPException(
        status_code=422,
        detail=f"Cannot add more training sessions than training_days ({batch.training_days}). "
               f"Upload would create {total_unique_dates} unique training dates."
    )
```

#### Update `schedule_complete` after successful persist
After `sessions = schedule_repo.persist_sessions(sessions)`:
```python
# Recalculate total scheduled sessions for batch
total_scheduled = schedule_repo.get_scheduled_session_count(batch.id)
batch.schedule_complete = (total_scheduled >= batch.training_days)
schedule_repo.commit()
```

### 5. Schedule Repository Interface (`backend/app/api/v1/schedules/repository_interfaces.py`)
Add new method:
```python
@abstractmethod
def list_scheduled_sessions_for_batch(self, batch_id: UUID) -> List[TrainingSession]:
    pass

@abstractmethod
def get_scheduled_session_count(self, batch_id: UUID) -> int:
    pass
```

### 6. Schedule Repository Implementation (`backend/app/api/v1/schedules/repository.py`)
Implement new methods:
```python
def list_scheduled_sessions_for_batch(self, batch_id: UUID) -> List[TrainingSession]:
    return self.db.query(TrainingSession).filter(
        TrainingSession.batch_id == batch_id,
        TrainingSession.status.notin_(["Cancelled", "Not Conducted", "Completed"]),
    ).all()

def get_scheduled_session_count(self, batch_id: UUID) -> int:
    return self.db.query(func.count(TrainingSession.id)).filter(
        TrainingSession.batch_id == batch_id,
        TrainingSession.status.notin_(["Cancelled", "Not Conducted", "Completed"]),
    ).scalar() or 0
```

### 7. Batch Service (`backend/app/api/v1/batches/service.py`)
Update `list()` method to populate `schedule_complete` from DB (already loaded via model).

---

## Validation Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Upload 3 sessions for batch with `training_days=5` | Success, `schedule_complete=false` |
| Upload 5 sessions for batch with `training_days=5` | Success, `schedule_complete=true` |
| Upload 6 sessions for batch with `training_days=5` | **Reject** with 422 error |
| Upload 3 sessions, then later 2 more (total 5) | Second upload succeeds, `schedule_complete=true` |
| Upload with intra-faculty time overlap | **Allowed** (check removed) |
| Batch status `Upcoming`, upload schedule | Allowed (status unchanged) |

---

## Files to Modify

1. `backend/app/models/batch.py` - Add column
2. `backend/app/db/init_db.py` - Add column DDL
3. `backend/app/schemas/batch.py` - Add field to response
4. `backend/app/api/v1/schedules/service.py` - Remove overlap check, add training_days validation, update flag
5. `backend/app/api/v1/schedules/repository_interfaces.py` - Add interface methods
6. `backend/app/api/v1/schedules/repository.py` - Implement interface methods

---

## Rollback / Safety
- Column addition is additive (default false), no data loss
- Validation only prevents *excess* uploads, doesn't delete existing
- `schedule_complete` recomputed on every successful apply