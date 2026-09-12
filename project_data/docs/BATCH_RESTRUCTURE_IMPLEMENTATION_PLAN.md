# Batch Schema Implementation

## 1. Final `batches` Table

```sql
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(255) NOT NULL UNIQUE,

    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    batch_request_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    calendar_days INTEGER NOT NULL,
    training_days INTEGER NOT NULL,
    total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,

    program_name VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL REFERENCES entities(id),
    technology VARCHAR(255),
    domain VARCHAR(100),
    client_name VARCHAR(255),
    location_city VARCHAR(100),
    total_enrollments INTEGER NOT NULL DEFAULT 0,

    faculty_assigned_text VARCHAR(500),
    sow_number VARCHAR(100),
    approval_id VARCHAR(100),

    sales_spoc_id UUID REFERENCES users(id) ON DELETE SET NULL,
    coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    primary_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,

    category_id UUID NOT NULL REFERENCES batch_categories(id),
    delivery_mode_id UUID NOT NULL REFERENCES delivery_modes(id),
    accommodation_id UUID NOT NULL REFERENCES accommodations(id),

    remarks TEXT,
    comments TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Requested',
    approver_1_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_2_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_1_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    approver_2_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    approver_1_approved_at TIMESTAMPTZ,
    approver_2_approved_at TIMESTAMPTZ,
    is_schema_locked BOOLEAN NOT NULL DEFAULT FALSE,
    finance_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    finance_status_check_date DATE,
    finance_check INTEGER,

    batch_avg_feedback NUMERIC(3, 2),
    total_feedback_score NUMERIC(10, 2),
    batch_nps NUMERIC(5, 2),
    retrospective_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_batches_date_order
        CHECK (end_date >= start_date),
    CONSTRAINT ck_batches_calendar_days
        CHECK (calendar_days = end_date::date - start_date::date),
    CONSTRAINT ck_batches_training_days
        CHECK (training_days >= 0),
    CONSTRAINT ck_batches_enrollments
        CHECK (total_enrollments >= 0),
    CONSTRAINT ck_batches_total_hours
        CHECK (total_hours >= 0),
    CONSTRAINT ck_batches_finance_check
        CHECK (finance_check IS NULL OR finance_check >= 0),
    CONSTRAINT ck_batches_status
        CHECK (status IN (
            'Requested', 'Approval 1 Pending', 'Approval 2 Pending',
            'Approved', 'Upcoming', 'Ongoing',
            'Completed', 'Cancelled', 'OnHold'
        )),
    CONSTRAINT ck_batches_approval_status
        CHECK (approver_1_status IN ('Pending', 'Approved', 'Rejected')
            AND approver_2_status IN ('Pending', 'Approved', 'Rejected')),
    CONSTRAINT ck_batches_finance_status
        CHECK (finance_status IN (
            'Pending', 'Cleared', 'Invoiced', 'Settled', 'OnHold'
        )),
    CONSTRAINT ck_batches_feedback
        CHECK (batch_avg_feedback IS NULL OR batch_avg_feedback BETWEEN 1.00 AND 5.00),
    CONSTRAINT ck_batches_nps
        CHECK (batch_nps IS NULL OR batch_nps BETWEEN -100.00 AND 100.00)
);

CREATE INDEX ix_batches_status_start_date
    ON batches (status, start_date);

CREATE INDEX ix_batches_client_name
    ON batches (client_name);

CREATE INDEX ix_batches_domain
    ON batches (domain);

CREATE INDEX ix_batches_manager_status
    ON batches (primary_manager_id, status);
```

### Field Rules

| Field | Rule |
| --- | --- |
| `id` | UUID database primary key |
| `batch_id` | Required, unique business identifier |
| `batch_request_date` | Automatically set by the server when the batch is created; not entered in the form |
| `calendar_days` | Calculated as `end_date - start_date`; read-only in the form |
| `training_days` | Manually entered non-negative integer |
| `total_days` | Not included |
| `sow_number` | Client-side SOW number |
| `approval_id` | Separate finance approval/reference ID |
| `total_hours` | Total planned training hours |
| `finance_status_check_date` | Finance status check date |
| `finance_check` | Finance check integer |
| `entity_id` | Admin-managed entity selection |
| `approver_1_id` | Admin-configured first approver |
| `approver_2_id` | Admin-configured second approver |
| `approver_1_status`, `approver_2_status` | Approval state for each level |
| `technology`, `domain`, `client_name`, `location_city` | String fields |
| `coordinator_id` | SPOC assignment |
| `accommodation_id` | Accommodation selection |

## 2. Admin Lookup Tables

```sql
CREATE TABLE batch_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accommodations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Initial values:

```text
Categories: Bootcamp, RBT, PJP, Workshop
Delivery modes: Online, F2F, Blended
Accommodations: Residential, Non-Residential
```

Admins manage categories, delivery modes, accommodations, and entities. Referenced values are deactivated instead of deleted. Forms show active values only.

## 3. API Implementation

### Batch Lifecycle

```text
Requested
    -> Approval 1 Pending
    -> Approval 2 Pending
    -> Approved
    -> Ongoing
    -> Completed
```

- A Coordinator or Manager submits a batch in `Requested` status.
- The system assigns the Admin-configured Approver 1 and Approver 2.
- Both approval levels are required before the batch can become `Approved`.
- The batch moves to `Ongoing` after approval and operational commencement.
- The batch moves to `Completed` only when both final NPS and average batch feedback are recorded.
- If either NPS or average batch feedback is missing, the batch remains `Ongoing`.
- Rejection returns the batch to `Requested` with the rejection reason recorded.

### Approval APIs

```text
POST /api/v1/batches/{id}/submit
POST /api/v1/batches/{id}/approve-level-1
POST /api/v1/batches/{id}/approve-level-2
POST /api/v1/batches/{id}/reject
```

Only the configured approver for each level can approve that level. Approver 2 cannot approve until Approver 1 has approved. Approval actions record the user, timestamp, and decision.

### Notifications

Email notifications are required for:

- Batch submitted: notify Approver 1.
- Approver 1 completed: notify Approver 2.
- Approver 1 or 2 rejected: notify the submitting Coordinator/Manager.
- Both approvals completed: notify the submitting user and assigned operational users.
- Batch completed: notify relevant stakeholders.

Approval emails must include the batch ID, program name, client, dates, SOW number, current approval level, and a link to the approval action.

### Batch APIs

Existing batch APIs should use the final schema:

```text
POST  /api/v1/batches
GET   /api/v1/batches
GET   /api/v1/batches/{id}
PATCH /api/v1/batches/{id}
POST  /api/v1/batches/{id}/approve
```

`POST` and `PATCH` must validate dates, calculate `calendar_days`, and accept manual `training_days`. `POST` sets `batch_request_date` automatically; clients must not provide or modify it. Approval endpoints must enforce the two-level sequence.

### Lookup APIs

```text
GET    /api/v1/batch-options/categories
POST   /api/v1/batch-options/categories
PATCH  /api/v1/batch-options/categories/{id}
DELETE /api/v1/batch-options/categories/{id}

GET    /api/v1/batch-options/delivery-modes
POST   /api/v1/batch-options/delivery-modes
PATCH  /api/v1/batch-options/delivery-modes/{id}
DELETE /api/v1/batch-options/delivery-modes/{id}

GET    /api/v1/batch-options/accommodations
POST   /api/v1/batch-options/accommodations
PATCH  /api/v1/batch-options/accommodations/{id}
DELETE /api/v1/batch-options/accommodations/{id}

GET    /api/v1/batch-options/entities
POST   /api/v1/batch-options/entities
PATCH  /api/v1/batch-options/entities/{id}
DELETE /api/v1/batch-options/entities/{id}
```

- `GET` returns active options for batch forms.
- Create, update, and delete operations are Admin-only.
- Delete deactivates an option when it is already referenced.

### User Dropdowns

Use active users filtered by role:

```text
Sales user       -> sales_spoc_id
Coordinator user -> coordinator_id (SPOC)
Manager user     -> primary_manager_id
```

## 4. Backend Implementation

Update:

```text
backend/app/models/batch.py
backend/app/schemas/batch.py
backend/app/api/v1/batches/service.py
backend/app/api/v1/batches/controller.py
```

Implement:

1. Lookup-table models and relationships.
2. `entity_id`, `category_id`, `delivery_mode_id`, and `accommodation_id` on `Batch`.
3. `sow_number` as a separate field from `approval_id`.
4. Date validation: `end_date >= start_date`.
5. Server-side `calendar_days` calculation.
6. Server-side `batch_request_date` assignment on creation.
7. Two-level approval state and approver validation.
8. Email notification events for submission, approval, rejection, and completion.
9. Completion transition only when NPS and average batch feedback are present.
10. Manual `training_days` validation.
11. Role validation for Sales, Coordinator, and Manager assignments.
12. Admin authorization for lookup management.

## 5. Frontend Implementation

Update:

```text
frontend/components/CreateBatchModal.tsx
frontend/lib/api.ts
frontend/components/BatchDetailDrawer.tsx
frontend/app/page.tsx
frontend/app/admin/page.tsx
```

Implement:

1. Form fields matching the final table.
2. Do not show `batch_request_date` as an input; display the returned request date where needed.
3. Display the current approval status and approval history.
4. Manual training-days input.
5. Read-only calendar-days display after both dates are entered.
6. No total-days field.
7. API-backed entity, category, mode, and accommodation dropdowns.
8. Role-filtered Sales SPOC, SPOC, and Manager dropdowns.
9. Separate SOW Number and Approval ID inputs.
10. Provide approval and rejection actions only to the configured approver.

## 6. Core Database Initialization

`batches` and `training_sessions` are core database tables. Their SQLAlchemy models are loaded during application startup and created through the existing `Base.metadata.create_all()` initialization path.

The initialization process must create:

- `batches`
- `training_sessions`
- `entities`
- `batch_categories`
- `delivery_modes`
- `accommodations`
- `approval_configurations`

Default lookup values and the initial approval configuration are seeded during startup. No Alembic migration is required for these core tables.

## 7. Validation and Tests

Validate:

- Unique `batch_id`.
- Automatically generated `batch_request_date`.
- Requested status on Coordinator/Manager submission.
- Required sequential approval by Approver 1 and Approver 2.
- Email notification for every approval transition.
- `Completed` only when NPS and average batch feedback are both present; otherwise remain `Ongoing`.
- Separate `sow_number` and `approval_id`.
- End date not before start date.
- Correct calculated `calendar_days`.
- Non-negative `training_days` and `total_enrollments`.
- Active lookup values only for new batches.
- Entity values are managed by Admin and selected from a dropdown.
- Correct roles for user assignments.
- Admin-only lookup management.

Test batch creation, update, approval, lookup management, permissions, and migration without data loss.

## 8. Session Assignment Table

Session scheduling is stored separately from `batches` in `training_sessions`. Each record assigns one Faculty user to one batch session.

```sql
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    date_of_training TIMESTAMPTZ NOT NULL,
    start_time TIME,
    end_time TIME,
    topic VARCHAR(255) NOT NULL,
    no_of_hours NUMERIC(5, 2) NOT NULL DEFAULT 8.0,
    venue VARCHAR(255),
    location_city VARCHAR(100),
    mode_of_delivery VARCHAR(50) NOT NULL DEFAULT 'Online',
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
    feedback_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_rating NUMERIC(3, 2),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_training_sessions_hours
        CHECK (no_of_hours > 0 AND no_of_hours <= 24),
    CONSTRAINT ck_training_sessions_feedback
        CHECK (feedback_rating IS NULL OR feedback_rating BETWEEN 1.00 AND 5.00)
);
```

Session APIs:

```text
GET   /api/v1/sessions
POST  /api/v1/sessions
PATCH /api/v1/sessions/{id}
PATCH /api/v1/sessions/{id}/complete
```

The `POST /sessions` endpoint validates that `faculty_id` belongs to an active Faculty user and rejects assignments exceeding the configured daily capacity of eight hours. Session assignment is available to Coordinators, Managers, and Admins. The session table does not modify the batch table beyond its foreign-key relationship.