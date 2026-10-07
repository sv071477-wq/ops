# Operations Management System (Ops)

An enterprise operations platform for managing corporate training batches, training schedules, faculty allocations, financial milestone tracking, and quality feedback.

---

## Architecture Overview

* **Frontend**: Next.js (TypeScript, React)
* **Backend**: FastAPI (Python 3.12, SQLAlchemy, Pydantic v2)
* **Database**: PostgreSQL with Alembic migrations
* **Containerization**: Docker Compose (`db`, `backend`, `frontend`)

---

## Core Data Architecture: `batches` vs. `training_sessions`

In this system, `batches` and `training_sessions` form a **parent–child (one-to-many)** relationship representing two distinct operational layers:

```mermaid
erDiagram
    BATCHES ||--o{ TRAINING_SESSIONS : "1 Batch has Many Sessions"
    BATCHES {
        uuid id PK
        string batch_id UK
        string program_name
        string client_name
        datetime start_date
        datetime end_date
        int training_days
        decimal total_hours
        string status
        string finance_status
        decimal batch_avg_feedback
        decimal batch_nps
    }
    TRAINING_SESSIONS {
        uuid id PK
        uuid batch_id FK
        datetime date_of_training
        time start_time
        time end_time
        string topic
        string faculty_name
        decimal no_of_hours
        string mode_of_delivery
        string status
        decimal feedback_rating
    }
```

### Key Differences

| Feature / Dimension | `batches` (Parent) | `training_sessions` (Child) |
| :--- | :--- | :--- |
| **Concept & Scope** | **Macro-level program / contract engagement**. Tracks the overarching training program across its full lifecycle. | **Micro-level delivery unit**. Represents an individual day/time block of training. |
| **Cardinality** | 1 batch has many sessions (`cascade="all, delete-orphan"`). | Belongs to 1 batch via `batch_id` foreign key. |
| **Time Granularity** | Macro timeline (`start_date`, `end_date`, `batch_request_date`, `training_days`, cumulative `total_hours`). | Micro timeline (`date_of_training`, `start_time`, `end_time`, `no_of_hours`). |
| **Topic & Syllabus** | Program name, technology stack, and domain categorization. | Daily granular module / topic taught. |
| **Personnel Roles** | Governance & ownership: `primary_manager_id`, `coordinator_id`, `sales_spoc_id`, and tier approvers. | Operational delivery: `faculty_name` assigned for that specific session. |
| **Status & Lifecycle** | Governance state: `Requested`, `Approved`, `Upcoming`, `Ongoing`, `Completed`, `Cancelled`, `OnHold`. | Execution state: `Scheduled`, `InProgress`, `Completed`, `Cancelled`, `Rescheduled`. |
| **Quality & Feedback** | Program-level aggregated quality: `batch_avg_feedback`, overall `batch_nps`, promoters/passives/detractors counts. | Day-level quality: `feedback_submitted`, `feedback_rating` (1–5), and `feedback_notes`. |
| **Commercials & SOW** | Financial contract: `sow_number`, `approval_id`, `finance_status` (`Pending`, `Cleared`), `finance_status_check_date`. | None (financials are exclusively managed at the batch level). |

---

## Schedule Ingestion & Storage Lifecycle

When training timetables (Excel `.xlsx`, `.xls`, or `.csv`) are ingested, the system processes them in a **two-phase pipeline (Preview $\rightarrow$ Persist)**:

```mermaid
sequenceDiagram
    autonumber
    actor User as Coordinator / Manager
    participant Client as Frontend
    participant API as Backend (FastAPI)
    participant Service as ExcelIngestionService
    participant DB as PostgreSQL (training_sessions)

    Note over User,Service: Phase 1: Ingestion & Preview (In-Memory)
    User->>Client: Upload timetable spreadsheet
    Client->>API: POST /api/v1/schedules/ingest
    API->>Service: ingest_schedule_file(bytes)
    Service-->>API: ScheduleIngestResponse (in-memory preview)
    API-->>Client: Parsed rows, date/time slots, validation errors
    Note over Client: User reviews extracted schedule & corrects any bad rows

    Note over User,DB: Phase 2: Confirmation & Persistence (Database)
    User->>Client: Confirm & Apply Schedule
    Client->>API: POST /api/v1/schedules/apply
    API->>Service: apply_schedule_items(batch_id, items)
    Service->>Service: Row validation (date bounds, duplicates, in-file overlaps)
    Service->>DB: INSERT into training_sessions (linked to batch_id)
    Service->>DB: INSERT placeholder training_sessions for any missing training_days
    DB-->>API: Committed session records
    API-->>Client: ScheduleApplyResponse (applied session IDs)
```

### Where is the ingested data stored?

1. **Raw File**:
   * The uploaded Excel/CSV file is processed directly **in memory** via Pandas. The raw spreadsheet file is **not stored** on disk or in the database.
2. **Phase 1: Ingestion (`POST /api/v1/schedules/ingest`)**:
   * **Stored in-memory only**. It does **not** modify or write to the database.
   * Performs column aliasing, header detection, date/time parsing, and returns an extracted schedule preview (`ScheduleIngestResponse`) for the user to review.
3. **Phase 2: Application (`POST /api/v1/schedules/apply`)**:
   * **Stored in the PostgreSQL `training_sessions` table**.
   * Validates dates against `batch.start_date` and `batch.end_date`, checks for duplicate sessions and for time overlaps inside the uploaded file. Faculty double-booking across batches is **not** checked.
   * Inserts individual records into `training_sessions` mapped to the parent `batch_id`.
   * If the batch requires more `training_days` than defined in the schedule, the system automatically creates placeholder sessions marked as `"Generated training day - details required"`.

---

## Quickstart Guide

### 1. Start Services

```powershell
docker compose up -d --build
```

The stack exposes Nginx at `http://localhost:8080`. It routes `/api/*` and
`/health` to FastAPI and all other requests to Next.js. Redis is available to
the backend at `redis:6379` and is persisted in the `redisdata` volume for
caching and rate limiting. Set `REDIS_PASSWORD` in `.env` to enable Redis
authentication.

### 2. Apply Database Migrations

```powershell
docker compose exec backend alembic upgrade head
```

### 3. Initialize Teams and Default Users

```powershell
# Populate default teams (Delivery, Sales, Finance)
docker compose exec backend python scripts/seed_teams.py

# Populate default user hierarchy
$env:DEFAULT_USER_PASSWORD = "use-a-secure-temporary-password"
docker compose exec -e DEFAULT_USER_PASSWORD=$env:DEFAULT_USER_PASSWORD backend python scripts/seed_default_users.py
Remove-Item Env:DEFAULT_USER_PASSWORD

# Create an administrator
docker compose exec backend python scripts/create_admin.py --email admin@enterprise-ops.com
```

For more details on backend configuration and migrations, see [backend/README.md](file:///d:/projects%20and%20files/ops/backend/README.md).

---

## Frontend Development & Hot Reload

The default stack above is a **production** frontend: `Containerfile` runs `next build` and the container serves a pre-compiled standalone bundle via `node server.js`. That server has no compiler, no file watcher, and no HMR socket, and the compose service mounts no source, so edits to `frontend/` are invisible until the image is rebuilt.

Hot reload requires the Next.js dev server (`next dev`), which enables React Fast Refresh by default. Two supported ways to run it:

### Option A: dev server on the host (recommended)

Fastest and avoids Docker Desktop's bind-mount filesystem layer entirely.

```powershell
docker compose up -d db backend

cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Save any file under `frontend/app` or `frontend/components` and the browser updates in place.

`frontend/.env.development` supplies `NEXT_PUBLIC_API_URL`. Note that Next reads `.env*` from `frontend/`, not the repository root, and that `NEXT_PUBLIC_*` values are inlined at compile time — editing them requires a dev server restart.

### Option B: dev server in Docker

```powershell
docker compose --profile dev up --build frontend-dev
```

`frontend/Containerfile.dev` runs `next dev` against the working tree bind-mounted at `/app`. Two details make this reliable rather than merely functional:

* **`node_modules` and `.next` are named volumes.** The host tree is Windows and contains win32-native binaries, which would otherwise shadow the container's Linux dependencies. Keeping `.next` on the container filesystem is also far faster than writing build output through the Docker Desktop mount.
* **`WATCHPACK_POLLING` defaults to `true`.** Docker Desktop's bind-mount layer does not deliver filesystem events into the container, so without polling the watcher never fires and edits appear to save without taking effect. Next 14 watches through webpack's watchpack rather than chokidar, so this is the only knob required. On a Linux host, or when running the dev server natively, set `FRONTEND_WATCH_POLLING=false` in `.env` to drop the polling CPU cost.

`frontend-dev` shares host port 3000 with the production `frontend` service and lives behind the `dev` profile, so `docker compose up` is unaffected. Start only one of them, or point the dev server elsewhere:

```powershell
$env:FRONTEND_DEV_PORT = "3001"
docker compose --profile dev up --build frontend-dev
```

### Verifying hot reload is actually live

A running dev server logs on every change. If edits save but nothing recompiles, the server is a production build — confirm you are on `next dev`, not `next start`, and that the process logs `ready` rather than serving from `.next/standalone`.

### After changing dependencies

The `frontend_dev_node_modules` volume is seeded from the image the first time it runs and is not refreshed afterwards, so a newly added or updated package stays invisible to the container. Rebuild and reset it:

```powershell
docker compose --profile dev down -v
docker compose --profile dev up --build frontend-dev
```

This also discards the cached `.next` volume, so the first compile after it is slow.

---

## Frontend and Backend Bug-Fix Plan

This section is the implementation backlog from the current code review. It
records reproducible failures and high-risk defects without changing runtime
behavior. Work through the items in priority order, keeping the existing
uncommitted changes in mind.

### Baseline verification

| Area | Current result | Required follow-up |
| :--- | :--- | :--- |
| Frontend production build | `cd frontend; npm run build` passes. It warns when `NEXT_PUBLIC_API_URL` is unset and falls back to `http://127.0.0.1:8000/api/v1`. | Make the API URL requirement explicit for each supported run mode and fail fast or provide a documented proxy default. |
| Frontend tests | `cd frontend; npm test -- --run` reports **192 passed, 5 failed** across 20 files. | Fix the failures below, then run the complete suite in CI. |
| Backend tests | `python -m pytest -q` fails during collection because `POSTGRES_SERVER` and `DATABASE_URL` are required but are not supplied by the local test setup. | Add a test settings/environment fixture that uses the existing isolated SQLite database, without weakening production settings validation. |

### Priority 0 — blocking correctness failures

1. **Fix the batch drawer hook-order crash (frontend).**
   * Evidence: [`BatchDetailDrawer.tsx`](frontend/components/BatchDetailDrawer.tsx:814)
     returns before all hooks have run when the drawer is initially closed or
     has no batch. The test suite reproduces
     `Rendered more hooks than during the previous render`.
   * Plan: move the guard below every hook, or split the always-mounted state
     shell from the rendered drawer body. Preserve the closed/unmounted UX.
   * Acceptance: the drawer can mount closed, open, close, and switch batches
     without a React hook-order error; the existing drawer tests pass.

2. **Restore the timetable preview contract (frontend).**
   * Evidence: [`BatchDetailDrawer.ingest.test.tsx`](frontend/components/BatchDetailDrawer.ingest.test.tsx)
     fails because search/filter/sort/column/export controls are rendered in
     the ingestion preview and because the preview overrides the shared
     viewport-centering class.
   * Plan: keep the preview focused on row review/edit/apply, remove unrelated
     table controls from that mode, and use the shared dialog positioning
     contract.
   * Acceptance: the two ingestion-preview failures pass and the full
     ingestion flow still supports correcting rows before apply.

3. **Repair the drawer tab and session-ledger regressions (frontend).**
   * Evidence: [`BatchDetailDrawer.tabs.test.tsx`](frontend/components/BatchDetailDrawer.tabs.test.tsx)
     cannot find the NPS closure action or the `Session Status` column.
   * Plan: restore the quality-gate action in the expected tab/state and render
     session status as a real table column, including loading, empty, and
     populated states.
   * Acceptance: all drawer tab tests pass and tab selection survives parent
     refreshes.

### Priority 1 — data integrity and security-sensitive behavior

4. **Correct the enrollment edit payload (frontend/backend contract).**
   * Evidence: [`BatchDetailDrawer.tsx`](frontend/components/BatchDetailDrawer.tsx:320)
     sends `non_residential_enrollments` from `total_enrollments`, so editing
     total enrollment silently overwrites a separate field.
   * Plan: load, display, validate, and submit the actual
     `non_residential_enrollments` value; add a regression test for unequal
     totals.
   * Acceptance: updating one enrollment field never changes the other, and
     the API schema and UI form agree on null/zero handling.

5. **Reconcile browser route protection with API authorization (frontend/backend).**
   * The middleware uses a client-written `ops_session` presence cookie while
     credentials remain in `localStorage`. The cookie is only a navigation
     hint, so every API endpoint must remain authoritative.
   * Plan: verify every protected route has a backend dependency, test stale or
     forged presence cookies, preserve the `next` destination after login, and
     consider an HttpOnly session strategy before production deployment.
   * Acceptance: unauthenticated API calls return 401/403, forged cookies grant
     no data access, and login returns users to the requested safe destination.

6. **Add cross-batch faculty conflict validation (backend).**
   * Evidence: [`schedules/service.py`](backend/app/api/v1/schedules/service.py:674)
     explicitly checks overlaps only within the uploaded file; existing
     sessions in other batches are not considered.
   * Plan: query persisted sessions for the faculty/date/time window in the
     same transaction, return row-level conflict details, and add tests for
     same-batch, cross-batch, boundary-touching, and timezone cases.
   * Acceptance: overlapping assignments are rejected consistently at apply
     time, while adjacent non-overlapping sessions remain valid.

### Priority 2 — reliability and observability

7. **Stop swallowing operational errors (backend).**
   * Evidence: [`batches/controller.py`](backend/app/api/v1/batches/controller.py:166)
     catches notification failures with `pass`, and
     [`schedules/service.py`](backend/app/api/v1/schedules/service.py:504)
     ignores header-detection exceptions.
   * Plan: use repository logging with request/batch identifiers, distinguish
     optional notification failure from a failed business operation, and return
     actionable ingestion errors instead of silently continuing.
   * Acceptance: failures are visible in logs/metrics, API responses never claim
     an operation succeeded when persistence failed, and notification outages
     do not corrupt approval state.

8. **Make local backend test setup deterministic.**
   * Plan: provide a test-only settings override or checked-in test env
     defaults for required settings, ensure imports do not attempt a live
     PostgreSQL connection, and keep production validation strict.
   * Acceptance: `python -m pytest -q` reaches test execution from a clean
     checkout without manually exporting secrets or database credentials.

9. **Harden configuration and deployment defaults.**
   * Plan: document the required `NEXT_PUBLIC_API_URL`, remove machine-specific
     `file:///d:/...` documentation links, verify Nginx `/api` and `/health`
     routing in a smoke test, and ensure Redis password settings are passed
     consistently to the client.
   * Acceptance: the documented Docker and host workflows work from this
     repository on Windows, and health checks validate dependencies rather than
     only process availability.

### Required regression coverage

Before closing this backlog, add or update tests for:

* Batch drawer mount/close/open transitions and tab persistence.
* Timetable preview controls, centering, row correction, and apply failure.
* Independent enrollment fields and date/time serialization.
* Login redirect safety, stale tokens, forged session cookies, and refresh
  races.
* Faculty conflicts across batches and transaction rollback on rejected files.
* Notification failure visibility and deterministic backend test bootstrap.

### Suggested implementation order

1. Fix the hook-order crash and the five currently failing frontend tests.
2. Fix the enrollment payload and add the corresponding API/UI regression test.
3. Make backend tests collect and pass using isolated test settings.
4. Implement cross-batch conflict validation with transaction-safe tests.
5. Replace swallowed exceptions with structured logging and explicit outcomes.
6. Finish deployment/configuration cleanup and run frontend build, frontend
   tests, backend tests, and a Docker smoke test in CI.

### Second-pass findings (2026-10-06)

The original blockers are currently green in this worktree:
`frontend` reports 197/197 tests passing, `backend` reports 47/47 tests
passing with its test bootstrap, and the production build succeeds. The
following authorization issues remain because the current tests do not cover
empty-scope and unfiltered-list cases.

10. **Prevent manager analytics from becoming unrestricted on an empty scope
    (backend, high severity).**
    * Evidence: [`analytics/service.py`](backend/app/api/v1/analytics/service.py:48)
      returns `None` when a non-admin manager has no scoped batch IDs.
      Repository methods interpret `None` as unrestricted, so a manager with
      no assignments can receive organization-wide dashboard totals.
    * Plan: represent “no visible batches” as an explicit empty ID sequence,
      reserve `None` exclusively for Admin/unrestricted callers, and add tests
      for an unassigned manager, a scoped manager, and an Admin.
    * Acceptance: an unassigned manager sees zero/empty scoped analytics and
      never receives another team's totals.

11. **Scope the MBR export to the authenticated manager (backend, high
    severity).**
    * Evidence: [`analytics/controller.py`](backend/app/api/v1/analytics/controller.py:20)
      applies a manager/Admin dependency but does not pass `current_user`;
      [`analytics/service.py`](backend/app/api/v1/analytics/service.py:122)
      then calls `list_all_batches()` for every caller, exporting all batches.
    * Plan: inject `current_user`, reuse the same scope calculation as the
      dashboard, and export only scoped rows for managers while retaining the
      all-data behavior for Admins.
    * Acceptance: a manager's downloaded workbook contains only permitted
      batches; an Admin export contains all batches; both cases have coverage.

12. **Apply RBAC to unfiltered session-ledger queries (backend, high
    severity).**
    * Evidence: [`sessions/service.py`](backend/app/api/v1/sessions/service.py:28)
      only calls `_require_batch_scope` when `batch_id` is supplied.
      [`sessions/controller.py`](backend/app/api/v1/sessions/controller.py:48)
      permits any authenticated user to omit `batch_id`, and the repository
      returns every utilization record.
    * Plan: resolve a permitted batch-ID set before querying, add repository
      filtering for that set, and define the intended Faculty visibility
      explicitly rather than treating all authenticated users alike.
    * Acceptance: managers/coordinators receive only in-scope ledger rows,
      Admin/Finance retain their intended visibility, and an unfiltered
      request cannot enumerate unrelated batches.

#### Second-pass regression tests

Add API/service tests for:

* Empty manager scope versus Admin scope in dashboard analytics.
* MBR export row filtering by role/team and safe workbook contents.
* `GET /sessions` with and without `batch_id`, including unrelated batches,
  Finance/Admin access, and unauthorized batch IDs.

### UI bugs and component improvements (2026-10-06)

The current UI suite and production build are green, but the following
component-level issues were found in the static interaction/accessibility pass.

13. **Fix generated labels for bespoke table filters (frontend,
    accessibility).**
    * Evidence: [`TableFilters.tsx`](frontend/components/table/TableFilters.tsx:97)
      generates a fallback `htmlFor` value for every bespoke filter, but it
      cannot add that generated `id` to the caller's `content`. When a caller
      omits `htmlFor`, the rendered `<label>` points to no control.
      [`TaxonomyTab.tsx`](frontend/components/admin/tabs/TaxonomyTab.tsx:163)
      uses exactly this pattern for the “Option set” button group.
    * Plan: support non-form content as a group with no `htmlFor`, or require
      and validate an explicit control/group id. Use `aria-labelledby` or a
      visible group label for button groups instead of a label targeting a
      `<div>`.
    * Acceptance: every filter label has a valid associated input/select or
      group name; automated accessibility testing reports no orphan labels.

14. **Improve desktop sidebar and workspace-menu keyboard behavior (frontend,
    accessibility/UX).**
    * Evidence: [`Sidebar.tsx`](frontend/components/Sidebar.tsx:380) exposes
      the workspace popover and collapsed desktop rail, but the open popover
      does not move focus into the menu, restore focus to its trigger, or
      provide arrow-key navigation. The collapsed rail also relies on visual
      icon-only controls.
    * Plan: keep the desktop sidebar layout, but add menu focus management,
      `Escape` dismissal with focus restoration, clear expanded state, and
      accessible labels/tooltips for collapsed-rail actions.
    * Acceptance: desktop keyboard users can open, navigate, and close the
      workspace menu without losing focus; every collapsed-rail action has a
      meaningful accessible name and visible hover/focus feedback.

15. **Improve desktop table toolbar semantics and layout (frontend,
    accessibility/UX).**
    * Evidence: [`TableTools.tsx`](frontend/components/table/TableTools.tsx:67)
      exposes the columns picker with `aria-haspopup="true"` but renders a
      checkbox panel rather than a menu, while the overflow menu has no
      roving focus/arrow-key behavior. [`TableFilters.tsx`](frontend/components/table/TableFilters.tsx:189)
      places many fixed-width controls in a wrapping row, which can create
      crowded or clipped toolbars in smaller desktop windows.
    * Plan: use a consistent popover/listbox pattern for column visibility,
      provide keyboard focus management and clearer checked-state semantics,
      and define desktop responsive widths/stacking for search, filters, sort,
      and action buttons.
    * Acceptance: all toolbar controls are reachable and understandable with
      keyboard and screen reader testing; no control is clipped or overlaps
      another at supported desktop viewport sizes.

16. **Make fullscreen tables behave as a single scroll surface (frontend,
    UX).**
    * Evidence: [`FullscreenTable.tsx`](frontend/components/table/FullscreenTable.tsx:123)
      sets `overflow: auto` on the fullscreen panel and also gives the inner
      table wrapper horizontal and, in fullscreen mode, vertical scrolling.
      Large tables can therefore expose nested scrollbars and confusing wheel
      behavior.
    * Plan: keep the fullscreen shell responsible for the viewport and let one
      inner table body own vertical scrolling; preserve horizontal scrolling,
      sticky headers, Escape-to-exit, and body-scroll locking.
    * Acceptance: a large table has one predictable vertical scroll context,
      sticky headers remain visible, and exiting fullscreen restores the prior
      page scroll position.

17. **Reset reusable form state when modal inputs change (frontend,
    robustness).**
    * Evidence: [`FormModal.tsx`](frontend/components/forms/modal/FormModal.tsx:39)
      passes `initialData` only to `useForm({ defaultValues })`; React Hook Form
      does not reapply those defaults when the prop changes while the modal
      component remains mounted.
    * Plan: reset the form when a new `initialData` identity or edit target is
      supplied, while avoiding resets on every keystroke and preserving dirty
      values during an active edit.
    * Acceptance: reopening a reused form for a different record shows that
      record's values, failed submissions retain user input, and changing
      records cannot submit stale values.

#### UI regression coverage

Add focused tests for:

* Label-to-control and button-group naming in `TableFilters`.
* Desktop sidebar workspace-menu Escape handling, focus return, and collapsed
  rail accessible names.
* Keyboard operation of column visibility and overflow toolbar popovers.
* Fullscreen table scrolling and restoration after Escape.
* Reused `FormModal` instances receiving new `initialData`.

#### Desktop UI fixes completed

The current worktree implements items 13–17:

* Bespoke filter labels no longer point at generated, nonexistent control IDs;
  custom groups provide their own accessible name.
* Desktop workspace and table popovers now support Escape dismissal, focus
  return, and keyboard item navigation.
* Column visibility controls expose checkbox-group semantics instead of a menu
  role.
* Fullscreen and pinned table layouts use the table content wrapper as the
  single vertical scroll surface.
* Reused form modals reset when opened for a different initial-data snapshot.

Validation: `frontend` tests pass (`197/197`) and `npm run build` passes.
