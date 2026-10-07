# Plan: Recalculate Batch Average Feedback on Every Utilization Change

## Goal
Remove the write-once guard from `calculate_batch_avg_feedback()` so `batch_avg_feedback` recalculates on **every** FacultyUtilization insert/update for that batch.

## Changes Required

### 1. `backend/app/api/v1/batches/lifecycle_service.py`
- **Remove write-once guard** in `calculate_batch_avg_feedback()` (lines 83-85):
  ```python
  # REMOVE THIS BLOCK:
  if not batch or batch.batch_avg_feedback is not None:
      return None
  ```
- Keep all three preconditions (coverage, terminal statuses, at least one rating)
- Function now always recalculates when preconditions pass

### 2. `backend/app/api/v1/batches/lifecycle_service.py`
- **Update `check_and_update_batch_feedback()`** - already calls `calculate_batch_avg_feedback()`, no change needed

### 3. `backend/app/api/v1/sessions/service.py`
- **No changes needed** - already calls `lifecycle_service.check_and_update_batch_feedback(batch_id)` after every create/update (lines 219, 274, 307)

### 4. Tests - Update write-once expectations
- `backend/tests/v1/gates/test_feedback_calculation.py`:
  - `test_feedback_is_write_once` → **remove or rewrite** to verify recalculation happens
  - All other tests: verify they still pass with new behavior (recalculation instead of write-once)

### 5. Database / Migration
- **No schema change** - `batch_avg_feedback` column remains `NUMERIC(3,2) NULL`
- Existing data: batches with existing `batch_avg_feedback` will be recalculated on next utilization change

## Trigger Points (Already Wired)
| Event | Location | Calls |
|-------|----------|-------|
| Utilization created | `SessionService.create()` line 219 | `check_and_update_batch_feedback()` |
| Utilization updated | `SessionService.update()` line 274 | `check_and_update_batch_feedback()` |
| Status transition (cancel/not-conducted) | `SessionService._transition()` line 307 | `check_and_update_batch_feedback()` |
| Nightly sweep | `BatchLifecycleService.sync_all()` line 126-128 | `calculate_batch_avg_feedback()` |
| Gate 1 completion | `GatekeeperService.complete_session_gate1()` → calls lifecycle | Same path |

## Edge Cases Handled by Existing Preconditions
- **Partial coverage**: Returns `None` (no write) if any non-cancelled planned day lacks a ledger row
- **Non-terminal rows**: Returns `None` if any linked utilization is not in `{Completed, Cancelled, Not Conducted}`
- **No ratings**: Returns `None` if all Completed rows are unrated
- **Cancelled/Not Conducted**: Excluded from mean, don't block

## Validation Plan
1. Run existing test suite - expect `test_feedback_is_write_once` to fail (will be updated)
2. Manual test: create batch → add 2 sessions → log first utilization with rating 4.0 → verify avg=4.0 → log second with 5.0 → verify avg=4.5 → update first to 3.0 → verify avg=4.0
3. Verify nightly sweep still works (calls same method)
4. Verify Gate 1 still triggers recalculation

## Rollback
- Revert `lifecycle_service.py` changes
- Restore `test_feedback_is_write_once`
- No DB migration needed