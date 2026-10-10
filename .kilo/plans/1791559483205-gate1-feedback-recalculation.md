# Plan: Gate 1 Feedback Always Recalculate

## Goal
Remove all gating conditions from batch average feedback calculation. Calculate and persist `batch_avg_feedback` on every feedback submission as long as at least one rating exists.

## Changes Required

### 1. `BatchLifecycleService.calculate_batch_avg_feedback()` (`backend/app/api/v1/batches/lifecycle_service.py`)

**Remove all three preconditions:**
- Remove check: "every planned day has linked ledger row" (lines 87-94)
- Remove check: "every linked row is Completed" (line 95)
- Keep only: "at least one rating exists" (lines 98-104)

**New logic:**
```python
def calculate_batch_avg_feedback(self, batch_id: UUID) -> Optional[Decimal]:
    batch = self.lifecycle_repo.get_batch_by_id(batch_id)
    if not batch:
        return None

    ledger = self.lifecycle_repo.list_utilizations_for_batch(batch_id)
    
    # Only consider Completed sessions with ratings
    ratings = [
        u.feedback_rating
        for u in ledger
        if u.status == SessionStatus.Completed and u.feedback_rating is not None
    ]
    
    if not ratings:
        return None  # No ratings yet, don't write NULL

    avg_feedback = Decimal(str(round(sum(ratings) / len(ratings), 2)))
    batch.batch_avg_feedback = avg_feedback
    batch.updated_at = datetime.now(timezone.utc)
    self.lifecycle_repo.commit()
    return avg_feedback
```

### 2. GatekeeperService.complete_session_gate1() (`backend/app/api/v1/gates/service.py`)

No logic change needed - it already calls `lifecycle_service.check_and_update_batch_feedback()` after saving feedback.

### 3. SessionService.create()/update() (`backend/app/api/v1/sessions/service.py`)

No logic change needed - already calls `lifecycle_service.check_and_update_batch_feedback()` after create/update.

## Validation Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| First rating submitted (other sessions still Scheduled) | Average calculated from that 1 rating |
| Second rating submitted | Average recalculated from both ratings |
| Rating updated on existing session | Average recalculated with new value |
| Session Completed but no rating given | Not included in average, doesn't block |
| All sessions have ratings | Average of all ratings |

## Tests to Update

- `test_feedback_not_calculated_when_not_all_sessions_completed` - Should now pass (calculate with partial)
- `test_feedback_not_calculated_when_planned_day_has_no_delivery` - Should now pass (calculate with partial)
- `test_feedback_not_calculated_when_no_rated_deliveries` - Still passes (no ratings = None)
- `test_gate1_does_not_prematurely_calculate_feedback` - Logic changes, test needs rewrite

## Rollback Safety
- Additive change (removes blocking conditions)
- No data migration needed
- Existing averages preserved until next recalculation