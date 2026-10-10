# Plan: Add Rejected State & Convert Batch Status to Enum

## Goal
- Add `Rejected` state to batch lifecycle (replaces `Requested` on rejection)
- Remove unreachable `Approved` state
- Convert `status`, `approver_1_status`, `approver_2_status` to database enums
- Rejected batches editable by operational scope users; resubmit resets approvers to global config

---

## Changes Required

### 1. Database Migration (Alembic)
- Create enum types: `batch_status`, `approval_status`
- Alter `batches.status` to use `batch_status` enum
- Alter `batches.approver_1_status` and `batches.approver_2_status` to use `approval_status` enum
- Update default values

**Enum values:**
```sql
batch_status: 'Requested', 'Approval 1 Pending', 'Approval 2 Pending', 'Upcoming', 'Ongoing', 'Pending for Closure', 'Completed', 'OnHold', 'Cancelled', 'Rejected'
approval_status: 'Pending', 'Approved', 'Rejected'
```

### 2. Model Updates (`backend/app/models/batch.py`)
- Change `status` column type from `String(50)` to Enum
- Change `approver_1_status` and `approver_2_status` from `String(20)` to Enum
- Keep Python-side constants/enums for type safety

### 3. Service Logic Updates (`backend/app/api/v1/batches/service.py`)

#### State Machine (VALID_TRANSITIONS)
```python
VALID_TRANSITIONS = {
    "Requested": {"Approval 1 Pending", "OnHold", "Cancelled"},
    "Approval 1 Pending": {"Approval 2 Pending", "Rejected", "OnHold", "Cancelled"},
    "Approval 2 Pending": {"Upcoming", "Ongoing", "Rejected", "OnHold", "Cancelled"},
    "Upcoming": {"Ongoing", "OnHold", "Cancelled"},
    "Ongoing": {"Pending for Closure", "OnHold", "Cancelled"},
    "Pending for Closure": {"Completed", "OnHold", "Cancelled"},
    "Completed": {"OnHold"},
    "OnHold": {"Requested", "Approval 1 Pending", "Approval 2 Pending", "Upcoming", "Ongoing", "Cancelled"},
    "Cancelled": set(),
    "Rejected": {"Approval 1 Pending"},  # Only resubmit allowed
}
```

#### APPROVAL_REQUIRED_STATUSES
```python
APPROVAL_REQUIRED_STATUSES = {"Upcoming", "Ongoing", "Pending for Closure", "Completed"}
```

#### Rejection Logic (`decide` method)
- On Level 1 reject: set `approver_1_status = "Rejected"`, `status = "Rejected"`
- On Level 2 reject: set `approver_2_status = "Rejected"`, `status = "Rejected"`
- Record rejection reason in `remarks`

#### Resubmit Logic (`submit_for_approval` method)
- When batch is in `Rejected` state, allow resubmission
- Reset `approver_1_id`, `approver_2_id` from global config
- Reset `approver_1_status`, `approver_2_status` to `Pending`
- Set `status = "Approval 1 Pending"`

#### Resume from OnHold (`_get_resume_target_status`)
- If any approver status is `Rejected` → return `Rejected` (not `Requested`)

### 4. Schema Updates (`backend/app/schemas/batch.py`)
- Update `BatchLifecycleStatusUpdate.status` pattern to include `Rejected`, remove `Approved`
- Update `BatchResponse` default status to `Requested` (or keep as-is)

### 5. Controller Updates (`backend/app/api/v1/batches/controller.py`)
- No endpoint changes needed; logic lives in service

### 6. Tests
- Add tests for:
  - Level 1 rejection → Rejected state
  - Level 2 rejection → Rejected state
  - Resubmit from Rejected resets approvers
  - Rejected only transitions to Approval 1 Pending
  - Operational scope users can edit rejected batches
  - Enum values enforced at DB level

---

## Migration Strategy

1. Create new enum types
2. Add temporary columns with new enum types
3. Migrate data (map old strings to enum values)
4. Drop old columns, rename new columns
5. Set NOT NULL constraints and defaults

---

## Validation

- Run existing test suite
- Add new test cases for rejection/resubmit flow
- Verify enum constraints prevent invalid status values at DB level