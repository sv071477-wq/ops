# Plan: Batch Re-Approval on Schedule Change

## Goal
When a coordinator edits a schema-locked batch (Upcoming/Ongoing/Pending for Closure) and changes schedule-related fields (`training_days`, `end_date`, `start_date`, `total_hours`), automatically reset the batch to "Approval 1 Pending" so it goes through the approval process again.

## Changes Required

### 1. `BatchService.update()` (`backend/app/api/v1/batches/service.py`)

Add logic in the `update` method to detect when a schema-locked batch in an active status has its schedule fields modified, and trigger re-approval.

**Fields that trigger re-approval:**
- `training_days`
- `end_date`
- `start_date`
- `total_hours`

**Conditions:**
- Batch `is_schema_locked == True`
- Batch status in `["Upcoming", "Ongoing", "Pending for Closure"]`
- Any of the trigger fields changed

**Actions when triggered:**
1. Get approval config (approver_1_id, approver_2_id)
2. Set `is_schema_locked = False`
3. Set `approver_1_status = "Pending"`, `approver_2_status = "Pending"`
4. Set `approver_1_id`, `approver_2_id` from config
5. Set `approval_id = None`
6. Set `status = "Approval 1 Pending"`
7. Add audit entry to remarks

### 2. Notification (`backend/app/api/v1/batches/controller.py`)

After update triggers re-approval, send notification to approvers (similar to `submit_for_approval`).

## Validation Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Coordinator updates training_days on Upcoming batch | Batch goes to Approval 1 Pending, schema unlocked |
| Coordinator updates end_date on Ongoing batch | Batch goes to Approval 1 Pending |
| Coordinator updates total_hours only (no schedule change) | No re-approval (total_hours alone doesn't trigger) |
| Coordinator updates client_name on schema-locked batch | No re-approval (non-schedule field) |
| Admin updates schedule fields | No re-approval (admins can edit locked schema) |
| Batch in Completed status updated | No re-approval (not in active statuses) |

## Tests to Add

- `test_update_triggers_reapproval_when_training_days_changed`
- `test_update_triggers_reapproval_when_end_date_changed`
- `test_update_no_reapproval_for_non_schedule_fields`
- `test_update_no_reapproval_for_completed_batch`
- `test_update_no_reapproval_for_admin`

## Rollback Safety
- Additive change (only adds auto-transition logic)
- No data migration needed
- Existing approval history preserved in remarks