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

---

## DBML Schema

```dbml
Table users {
  id uuid [pk]
  email varchar(255) [not null, unique]
  hashed_password varchar(255) [not null]
  full_name varchar(255) [not null]
  role varchar(50) [not null]
  role_id uuid [null]
  team_id uuid [null]
  manager_id uuid [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]

  indexes {
    (email) [unique]
    (role_id)
    (team_id)
    (manager_id)
  }
}

Table roles {
  id uuid [pk]
  name varchar(100) [not null, unique]
  system_role varchar(50) [not null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
}

Table teams {
  id uuid [pk]
  name varchar(100) [not null, unique]
  department varchar(100) [not null, default: 'Ops']
  description varchar(255) [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
}

Table user_manager_mappings {
  id uuid [pk]
  coordinator_id uuid [not null]
  manager_id uuid [not null]
  assigned_at timestamptz [not null]
}

Table batch_categories {
  id uuid [pk]
  name varchar(100) [not null, unique]
  description varchar(255) [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table delivery_modes {
  id uuid [pk]
  name varchar(100) [not null, unique]
  description varchar(255) [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table accommodations {
  id uuid [pk]
  name varchar(100) [not null, unique]
  description varchar(255) [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table entities {
  id uuid [pk]
  name varchar(100) [not null, unique]
  description varchar(255) [null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table batches {
  id uuid [pk]
  batch_id varchar(255) [not null, unique]
  sow_number varchar(100) [null]
  approval_id varchar(100) [null]
  category varchar(100) [not null, default: 'Bootcamp']
  entity_id uuid [null]
  category_id uuid [null]
  delivery_mode_id uuid [null]
  accommodation_id uuid [null]
  program_name varchar(255) [not null]
  technology varchar(255) [null]
  domain varchar(100) [null]
  client_name varchar(255) [null]
  location_city varchar(100) [null]
  start_date timestamptz [null]
  end_date timestamptz [null]
  batch_request_date timestamptz [not null]
  training_days integer [not null, default: 0]
  calendar_days integer [null]
  total_hours numeric(8,2) [not null, default: 0.00]
  total_enrollments integer [not null, default: 0]
  status varchar(50) [not null, default: 'Requested']
  is_schema_locked boolean [not null, default: false]
  approver_1_id uuid [null]
  approver_2_id uuid [null]
  approver_1_status varchar(20) [not null, default: 'Pending']
  approver_2_status varchar(20) [not null, default: 'Pending']
  approver_1_approved_at timestamptz [null]
  approver_2_approved_at timestamptz [null]
  primary_manager_id uuid [null]
  coordinator_id uuid [null]
  sales_spoc_id uuid [null]
  faculty_assigned_text varchar(500) [null]
  finance_status varchar(50) [not null, default: 'Pending']
  finance_status_check_date date [null]
  finance_check integer [null]
  batch_avg_feedback numeric(3,2) [null]
  batch_nps numeric(6,2) [null]
  nps_total_responses integer [null]
  nps_promoters integer [null]
  nps_passives integer [null]
  nps_detractors integer [null]
  remarks text [null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table approval_configurations {
  id uuid [pk]
  approver_1_id uuid [null]
  approver_2_id uuid [null]
  updated_at timestamptz [not null]
}

Table training_sessions {
  id uuid [pk]
  batch_id uuid [not null]
  sequence_number integer [null]
  week varchar(50) [null]
  session_date date [not null]
  day_name varchar(20) [null]
  start_time time [null]
  end_time time [null]
  duration_hours numeric(5,2) [not null, default: 8.00]
  module varchar(255) [not null]
  trainer_name varchar(255) [null]
  status varchar(30) [not null, default: 'Scheduled']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table faculty_utilization {
  id uuid [pk]
  batch_id uuid [not null]
  training_session_id uuid [null]
  faculty_name varchar(255) [not null]
  date_of_training timestamptz [not null]
  start_time time [null]
  end_time time [null]
  topic varchar(255) [not null]
  no_of_hours numeric(5,2) [not null, default: 8.00]
  venue varchar(255) [null]
  location_city varchar(100) [null]
  mode_of_delivery varchar(50) [not null, default: 'Online']
  status varchar(30) [not null, default: 'Scheduled']
  feedback_submitted boolean [not null, default: false]
  feedback_rating numeric(3,2) [null]
  feedback_notes text [null]
  outcome_reason text [null]
  outcome_at timestamptz [null]
  outcome_by uuid [null]
  replacement_session_id uuid [null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Ref: users.role_id > roles.id
Ref: users.team_id > teams.id
Ref: users.manager_id > users.id
Ref: user_manager_mappings.coordinator_id > users.id
Ref: user_manager_mappings.manager_id > users.id
Ref: batches.entity_id > entities.id
Ref: batches.category_id > batch_categories.id
Ref: batches.delivery_mode_id > delivery_modes.id
Ref: batches.accommodation_id > accommodations.id
Ref: batches.primary_manager_id > users.id
Ref: batches.coordinator_id > users.id
Ref: batches.sales_spoc_id > users.id
Ref: batches.approver_1_id > users.id
Ref: batches.approver_2_id > users.id
Ref: approval_configurations.approver_1_id > users.id
Ref: approval_configurations.approver_2_id > users.id
Ref: training_sessions.batch_id > batches.id
Ref: faculty_utilization.batch_id > batches.id
Ref: faculty_utilization.training_session_id > training_sessions.id
Ref: faculty_utilization.outcome_by > users.id
Ref: faculty_utilization.replacement_session_id > faculty_utilization.id
```
