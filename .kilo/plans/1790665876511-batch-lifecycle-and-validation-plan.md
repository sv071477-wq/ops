# Batch Creation Validation & Lifecycle Management Plan

## Executive Summary
This plan addresses the gaps in batch creation validation, lifecycle state transitions, schedule ingestion, and session management. The implementation is organized into 4 phases to minimize risk and enable incremental validation.

---

## Phase 1: Batch Creation Validation Enhancements

### 1.1 Backend Schema Validations (`backend/app/schemas/batch.py`)

**New Validators for `BatchCreate`:**
| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| `batch_id` | Unique constraint (DB-level + pre-check) | "Batch ID already exists" |
| `start_date` | Must be >= today (date only) | "Commencement date cannot be in the past" |
| `end_date` | Must be > start_date | "End date must be after start date" |
| `calendar_days` | Auto-calculated: `(end_date - start_date).days` | N/A (computed) |
| `training_days` | Must be > 0, <= calendar_days | "Training days must be between 1 and calendar days" |
| `total_hours` | Must be > 0, <= training_days × max_hours_per_day (from delivery mode config) | "Total hours must be between 0.5 and training_days × max_hours_per_day" |
| `total_enrollments` | Must be >= 1 | "At least 1 candidate required" |
| `faculty_members` | Array, min 1 item | "At least one proposed faculty member required" |
| `sales_spoc_id` | Required (not null) | "Sales Account SPOC is required" |
| `coordinator_id` | Required (not null) | "Operations Coordinator is required" |
| `primary_manager_id` | Required (not null) | "Delivery Manager is required" |

### Model Changes:
- Add `faculty_members` JSON column to `Batch` model (PostgreSQL JSONB / SQLite JSON)
- Make `sales_spoc_id`, `coordinator_id`, `primary_manager_id` validated as required in service (DB nullable for existing data)
- Add `max_hours_per_day` column to `DeliveryMode` model (default: 8)
- Add `effective_status` computed property to `TrainingSession` model (hybrid approach)

### 1.2 Frontend Validation (`frontend/lib/validation/schemas.ts`)

**Update `scheduleDeliverySchema`:**
```typescript
start_date: z.string().refine(date => new Date(date) >= new Date().setHours(0,0,0,0), "Cannot be in past"),
end_date: z.string().refine((data) => new Date(data.end_date) > new Date(data.start_date), "Must be after start"),
training_days: z.coerce.number().int().min(1).max(ref(data) => ref(data).calendar_days || 999),
total_hours: z.coerce.number().min(0.5), // Max validated in backend per delivery mode
```

**Update `headcountFacultySchema`:**
```typescript
faculty_members: z.array(facultyChipSchema).min(1, "At least one faculty required"),
sales_spoc_id: nonEmptyString,
coordinator_id: nonEmptyString,
primary_manager_id: nonEmptyString,
```

**Update `createBatchSchema`** (composed): Merge all step refinements.

**Note**: Frontend shows `max_hours_per_day` hint from selected delivery mode but does NOT enforce hard max. Backend rejects on create/update.

### 1.3 Service Layer Validation (`backend/app/api/v1/batches/service.py`)

**In `create()` method:**
- Add pre-creation checks for all new validations
- Auto-calculate `calendar_days` from dates
- Validate `faculty_members` array not empty
- Validate required role IDs present (sales_spoc_id, coordinator_id, primary_manager_id)
- Fetch delivery mode config and validate `total_hours <= training_days * max_hours_per_day`
- Store `faculty_members` as JSON in new column

### 1.4 Database Migration
- Add `faculty_members` JSON column to `batches` table (nullable, default `[]`)
- Add `max_hours_per_day` column to `delivery_modes` table (default: 8)
- **Note**: Existing batches may have NULL `sales_spoc_id`, `coordinator_id`, `primary_manager_id` - leave as nullable for now. New batches will require them via validation.

---

## Phase 2: Batch Lifecycle State Machine

### 2.1 Extended Status Enum
**New Statuses:**
- `Approval 1 Pending` (existing)
- `Approval 2 Pending` (existing)
- `Approved` (existing - after both approvals)
- `Upcoming` (new - auto-transition from Approved)
- `Ongoing` (existing - auto-transition from Upcoming on start_date)
- `Pending for Closure` (new - auto-transition from Ongoing after end_date)
- `Completed` (existing - after NPS collected)
- `OnHold` (existing)
- `Cancelled` (existing)

### 2.2 Automatic Transitions (Background Job / Scheduler)

**Implement `BatchLifecycleService` (`backend/app/api/v1/batches/lifecycle_service.py`):**

| From | To | Trigger | Implementation |
|------|-----|---------|----------------|
| `Approved` | `Upcoming` | Immediately after approval 2 | In `decide()` level 2 |
| `Approved` | `Ongoing` | Immediately after approval 2 AND `start_date.date() <= today` | In `decide()` level 2 (edge case) |
| `Upcoming` | `Ongoing` | `start_date.date() == today` | Daily cron job |
| `Ongoing` | `Pending for Closure` | `end_date.date() < today` | Daily cron job |
| `Pending for Closure` | `Completed` | NPS data entered | In `close_gate2()` / `import_feedback_workbook()` |

**Cron Job (`backend/app/core/scheduler.py`):**
- Runs daily at 00:30 IST
- Calls `BatchLifecycleService.sync_statuses(db)`

### 2.3 Manual Transitions (Preserve Existing)
- `OnHold` ↔ any state (with reason)
- `Cancelled` from any state (terminal)
- `Resume` from `OnHold` → appropriate approval state

### 2.4 Update `VALID_TRANSITIONS` in service.py
```python
VALID_TRANSITIONS = {
    "Requested": {"Approval 1 Pending", "OnHold", "Cancelled"},
    "Approval 1 Pending": {"Approval 2 Pending", "Requested", "OnHold", "Cancelled"},
    "Approval 2 Pending": {"Approved", "Upcoming", "Ongoing", "Requested", "OnHold", "Cancelled"},
    "Approved": {"Upcoming", "Ongoing", "OnHold", "Cancelled"},
    "Upcoming": {"Ongoing", "OnHold", "Cancelled", "Approved"},
    "Ongoing": {"Pending for Closure", "OnHold", "Cancelled"},
    "Pending for Closure": {"Completed", "OnHold", "Cancelled"},
    "Completed": {"OnHold"},
    "OnHold": {"Requested", "Approval 1 Pending", "Approval 2 Pending", "Approved", "Upcoming", "Ongoing", "Cancelled"},
    "Cancelled": set(),
}
```

---

## Phase 3: Schedule Ingestion & Session Lifecycle

### 3.1 Schedule Ingestion Timing
**Requirement:** Schedule ingestion allowed **only after** batch submitted for Approval 1 (status = `Approval 1 Pending`)

**Implementation:**
- Add check in `ExcelIngestionService.apply_schedule_items()`:
```python
if batch.status not in {"Approval 1 Pending", "Approval 2 Pending", "Approved", "Upcoming", "Ongoing"}:
    raise HTTPException(409, "Schedule can only be applied after batch is submitted for approval")
```

### 3.2 Training Session Status Auto-Transitions

**Approach:** Hybrid (Option C)
- `TrainingSession.status` stored values: `Scheduled` (default), `Completed`
- Computed `effective_status` property:
  - `session_date > today` → `Upcoming`
  - `session_date == today` → `Ongoing`
  - `session_date < today` AND status != `Completed` → `Overdue` (or `Ongoing` if we don't track overdue)
- Cron updates to `Completed` only when faculty utilization logged

**Daily Cron Job Updates (in `BatchLifecycleService.sync_session_statuses()`):**
| From | To | Trigger |
|------|-----|---------|
| `Scheduled` / `Upcoming` / `Ongoing` | `Completed` | Faculty utilization logged for this session with status `Completed` |

**Note**: No cron needed for Upcoming/Ongoing transitions - computed on read. This avoids daily write churn.

### 3.3 Faculty Utilization → Session Completion
- `FacultyUtilization.training_session_id` is **mandatory** when logging utilization
- When `FacultyUtilization` created/updated with status `Completed` for a `training_session_id`:
  - Update corresponding `TrainingSession.status = "Completed"`
  - Save feedback (`feedback_rating`, `feedback_notes`) from utilization to session

### 3.4 Average Batch Feedback Calculation
**Trigger:** After ALL non-cancelled sessions for a batch have status `Completed`

**Implementation in `FacultyUtilization` service or `BatchLifecycleService`:**
```python
def calculate_batch_avg_feedback(batch_id: UUID, db: Session):
    # Get all non-cancelled sessions for this batch
    sessions = db.query(TrainingSession).filter(
        TrainingSession.batch_id == batch_id,
        TrainingSession.status != "Cancelled"  # Exclude cancelled
    ).all()
    
    # Check if all non-cancelled sessions are completed
    if not sessions or all(s.status == "Completed" for s in sessions):
        # Only use sessions with feedback_rating
        feedbacks = [s.feedback_rating for s in sessions if s.feedback_rating is not None]
        if feedbacks:
            batch.batch_avg_feedback = sum(feedbacks) / len(feedbacks)
            db.commit()
```

---

## Phase 4: Integration & Testing

### 4.1 API Endpoints
- `POST /api/v1/batches/{id}/sync-status` - Manual trigger for status sync (admin)
- `GET /api/v1/batches/{id}/lifecycle-history` - Audit trail of status changes

### 4.2 Frontend Updates
- Update `CreateBatchModal` to use new validations
- Add visual status timeline in `BatchDetailDrawer`
- Show "Pending for Closure" and "Upcoming" statuses with appropriate badges
- Enable schedule upload only when batch in `Approval 1 Pending` or later

### 4.3 Tests
- Unit tests for new validators
- Integration tests for lifecycle transitions
- E2E test for full batch creation → approval → schedule → delivery → closure flow

---

## Data Model Changes Summary

### New Columns (Batch)
```sql
ALTER TABLE batches ADD COLUMN faculty_members JSONB DEFAULT '[]'::jsonb;
-- sales_spoc_id, coordinator_id, primary_manager_id remain nullable for existing data
-- New batches validated to require them via service layer
```

### Delivery Mode Configuration
```sql
ALTER TABLE delivery_modes ADD COLUMN max_hours_per_day INTEGER DEFAULT 8;
```

### New Status Values
- `Upcoming` (batch)
- `Pending for Closure` (batch)
- `TrainingSession.effective_status` computed: `Upcoming` | `Ongoing` | `Completed` | `Overdue`

### New Service
- `BatchLifecycleService` - handles automatic transitions

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing batches | Migration with defaults; make new fields nullable initially |
| Race conditions in cron | Use advisory locks; idempotent operations |
| Status sync delays | Accept eventual consistency; add manual sync endpoint |
| Faculty members JSON query | Add GIN index if PostgreSQL; use JSON1 functions in SQLite |

---

## Implementation Order

1. **Phase 1a**: Backend schema validators + service checks (including `max_hours_per_day` validation)
2. **Phase 1b**: Frontend validation schemas (no cross-field max, show hint only)
3. **Phase 1c**: Database migration + model update (`faculty_members` JSON, `max_hours_per_day` on delivery_modes)
4. **Phase 2a**: Update `VALID_TRANSITIONS` + `decide()` auto-approve to `Upcoming`/`Ongoing` (edge case)
5. **Phase 2b**: Create `BatchLifecycleService` + APScheduler cron job (00:30 IST daily)
6. **Phase 3a**: Schedule ingestion gate check (only after `Approval 1 Pending`)
7. **Phase 3b**: Session status - computed `effective_status` property, cron updates to `Completed` only
8. **Phase 3c**: Faculty utilization → session completion link (mandatory `training_session_id`)
9. **Phase 3d**: Batch avg feedback calculation (exclude cancelled, exclude no feedback)
10. **Phase 4**: Frontend integration + tests

---

## Open Questions for User (All Resolved)

All questions resolved per user feedback:

1. **Faculty Members Storage**: JSON array in `batches.faculty_members` ✓
2. **Cron Infrastructure**: APScheduler in FastAPI startup ✓
3. **Pending for Closure State**: Keep visible until NPS score filled ✓
4. **Training Days vs Calendar Days**: `calendar_days` auto-calculated, read-only ✓
5. **Total Hours Validation**: Configurable per delivery mode (add `max_hours_per_day` to `DeliveryMode`) ✓
6. **Frontend Cross-field Validation**: Option B - backend enforces, frontend shows hint ✓
7. **Cron Edge Case**: Handle batch approved today with `start_date <= today` → `Ongoing` directly ✓
8. **TrainingSession Status**: Option C - Hybrid (stored: Scheduled/Completed, computed: Upcoming/Ongoing) ✓
9. **Migration NULL Fields**: Leave existing NULLs, validate new batches only ✓
10. **Faculty Utilization Link**: `training_session_id` mandatory ✓
11. **Avg Feedback Scope**: Exclude cancelled, exclude no feedback, all non-cancelled must be Completed ✓