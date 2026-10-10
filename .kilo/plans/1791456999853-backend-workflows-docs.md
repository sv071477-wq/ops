# Plan: Create Backend Workflows Documentation

## Objective

Create a `workflows/` folder at the project root containing markdown files that document all backend workflows, state machines, and business conditions discovered through codebase analysis.

## Files to Create

### `workflows/01-authentication-authorization.md`
Document the complete auth flow:
- Login workflow with account lockout conditions
- Token refresh flow
- Password change / admin reset flows
- RBAC role hierarchy (Admin, Manager, Coordinator, Sales, Faculty, Finance)
- Manager scope resolution algorithm
- Permission dependency matrix

### `workflows/02-batch-lifecycle-state-machine.md`
Document the batch state machine:
- All 11 states: Requested, Approval 1 Pending, Approval 2 Pending, Approved, Upcoming, Ongoing, Pending for Closure, Completed, OnHold, Cancelled, Resume
- Valid transitions matrix (from `BatchService.VALID_TRANSITIONS`)
- Approval workflow (2-level approval chain)
- Auto-transition rules (scheduler at 00:30 IST)
- Schema lock conditions
- Finance status conditions
- Completion rate calculation logic

### `workflows/03-session-management-state-machine.md`
Document session states and transitions:
- TrainingSession states: Scheduled, Completed, Cancelled, Not Conducted
- FacultyUtilization states: Scheduled, InProgress, Completed, Cancelled, Not Conducted
- Terminal statuses: Completed, Cancelled, Not Conducted
- Outcome transition conditions (cancel, not-conducted, reschedule)
- Time window validation rules
- Batch date boundary validation
- Outcome reason requirements

### `workflows/04-quality-gates.md`
Document Gate 1 and Gate 2:
- Gate 1 (Session Feedback): rating 1.0-5.0, feedback_submitted flag, batch_avg_feedback calculation preconditions
- Gate 2 (Batch NPS Closure): requires Gate 1 complete, NPS formula, terminal session requirement
- batch_avg_feedback calculation conditions (all non-cancelled sessions must have terminal outcomes)
- Feedback rating exclusion rules (unrated Completed rows don't block)

### `workflows/05-schedule-ingestion.md`
Document schedule Excel ingestion:
- 4 supported formats: flat, TOC, curriculum, topic-column
- Column alias mapping
- Validation rules (date bounds, duplicate detection, overlap detection, faculty required)
- Missing day auto-generation logic
- Schedule apply conditions (batch must be Approval 1 Pending or later)

### `workflows/06-faculty-governance.md`
Document faculty management:
- Faculty types: Internal Full-time, External Consultant, HOP
- Domain breakdown: IT/ITES, Cloud, DS/ML, CyberSecurity, FullStack
- Utilization calculation (deployed / total faculty)
- Faculty resolution logic (by user ID, by name, Faculty-role preference)
- FMS sync workflow (mock implementation)

### `workflows/07-notifications.md`
Document notification triggers:
- Approval requested (logged, not yet emailed)
- Approval decision (logged, not yet emailed)
- Batch approved (emails to Manager + Sales)
- Session scheduled (email to faculty if email available)
- Gate completion (logged only)

### `workflows/08-rbac-conditions.md`
Document all RBAC conditions:
- Batch creation: Delivery team only, Admin forbidden
- Batch update: schema-locked field restrictions
- Finance field updates: Finance team or Admin only
- Session operations: batch scope check
- Schedule apply: scope check
- Analytics access: Manager or Admin

### `workflows/09-scheduler.md`
Document the scheduled jobs:
- BatchLifecycle sync at 00:30 IST daily
- Upcoming -> Ongoing (start_date <= today)
- Ongoing -> Pending for Closure (end_date < today)
- Session status sync (Completed utilization -> Completed training session)
- Batch feedback recalculation sweep

### `workflows/10-data-models.md`
Document key model relationships and constraints:
- Batch -> TrainingSession (1:many, cascade delete)
- Batch -> FacultyUtilization (1:many, cascade delete)
- User -> Batch (primary_manager, coordinator, sales_spoc)
- ApprovalConfiguration (singleton, 2 approvers)
- Unique constraints (batch_id, batch_date_module)

## Implementation Steps

1. Create `workflows/` directory
2. Write each markdown file with complete workflow documentation
3. Cross-reference conditions and validations from actual code
4. Include state transition matrices as tables
5. Include validation rules and error conditions
