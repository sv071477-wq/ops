# Enterprise Operations Database Schema README
## 3-Workflow Operations & Faculty Utilization Platform

---

## 1. Overview & Architecture Context

This document serves as the comprehensive **Database Architecture & Schema Reference** for the Enterprise Operations & Faculty Utilization Platform.

The platform centralizes large-scale corporate training delivery, bootcamp operations, faculty utilization tracking, and real-time MBR (Monthly Business Review) analytics. It replaces fragmented Excel workbooks (`1.MBR_Active Batches.xlsx` and `Faculty_Utilisation - Ver 2.0.xlsx`) with an enterprise-grade, normalized **PostgreSQL 15** relational database.

```mermaid
graph TD
    subgraph Core Entities
        U[users]
        UMM[user_manager_mappings]
        C[clients]
        F[faculty]
    end

    subgraph Batch Operations Workflow 1
        B[batches]
        BCM[batch_co_managers]
        BNC[batch_nps_closure\n(Quality Gate 2)]
    end

    subgraph Faculty Schedule & Utilization Workflow 2 & 3
        TS[training_sessions]
        SF[session_feedback\n(Quality Gate 1)]
        FSL[faculty_fms_sync_logs\n(Optional FMS Integration)]
    end

    U -->|1:N Manager of| UMM
    U -->|1:N Coordinator in| UMM
    U -->|1:N Primary Manager| B
    U -->|1:N Coordinator| B
    U -->|1:N Sales SPOC| B
    U -->|1:N Co-Manager| BCM
    B -->|1:N Co-Managers| BCM
    B -->|1:N Has Sessions| TS
    F -->|1:N Delivers| TS
    TS -->|1:1 Rated By| SF
    B -->|1:1 Closed By| BNC
    F -->|1:N Syncs| FSL
```

---

## 2. Complete Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ USER_MANAGER_MAPPINGS : "manager_id / coordinator_id"
    USERS ||--o{ BATCHES : "primary_manager_id"
    USERS ||--o{ BATCHES : "coordinator_id"
    USERS ||--o{ BATCHES : "sales_spoc_id"
    USERS ||--o{ BATCH_CO_MANAGERS : "manager_id"
    BATCHES ||--o{ BATCH_CO_MANAGERS : "batch_id"
    BATCHES ||--o{ TRAINING_SESSIONS : "batch_id"
    BATCHES ||--o| BATCH_NPS_CLOSURE : "batch_id"
    FACULTY ||--o{ TRAINING_SESSIONS : "faculty_id"
    FACULTY ||--o{ FACULTY_FMS_SYNC_LOGS : "faculty_id"
    TRAINING_SESSIONS ||--o| SESSION_FEEDBACK : "session_id"

    USERS {
        uuid id PK "UUIDv4 Primary Key"
        varchar email UK "Unique corporate email"
        varchar hashed_password "Argon2 / BCrypt hash"
        varchar full_name "Full name"
        varchar role "Admin, Manager, Coordinator, Sales, Faculty"
        boolean is_active "Active flag"
        timestamptz created_at "UTC creation timestamp"
    }

    USER_MANAGER_MAPPINGS {
        uuid id PK "UUIDv4 Primary Key"
        uuid coordinator_id FK "users.id (Coordinator)"
        uuid manager_id FK "users.id (Manager)"
        timestamptz assigned_at "UTC assignment timestamp"
    }

    CLIENTS {
        uuid id PK "UUIDv4 Primary Key"
        varchar name UK "Client organization name"
        varchar code "Client unique code (e.g. DEL, IBM)"
        varchar vertical "IT/ITES, DS/ITES, BFSI, Retail"
        varchar primary_contact_email "Contact email"
        timestamptz created_at "UTC creation timestamp"
    }

    FACULTY {
        uuid id PK "UUIDv4 Primary Key"
        varchar full_name "Trainer full name"
        varchar email "Contact email"
        varchar phone "Contact phone number"
        varchar faculty_type "Internal Full-time, External Consultant, HOP"
        varchar domain "IT/ITES, Cloud, DS/ML, CyberSecurity, FullStack"
        varchar fms_external_id UK "External FMS ID reference"
        varchar fms_status "Active, Flagged, Blocked"
        numeric standard_hourly_rate "Commercial billing rate"
        boolean is_active "Active status flag"
        timestamptz created_at "UTC creation timestamp"
    }

    BATCHES {
        uuid id PK "UUIDv4 Primary Key"
        varchar batch_id UK "Immutable locked ID e.g. DTA_PysparkScala_SOW56_ILT_B2"
        varchar approval_id "Financial SOW Reference"
        varchar category "Bootcamp, RBT, PJP, Workshop"
        varchar residential_type "R, NR"
        varchar program_name "Curriculum program title"
        varchar technology "Technology stack"
        varchar domain "High-level domain"
        varchar client_name "Client name string"
        varchar delivery_mode "Online, F2F, Blended, Offline"
        varchar location_city "City location"
        timestamptz start_date "Commencement timestamp (UTC)"
        timestamptz end_date "Completion timestamp (UTC)"
        timestamptz batch_request_date "Request timestamp (UTC)"
        int training_days "Scheduled active training days"
        int calendar_days "Elapsed calendar span"
        numeric total_hours "Total planned curriculum hours"
        int total_enrollments "Total student headcount"
        int residential_enrollments "Residential headcount"
        int non_residential_enrollments "Non-residential headcount"
        varchar status "Requested, Approved, Upcoming, Ongoing, Completed, Cancelled, OnHold"
        boolean is_schema_locked "Manager approval lock flag"
        uuid primary_manager_id FK "users.id"
        uuid coordinator_id FK "users.id"
        uuid sales_spoc_id FK "users.id"
        varchar faculty_assigned_text "Legacy faculty assignment string"
        varchar finance_status "Pending, Cleared, Invoiced"
        numeric batch_avg_feedback "Aggregated feedback (1.00-5.00)"
        numeric total_feedback_score "Total feedback score"
        numeric batch_nps "Net Promoter Score (0-10 or -100 to 100)"
        text retrospective_notes "Gate 2 closure retrospective"
        text remarks "Operational remarks"
        text comments "Operational comments"
        timestamptz created_at "UTC creation timestamp"
        timestamptz updated_at "UTC update timestamp"
    }

    BATCH_CO_MANAGERS {
        uuid id PK "UUIDv4 Primary Key"
        uuid batch_id FK "batches.id"
        uuid manager_id FK "users.id"
        timestamptz added_at "UTC assignment timestamp"
    }

    TRAINING_SESSIONS {
        uuid id PK "UUIDv4 Primary Key"
        uuid batch_id FK "batches.id"
        timestamptz date_of_training "Session date timestamp in UTC"
        time start_time "Start time (e.g. 09:00:00)"
        time end_time "End time (e.g. 18:00:00)"
        varchar topic "Curriculum topic/module"
        uuid faculty_id FK "faculty.id"
        numeric no_of_hours "Hours delivered (e.g. 8.00, 4.00, 2.00)"
        varchar venue "Classroom or Zoom link"
        varchar location_city "City / Center"
        varchar mode_of_delivery "Online, Offline, F2F"
        varchar status "Scheduled, InProgress, Completed, Cancelled, Rescheduled"
        boolean feedback_submitted "Check 1 gate status"
        timestamptz created_at "UTC creation timestamp"
    }

    SESSION_FEEDBACK {
        uuid id PK "UUIDv4 Primary Key"
        uuid session_id FK "training_sessions.id (Unique 1:1)"
        numeric rating "Rating between 1.00 and 5.00"
        text topic_feedback "Mandatory topic delivery summary"
        text faculty_observations "Faculty delivery observations"
        int total_students_present "Attendance headcount"
        timestamptz submitted_at "UTC submission timestamp"
        uuid submitted_by FK "users.id"
    }

    BATCH_NPS_CLOSURE {
        uuid id PK "UUIDv4 Primary Key"
        uuid batch_id FK "batches.id (Unique 1:1)"
        numeric nps_score "NPS score (0.0 to 10.0)"
        numeric net_promoter_index "NPS index (-100 to 100)"
        int total_responses "Total response count"
        int promoters_count "Promoters count"
        int passive_count "Passive count"
        int detractors_count "Detractors count"
        numeric average_feedback_score "Overall feedback (1.00-5.00)"
        text retrospective_notes "Mandatory retrospective learnings"
        text client_feedback "Client POC feedback"
        timestamptz closed_at "UTC closure timestamp"
        uuid closed_by FK "users.id"
    }

    FACULTY_FMS_SYNC_LOGS {
        uuid id PK "UUIDv4 Primary Key"
        uuid faculty_id FK "faculty.id"
        varchar sync_event "HOURS_UPDATE, RATING_SYNC, STATUS_CHANGE"
        jsonb payload "Sync payload dispatched to FMS"
        varchar status "SUCCESS, FAILED, PENDING"
        timestamptz timestamp "UTC sync timestamp"
    }
```

---

## 3. Table-by-Table Detailed Schema Specifications

### 3.1 Table: `users`
- **Purpose**: System users, authentication credentials, roles, and administrative statuses.
- **Access Scopes**: Admin, Manager, Coordinator, Sales, Faculty.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Internal unique user ID. |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL, INDEX` | User corporate login email address. |
| `hashed_password`| `VARCHAR(255)` | `NOT NULL` | Securely hashed password. |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | Full user display name. |
| `role` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Coordinator'` | User role: `Admin`, `Manager`, `Coordinator`, `Sales`, `Faculty`. |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Soft-deactivation status. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC creation timestamp. |

---

### 3.2 Table: `user_manager_mappings`
- **Purpose**: Supports the flexible shared-coordinator model where coordinators report to one or multiple delivery managers.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Mapping row primary key. |
| `coordinator_id` | `UUID` | `FK users.id ON DELETE CASCADE, NOT NULL` | Assigned coordinator ID. |
| `manager_id` | `UUID` | `FK users.id ON DELETE CASCADE, NOT NULL` | Supervising manager ID. |
| `assigned_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC mapping timestamp. |

---

### 3.3 Table: `clients`
- **Purpose**: Enterprise client accounts (e.g. *Deloitte, Capgemini, IBM, Shell, ICICI Bank*).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Client record primary key. |
| `name` | `VARCHAR(255)` | `UNIQUE, NOT NULL, INDEX` | Client organization title. |
| `code` | `VARCHAR(50)` | `NULLABLE` | Short account code (e.g. `DEL`, `CAPG`). |
| `vertical` | `VARCHAR(100)` | `NOT NULL` | Client business vertical (e.g. `IT/ITES`, `BFSI`). |
| `primary_contact_email`| `VARCHAR(255)`| `NULLABLE` | Primary client stakeholder email. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC creation timestamp. |

---

### 3.4 Table: `faculty`
- **Purpose**: Centralized trainer directory distinguishing between full-time salaried faculty and external contracted consultants, integrated with FMS.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Faculty unique identifier. |
| `full_name` | `VARCHAR(255)` | `NOT NULL, INDEX` | Faculty full name. |
| `email` | `VARCHAR(255)` | `NULLABLE` | Faculty email address. |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Contact phone number. |
| `faculty_type` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Internal Full-time'`| `Internal Full-time`, `External Consultant`, `HOP`. |
| `domain` | `VARCHAR(100)` | `NULLABLE` | Tech domain (`IT/ITES`, `Cloud`, `DS/ML`). |
| `fms_external_id` | `VARCHAR(100)` | `UNIQUE, NULLABLE` | External ID reference in FMS. |
| `fms_status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Active'` | `Active`, `Flagged`, `Blocked`. |
| `standard_hourly_rate`| `NUMERIC(10, 2)`| `NOT NULL, DEFAULT 0.00` | Hourly trainer rate in INR. |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Availability flag. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC creation timestamp. |

---

### 3.5 Table: `batches` (Streamlined Operations Ledger)
- **Purpose**: Core entity managing batch lifecycles, SOW approvals, enrollments, timelines, and quality aggregates.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Primary Key. |
| `batch_id` | `VARCHAR(255)` | `UNIQUE, NOT NULL, INDEX` | Immutable, locked Batch ID. |
| `approval_id` | `VARCHAR(100)` | `NULLABLE, INDEX` | Financial SOW reference. |
| `category` | `VARCHAR(100)` | `NOT NULL, DEFAULT 'Bootcamp'`| `Bootcamp`, `RBT`, `PJP`, `Workshop`. |
| `residential_type` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'NR'` | `R`, `NR`. |
| `program_name` | `VARCHAR(255)` | `NOT NULL, INDEX` | Program title. |
| `technology` | `VARCHAR(255)` | `NULLABLE` | Skill / Tech stack taught. |
| `domain` | `VARCHAR(100)` | `NULLABLE` | Tech domain. |
| `client_name` | `VARCHAR(255)` | `NULLABLE, INDEX` | Client name string. |
| `delivery_mode` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Online'` | `Online`, `F2F`, `Blended`, `Offline`. |
| `location_city` | `VARCHAR(100)` | `NULLABLE` | Center city. |
| `start_date` | `TIMESTAMPTZ` | `NULLABLE, INDEX` | Scheduled start UTC timestamp. |
| `end_date` | `TIMESTAMPTZ` | `NULLABLE, INDEX` | Scheduled end UTC timestamp. |
| `batch_request_date`| `TIMESTAMPTZ`| `NULLABLE` | Batch initial request date. |
| `training_days` | `INTEGER` | `NOT NULL, DEFAULT 0` | Scheduled active days. |
| `calendar_days` | `INTEGER` | `NULLABLE, DEFAULT 0` | Calendar days span. |
| `total_hours` | `NUMERIC(8, 2)`| `NOT NULL, DEFAULT 0.00` | Total curriculum hours. |
| `total_enrollments` | `INTEGER` | `NOT NULL, DEFAULT 0` | Enrolled candidates count. |
| `residential_enrollments`| `INTEGER`| `NOT NULL, DEFAULT 0` | Residential count. |
| `non_residential_enrollments`|`INTEGER`| `NOT NULL, DEFAULT 0` | Non-residential count. |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Requested'`| `Requested`, `Approved`, `Upcoming`, `Ongoing`, `Completed`, `Cancelled`, `OnHold`. |
| `is_schema_locked` | `BOOLEAN` | `NOT NULL, DEFAULT false` | Schema lock flag. |
| `primary_manager_id`| `UUID` | `FK users.id ON DELETE SET NULL`| Assigned Program Manager. |
| `coordinator_id` | `UUID` | `FK users.id ON DELETE SET NULL`| Assigned Operations Coordinator. |
| `sales_spoc_id` | `UUID` | `FK users.id ON DELETE SET NULL`| Assigned Enterprise Sales SPOC. |
| `faculty_assigned_text`| `VARCHAR(500)`| `NULLABLE` | Raw legacy trainer text. |
| `finance_status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Pending'` | Financial milestone status. |
| `batch_avg_feedback`| `NUMERIC(3, 2)`| `NULLABLE` | Cumulative feedback rating (1.00-5.00). |
| `total_feedback_score`| `NUMERIC(10, 2)`| `NULLABLE` | Cumulative score points. |
| `batch_nps` | `NUMERIC(4, 2)`| `NULLABLE` | Batch NPS score. |
| `retrospective_notes`| `TEXT` | `NULLABLE` | Gate 2 retrospective notes. |
| `remarks` | `TEXT` | `NULLABLE` | Operational remarks. |
| `comments` | `TEXT` | `NULLABLE` | Operational comments. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC created timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC updated timestamp. |

---

### 3.6 Table: `batch_co_managers`
- **Purpose**: Enables cross-vertical co-ownership of batches across multiple managers.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Record primary key. |
| `batch_id` | `UUID` | `FK batches.id ON DELETE CASCADE, NOT NULL` | Target batch ID. |
| `manager_id` | `UUID` | `FK users.id ON DELETE CASCADE, NOT NULL` | Secondary / Co-manager ID. |
| `added_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC assignment timestamp. |

---

### 3.7 Table: `training_sessions`
- **Purpose**: Granular daily session delivery ledger (replaces 41,198+ rows in `Faculty_Utilisation - Ver 2.0.xlsx`).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Session primary key. |
| `batch_id` | `UUID` | `FK batches.id ON DELETE CASCADE, NOT NULL` | Associated batch. |
| `date_of_training`| `TIMESTAMPTZ`| `NOT NULL, INDEX` | Session date in UTC. |
| `start_time` | `TIME` | `NULLABLE` | Start time (e.g. `09:00:00`). |
| `end_time` | `TIME` | `NULLABLE` | End time (e.g. `18:00:00`). |
| `topic` | `VARCHAR(255)` | `NOT NULL` | Curriculum syllabus module delivered. |
| `faculty_id` | `UUID` | `FK faculty.id ON DELETE RESTRICT, NOT NULL` | Assigned trainer. |
| `no_of_hours` | `NUMERIC(4, 2)`| `NOT NULL, DEFAULT 8.00` | Delivered duration (e.g. 8.0h, 4.0h). |
| `venue` | `VARCHAR(255)` | `NULLABLE` | Physical room or online meeting link. |
| `location_city` | `VARCHAR(100)` | `NULLABLE` | Delivery city. |
| `mode_of_delivery`| `VARCHAR(50)` | `NOT NULL, DEFAULT 'Online'` | `Online`, `Offline`, `F2F`. |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'Scheduled'` | `Scheduled`, `InProgress`, `Completed`, `Cancelled`. |
| `feedback_submitted`| `BOOLEAN` | `NOT NULL, DEFAULT false` | Checkpoint 1 compliance flag. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC creation timestamp. |

---

### 3.8 Table: `session_feedback` (Quality Gate 1)
- **Purpose**: Enforces mandatory session-level quality ratings (1.00 to 5.00) and feedback before a session can be closed.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Feedback record primary key. |
| `session_id` | `UUID` | `FK training_sessions.id ON DELETE CASCADE, UNIQUE, NOT NULL` | 1:1 linked session ID. |
| `rating` | `NUMERIC(3, 2)`| `NOT NULL` (CHECK `rating BETWEEN 1.0 AND 5.0`) | Module delivery rating score. |
| `topic_feedback` | `TEXT` | `NOT NULL` | Topics covered summary. |
| `faculty_observations`| `TEXT` | `NULLABLE` | Delivery feedback on trainer. |
| `total_students_present`|`INTEGER`| `NOT NULL, DEFAULT 0` | Student attendance headcount. |
| `submitted_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC submission timestamp. |
| `submitted_by` | `UUID` | `FK users.id ON DELETE SET NULL` | Submitting coordinator ID. |

---

### 3.9 Table: `batch_nps_closure` (Quality Gate 2)
- **Purpose**: Enforces mandatory batch-level Net Promoter Score (NPS) and retrospective notes before a batch can transition to `Completed`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | NPS closure record primary key. |
| `batch_id` | `UUID` | `FK batches.id ON DELETE CASCADE, UNIQUE, NOT NULL` | 1:1 linked batch ID. |
| `nps_score` | `NUMERIC(4, 2)`| `NOT NULL` | Overall batch NPS score (0 to 10). |
| `net_promoter_index`| `NUMERIC(5, 2)`| `NULLABLE` | Standard NPS Index (-100 to +100). |
| `total_responses` | `INTEGER` | `NOT NULL, DEFAULT 0` | Total feedback responses. |
| `promoters_count` | `INTEGER` | `NOT NULL, DEFAULT 0` | Promoters (Score 9-10). |
| `passive_count` | `INTEGER` | `NOT NULL, DEFAULT 0` | Passives (Score 7-8). |
| `detractors_count`| `INTEGER` | `NOT NULL, DEFAULT 0` | Detractors (Score 0-6). |
| `average_feedback_score`|`NUMERIC(3, 2)`| `NULLABLE` | Aggregated batch feedback. |
| `retrospective_notes`| `TEXT` | `NOT NULL` | Mandatory retrospective learnings. |
| `client_feedback` | `TEXT` | `NULLABLE` | Client POC remarks. |
| `closed_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC closure timestamp. |
| `closed_by` | `UUID` | `FK users.id ON DELETE SET NULL` | Closing manager / coordinator ID. |

---

### 3.10 Table: `faculty_fms_sync_logs`
- **Purpose**: Audit and dispatch logging for asynchronous updates pushed to external Faculty Management Systems.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Audit log primary key. |
| `faculty_id` | `UUID` | `FK faculty.id ON DELETE CASCADE, NOT NULL` | Target faculty ID. |
| `sync_event` | `VARCHAR(100)` | `NOT NULL` | Event type (`HOURS_UPDATE`, `RATING_SYNC`). |
| `payload` | `JSONB` | `NOT NULL` | Raw JSON payload dispatched. |
| `status` | `VARCHAR(50)` | `NOT NULL` | `SUCCESS`, `FAILED`, `PENDING`. |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | UTC dispatch timestamp. |

---

## 4. Key Design Principles & Data Standards

1. **Strict UTC Timestamps (`TIMESTAMPTZ`)**:
   - All temporal fields (`start_date`, `end_date`, `date_of_training`, `created_at`) are stored in `TIMESTAMPTZ` in UTC to prevent timezone offsets between Bangalore, US client offices, and AWS cloud servers.
2. **UUIDv4 Primary Keys**:
   - Every entity uses high-entropy `UUIDv4` identifiers, ensuring safe multi-environment merging, decoupling from internal sequential IDs, and tamper-resistant API endpoints.
3. **Audit Trail & Schema Locking**:
   - `batches.is_schema_locked` ensures that once a delivery manager approves a batch and assigns an `Approval ID`, core commercial fields cannot be modified without elevated manager privileges.
4. **Denormalized Fast Indexes**:
   - Composite B-Tree indexes on `(status, start_date)`, `(primary_manager_id, status)`, and `(client_name, status)` ensure sub-millisecond query performance on live manager dashboards and analytics queries.

---

## 5. Database Setup, Migrations & Seeding

### 5.1 Environment Configuration (`backend/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ops_platform
SECRET_KEY=your-super-secret-jwt-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 5.2 Running Database via Docker Compose
```bash
# Using Docker Compose
docker compose up -d db

# Or using Docker Compose
docker compose up -d postgres
```

### 5.3 Executing Migrations & Seeding
```bash
cd backend

# Run Alembic migrations
alembic upgrade head

# Seed initial admin users and sample batch data
python -m app.db.init_db
```

### 5.4 Default Seeded Accounts for Testing
- **Admin**: `admin@enterprise-ops.com` / `Admin@12345`
- **Manager**: `manager@enterprise-ops.com` / `Manager@12345`
- **Coordinator**: `coordinator@enterprise-ops.com` / `Coord@12345`
- **Sales SPOC**: `sales@enterprise-ops.com` / `Sales@12345`
