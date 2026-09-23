# Database Schema

This document describes the operational database for the training and faculty utilization platform. It is based on the SQLAlchemy models in the backend and reflects the current live schema used by the application.

## Core entities

### 1. users
Stores user accounts, roles, team membership, and manager relationships.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| email | VARCHAR(255) | No | Unique |
| hashed_password | VARCHAR(255) | No | Password hash |
| full_name | VARCHAR(255) | No | Display name |
| role | VARCHAR(50) | No | Admin / Manager / Coordinator / Sales / Faculty |
| role_id | UUID | Yes | FK to roles.id |
| team_id | UUID | Yes | FK to teams.id |
| manager_id | UUID | Yes | Self-referencing manager |
| is_active | BOOLEAN | No | Active status |
| created_at | TIMESTAMPTZ | No | Audit timestamp |

Relationships:
- many users belong to one team
- many users hold one role
- users can have direct reports through manager_id
- users serve as approvers, coordinators, sales SPOCs, or batch owners

### 2. roles
Reference table for role metadata.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| name | VARCHAR(100) | No | Unique |
| system_role | VARCHAR(50) | No | System role label |
| is_active | BOOLEAN | No | Active status |
| created_at | TIMESTAMPTZ | No | Audit timestamp |

### 3. teams
Organizational teams.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| name | VARCHAR(100) | No | Unique |
| department | VARCHAR(100) | No | Default Ops |
| description | VARCHAR(255) | Yes | Team description |
| is_active | BOOLEAN | No | Active status |
| created_at | TIMESTAMPTZ | No | Audit timestamp |

### 4. user_manager_mappings
Maps coordinators to managers for reporting and assignment flows.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| coordinator_id | UUID | No | FK to users.id |
| manager_id | UUID | No | FK to users.id |
| assigned_at | TIMESTAMPTZ | No | Assignment timestamp |

### 5. batches
Stores the primary training batch lifecycle and governance information.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| batch_id | VARCHAR(255) | No | Unique batch identifier |
| sow_number | VARCHAR(100) | Yes | Client SOW number |
| approval_id | VARCHAR(100) | Yes | Financial approval reference |
| category | VARCHAR(100) | No | e.g. Bootcamp, RBT |
| entity_id | UUID | Yes | FK to entities.id |
| category_id | UUID | Yes | FK to batch_categories.id |
| delivery_mode_id | UUID | Yes | FK to delivery_modes.id |
| accommodation_id | UUID | Yes | FK to accommodations.id |
| program_name | VARCHAR(255) | No | Program title |
| technology | VARCHAR(255) | Yes | Technology stack |
| domain | VARCHAR(100) | Yes | Domain classification |
| client_name | VARCHAR(255) | Yes | Client account |
| location_city | VARCHAR(100) | Yes | Delivery city |
| start_date | TIMESTAMPTZ | Yes | Batch start |
| end_date | TIMESTAMPTZ | Yes | Batch end |
| batch_request_date | TIMESTAMPTZ | No | Request creation date |
| training_days | INTEGER | No | Planned training days |
| calendar_days | INTEGER | Yes | Calendar days |
| total_hours | NUMERIC(8,2) | No | Batch total hours |
| total_enrollments | INTEGER | No | Count of enrollments |
| status | VARCHAR(50) | No | Lifecycle status |
| is_schema_locked | BOOLEAN | No | Schema freeze flag |
| approver_1_id | UUID | Yes | First approver |
| approver_2_id | UUID | Yes | Second approver |
| approver_1_status | VARCHAR(20) | No | Approver 1 status |
| approver_2_status | VARCHAR(20) | No | Approver 2 status |
| approver_1_approved_at | TIMESTAMPTZ | Yes | Approval timestamp |
| approver_2_approved_at | TIMESTAMPTZ | Yes | Approval timestamp |
| primary_manager_id | UUID | Yes | Manager owner |
| coordinator_id | UUID | Yes | Coordinator owner |
| sales_spoc_id | UUID | Yes | Sales SPOC |
| faculty_assigned_text | VARCHAR(500) | Yes | Legacy faculty text |
| finance_status | VARCHAR(50) | No | Finance checkpoint |
| finance_status_check_date | DATE | Yes | Finance check date |
| finance_check | INTEGER | Yes | Finance check value |
| batch_avg_feedback | NUMERIC(3,2) | Yes | Average feedback score |
| batch_nps | NUMERIC(6,2) | Yes | NPS score |
| nps_total_responses | INTEGER | Yes | Feedback response count |
| nps_promoters | INTEGER | Yes | Promoter count |
| nps_passives | INTEGER | Yes | Passive count |
| nps_detractors | INTEGER | Yes | Detractor count |
| remarks | TEXT | Yes | Batch remarks |
| created_at | TIMESTAMPTZ | No | Audit timestamp |
| updated_at | TIMESTAMPTZ | No | Audit timestamp |

### 6. batch_categories, delivery_modes, accommodations, entities
Common option/reference tables used for batch metadata.

Each has the following shape:

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| name | VARCHAR(100) | No | Unique option value |
| description | VARCHAR(255) | Yes | Optional description |
| is_active | BOOLEAN | No | Active flag |
| created_at | TIMESTAMPTZ | No | Audit timestamp |
| updated_at | TIMESTAMPTZ | No | Audit timestamp |

### 7. approval_configurations
Stores approval assignment configuration between approvers.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| approver_1_id | UUID | Yes | FK to users.id |
| approver_2_id | UUID | Yes | FK to users.id |
| updated_at | TIMESTAMPTZ | No | Audit timestamp |

### 8. training_sessions
Represents the planned day-wise schedule for a batch.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| batch_id | UUID | No | FK to batches.id |
| sequence_number | INTEGER | Yes | Session sequence |
| week | VARCHAR(50) | Yes | Week label |
| session_date | DATE | No | Session date |
| day_name | VARCHAR(20) | Yes | Day label |
| start_time | TIME | Yes | Planned start |
| end_time | TIME | Yes | Planned end |
| duration_hours | NUMERIC(5,2) | No | Duration |
| module | VARCHAR(255) | No | Module title |
| trainer_name | VARCHAR(255) | Yes | Trainer name |
| status | VARCHAR(30) | No | Scheduled / InProgress / etc. |
| created_at | TIMESTAMPTZ | No | Audit timestamp |
| updated_at | TIMESTAMPTZ | No | Audit timestamp |

### 9. faculty_utilization
Tracks actual delivery and utilization records for faculty sessions.

| Column | Type | Nullable | Notes |
|---|---|---:|---|
| id | UUID | No | Primary key |
| batch_id | UUID | No | FK to batches.id |
| training_session_id | UUID | Yes | FK to training_sessions.id |
| faculty_name | VARCHAR(255) | No | Faculty display value |
| date_of_training | TIMESTAMPTZ | No | Delivery timestamp |
| start_time | TIME | Yes | Actual start time |
| end_time | TIME | Yes | Actual end time |
| topic | VARCHAR(255) | No | Session topic |
| no_of_hours | NUMERIC(5,2) | No | Hours delivered |
| venue | VARCHAR(255) | Yes | Delivery venue |
| location_city | VARCHAR(100) | Yes | City |
| mode_of_delivery | VARCHAR(50) | No | Online / Offline / etc. |
| status | VARCHAR(30) | No | Scheduled / Completed / Cancelled |
| feedback_submitted | BOOLEAN | No | Feedback submitted flag |
| feedback_rating | NUMERIC(3,2) | Yes | Feedback score |
| feedback_notes | TEXT | Yes | Detailed feedback |
| outcome_reason | TEXT | Yes | Outcome explanation |
| outcome_at | TIMESTAMPTZ | Yes | Outcome timestamp |
| outcome_by | UUID | Yes | FK to users.id |
| replacement_session_id | UUID | Yes | FK to faculty_utilization.id |
| created_at | TIMESTAMPTZ | No | Audit timestamp |
| updated_at | TIMESTAMPTZ | No | Audit timestamp |

## Relationships summary

- Team 1 --- * User
- Role 1 --- * User
- User 1 --- * User (manager hierarchy)
- User 1 --- * UserManagerMapping
- Batch * --- 1 User (primary_manager, coordinator, approver, sales_spoc)
- Batch 1 --- * TrainingSession
- Batch 1 --- * FacultyUtilization
- TrainingSession 1 --- * FacultyUtilization
- FacultyUtilization * --- 1 FacultyUtilization (replacement_session)

## Notes

- The schema currently supports both planned schedule records and actual delivery logs.
- training_sessions stores the ingested curriculum plan.
- faculty_utilization stores actual logged sessions, utilization, outcomes, and feedback.
- The application treats these as distinct but linked entities.

## Source

The schema above is derived from the SQLAlchemy model files in the backend:
- backend/app/models/batch.py
- backend/app/models/user.py
- backend/app/models/session.py
