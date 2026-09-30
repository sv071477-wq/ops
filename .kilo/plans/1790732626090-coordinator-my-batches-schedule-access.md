# Coordinator "My Batches" — Schedule Access Plan

## Problem

A Coordinator creates a batch via **Add New Batch** (`CreateBatchModal` → `POST /batches`), but has no way to reach the schedule UI.

The schedule feature lives only inside `BatchDetailDrawer` → **Sessions & Timetable** tab → *Ingest Timetable (Excel)* / *Add Session* (`frontend/components/BatchDetailDrawer.tsx:1519`).

`BatchDetailDrawer` has exactly two entry points, neither available to a Coordinator:

| Entry point | Gate | Coordinator? |
| --- | --- | --- |
| ManagerBoard card click (`ManagerBoard.tsx:537`) | `canSeeManagerBoard` (`Sidebar.tsx:60`) — needs `direct_reports_count > 0 \|\| is_manager \|\| role === "Manager" \|\| isAdmin` | No |
| Approval Queue "View Full Batch Details" (`app/page.tsx:737`) | `is_configured_approver` | No |

A Coordinator lands on `ActiveBatchesView` by default, whose `BatchRow` (`ActiveBatchesView.tsx:218`) has no `onClick` and no `onOpenBatchDetail` prop. So the schedule feature is unreachable for exactly the role that creates batches.

**Compounding issue:** `GET /batches/active` filters `start_date <= filter_date <= end_date` (`backend/app/api/v1/batches/service.py:331`) and the view defaults to today. A batch created with a future start date does not render at all — even for a Manager.

## Decisions

1. **New "My Batches" view** for coordinators, alongside (not replacing) Active Batches.
2. **Scope = strictly owned batches.** Sibling-coordinator batches stay reachable via Manager Board.
3. **Ownership resolved server-side** via `?mine=true`, not a client-supplied user ID. A literal `coordinator_id=<uuid>` param would let any caller enumerate another user's batches.
4. **My Batches becomes the Coordinator's default landing view** so the schedule path is one click away immediately after creation.
5. **No change to the `POST /schedules/apply` status gate.** `BatchService.create()` already sets `status = "Approval 1 Pending"` (`batches/service.py:105`), which is inside the allowed set (`schedules/service.py:264`). New batches accept a schedule immediately. The rejected-back-to-`Requested` case is left as-is.

---

## Implementation

### 1. Backend — `mine` filter on the existing list endpoint

**`backend/app/api/v1/batches/controller.py:171`**
Add one query param and thread it through:

```python
@router.get("", response_model=List[BatchResponse])
def list_batches(
    status_filter: Optional[str] = Query(None, alias="status"),
    domain: Optional[str] = None,
    category: Optional[str] = None,
    client_name: Optional[str] = None,
    search: Optional[str] = None,
    mine: bool = Query(False, description="Restrict to batches owned by the caller"),
    skip: int = 0,
    limit: int = DEFAULT_PAGE_LIMIT,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user)
) -> Any:
```

**`backend/app/api/v1/batches/service.py:244`** — extend `list()` with an `ownership_filter: Optional[UUID]` argument. When set, add `Batch.coordinator_id == ownership_filter` to the query.

Resolution rules, computed in the service from `current_user.role`:

- `Coordinator` → `current_user.id` (matches `Batch.coordinator_id`)
- `Manager` → `current_user.id` (matches `Batch.primary_manager_id`)
- `Admin` → no restriction (admins are redirected to `/admin` and never render this view, but the endpoint must not silently return an empty list)

Apply the ownership filter **in addition to** the existing RBAC scope block (`service.py:250-257`) — never instead of it. Ownership narrows scope; it must never widen it.

Note the manager case: a Manager's own batches have `primary_manager_id == manager.id`, so the filter differs by role. Implement as a small branch that returns `(field, value)`, not a single hardcoded `coordinator_id` comparison.

### 2. Frontend — API client

**`frontend/lib/api.ts:949`** — add `mine` to the params type and the query string:

```typescript
async getBatches(params?: {
  status?: string;
  domain?: string;
  category?: string;
  client_name?: string;
  search?: string;
  mine?: boolean;
}): Promise<Batch[]>
```

Append `mine=true` only when `params?.mine` is true, matching the existing "only append when meaningful" style.

### 3. Frontend — `MyBatchesView` component (new)

**New file: `frontend/app/dashboard/components/MyBatchesView.tsx`**

Model it on `ActiveBatchesView.tsx` — reuse the same `glass-panel` / `glass-table` / `SummaryCard` / `EmptyRow` / `LoadingRow` / `ErrorRow` / `PaginationControls` patterns and the same `statusBadgeColor` helper. Do not introduce a new visual language.

Props (client-side pagination, matching `ActiveBatchesView`, since `GET /batches` has no total count):

```typescript
interface MyBatchesViewProps {
  data: Batch[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onOpenBatchDetail: (batch: Batch) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}
```

Table columns: Batch & Program, Client, Mode & Location, Start, End, Status, Training Days, **Schedule** (scheduled-day count), Action.

- **Schedule column** is the point of the view: show a "Not scheduled" / "N days" badge so a coordinator can see at a glance which batches still need a timetable. `BatchResponse` does not currently carry a scheduled-session count — it has `sessions_conducted` (actual `FacultyUtilization` rows) and `completion_rate`, neither of which tells you whether a *timetable* exists. Add `scheduled_session_count: int = 0` to `BatchResponse` (`backend/app/schemas/batch.py:281`) and populate it in the `list()` loop alongside the existing `FacultyUtilization` count query (a second grouped `count` over `TrainingSession.batch_id`).
- **Action column**: a "Manage Schedule" button per row that calls `onOpenBatchDetail(batch)`. The whole row should also be clickable, with `cursor: pointer`.
- Empty state must be actionable: "No batches assigned to you yet" with a pointer to **Add New Batch** when the user is in the Delivery team (mirror `canCreateBatch` from `Sidebar.tsx:58`).

### 4. Frontend — wire the drawer to open on the Sessions tab

**`frontend/components/BatchDetailDrawer.tsx:159`**

`activeTab` currently always initialises to `"overview"`. Add an optional prop:

```typescript
initialTab?: "overview" | "sessions" | "quality_gates";
```

and apply it when the drawer opens. Sync it in the existing `useEffect` on `[batch]` (`BatchDetailDrawer.tsx:132`) so reopening the drawer for a different batch does not carry a stale tab forward.

`app/page.tsx:1356` then passes `initialTab="sessions"` from the My Batches "Manage Schedule" path, so a coordinator lands directly on the timetable. Keep the ManagerBoard path on the default `"overview"`.

### 5. Frontend — navigation

**`frontend/components/Sidebar.tsx`**
- Add `"my_batches"` to the `activeView` union (`Sidebar.tsx:18-19`) and to `active_batches`'s sibling union in `app/page.tsx:37`.
- Add a nav item `{ id: "my_batches", label: "My Batches", icon: Layers }`, placed **before** Active Batches.
- Visibility: show for non-finance, non-admin users (`!isFinance && !isAdmin`) — matches the audience that can create batches.
- Extend the Ctrl+digit shortcuts (`Sidebar.tsx:77-102`). `Ctrl+2` currently goes to `active_batches`; insert `my_batches` and re-letter. Keep the finance/manager/approver fallback chain intact.

**`frontend/app/page.tsx`**
- Default `activeView` is `"active_batches"` (`:37`). Change the existing role-based auto-switch effect (`:335-342`) so a **Coordinator** lands on `"my_batches"`, while Manager keeps landing on `"manager_board"` and Finance on `"finance"`.
- Add fetch branch in the view effect (`:291-316`): `if (activeView === "my_batches") fetchMyBatches();` calling `api.getBatches({ mine: true })` into separate state (do not reuse `batches`, which is manager-scope and already loaded for other views).
- Add a guard in the fallback effect (`:353-360`) so a Coordinator cannot be bounced off `my_batches`.
- Render `{activeView === "my_batches" && <MyBatchesView ... />}`.
- `CreateBatchModal.onBatchCreated` (`app/page.tsx:1345`) currently calls `fetchBatches()`. Change it to also `fetchMyBatches()` when the active view is `my_batches`, so the new batch appears immediately without a manual refresh. Do **not** auto-open the drawer on create — the user chose the dedicated-view approach, and auto-opening would fight the modal-close animation in `FormModal` (`forms/modal/FormModal.tsx:57`).

---

## Data flow

```
Coordinator logs in
  → role auto-switch sets activeView = "my_batches"
  → GET /batches?mine=true
      → BatchService.list(ownership_filter=current_user.id)
          → RBAC scope filter (unchanged, ANDed)
          → + Batch.coordinator_id == current_user.id
  → MyBatchesView renders rows with "Schedule: Not scheduled" / "N days"
Coordinator clicks row or "Manage Schedule"
  → setSelectedBatchForDetail(batch), drawer initialTab="sessions"
  → Sessions & Timetable tab: Ingest Timetable (Excel) | Add Session
  → POST /schedules/ingest (preview) → POST /schedules/validate (dry-run) → POST /schedules/apply (persist)
  → onBatchUpdated() → fetchMyBatches() → Schedule column updates to "N days"
```

## Failure modes

| Case | Behaviour |
| --- | --- |
| Coordinator has zero batches | Empty state with **Add New Batch** pointer; no error |
| `mine=true` sent by a Finance user | Nav item hidden; endpoint still returns their full finance scope (no ownership filter applies) — matches existing finance behaviour |
| `mine=true` sent by an Admin | Returns full list; admins are redirected to `/admin` at `app/page.tsx:115` and never render this view |
| Batch has `scheduled_session_count = 0` but `training_days > 0` | Shows "Not scheduled" — the primary call to action this view exists to surface |
| Schedule upload rejected by status gate | Existing 409 from `schedules/service.py:264` surfaces via `notifyError` in the drawer. New batches pass the gate, so this only affects batches rejected back to `Requested` |
| Excel upload yields row errors | `apply_schedule_items` raises before any insert (single transaction); drawer shows per-row errors, list is unchanged |

## Risks

- **Ownership filter must not replace the RBAC block.** `list()` currently guards on `user_role_lower != "admin" and team_name_lower != "finance"` (`service.py:250`). Getting the AND wrong would let a coordinator see batches outside their scope. Add a test for exactly this.
- **Manager ownership differs from Coordinator ownership** (`primary_manager_id` vs `coordinator_id`). A single hardcoded `coordinator_id` comparison would silently return zero rows for Managers.
- **Active Batches is unchanged.** The future-start-date invisibility described above still applies there; this plan routes around it for coordinators rather than fixing it. Out of scope unless asked.
- **Sidebar keyboard shortcuts renumber.** Anyone muscle-memorising `Ctrl+3` for Manager Board will land elsewhere.

## Validation

**Backend** — `backend/tests/v1/batches/test_batches.py`, using the existing `client` / `coord_token_headers` / `manager_token_headers` / `db_session` fixtures from `backend/tests/v1/conftest.py`:

1. `mine=true` as Coordinator returns only batches where `coordinator_id == caller.id` — seed a second coordinator's batch and assert it is absent.
2. `mine=true` as Coordinator does **not** widen scope: a batch whose `primary_manager_id` is the caller but whose `coordinator_id` is someone else is excluded. (Guards the AND-not-replace risk.)
3. `mine=true` as Manager keys off `primary_manager_id`, returning non-empty.
4. `mine=true` as Finance returns their full scope unchanged.
5. Omitting `mine` reproduces today's behaviour exactly (regression guard on the other three call sites: ManagerBoard, Approval Queue, Finance).
6. `scheduled_session_count` is `0` for a batch with no `TrainingSession` rows and matches the row count once seeded.

**Frontend** — vitest, following `frontend/lib/api.test.ts` and `components/CreateBatchModal.repro.test.tsx`:

1. `getBatches({ mine: true })` puts `mine=true` in the query string; `getBatches({})` does not.
2. `MyBatchesView` renders a "Not scheduled" badge at `scheduled_session_count = 0` and "N days" above zero.
3. Clicking "Manage Schedule" invokes `onOpenBatchDetail` with the correct batch.
4. `BatchDetailDrawer` with `initialTab="sessions"` mounts on the Sessions tab; default mount still lands on Overview.

**Manual** — `docker compose up -d`, seed, then: log in as a Coordinator → confirm My Batches is the landing view → create a batch → confirm it appears immediately with "Not scheduled" → open it → Sessions tab is active → ingest `batch_schedule_january_2027.xlsx` → confirm Schedule column flips to "N days". Then log in as a Manager and confirm Manager Board, Approval Queue, Finance, and Faculty views are unchanged.

**Commands**: `docker compose exec backend pytest tests/v1` and `npx vitest run` from `frontend/`.

## Out of scope

- Relaxing the `GET /batches/active` date filter — the Active Batches view still hides future-start batches.
- Aligning `POST /sessions/scheduled` (manual Add Session) with the `apply` status gate. Currently a `Requested` batch can get manual sessions but not an Excel upload.
- Auto-opening the drawer on batch creation.
- Any change to schedule ingestion, the conflict engine, or `training_sessions` persistence.

## Files

**Backend (3)**
1. `backend/app/api/v1/batches/controller.py` — add `mine` query param
2. `backend/app/api/v1/batches/service.py` — ownership filter in `list()`; populate `scheduled_session_count`
3. `backend/app/schemas/batch.py` — add `scheduled_session_count` to `BatchResponse`

**Frontend (5)**
4. `frontend/lib/api.ts` — `mine` in `getBatches`
5. `frontend/app/dashboard/components/MyBatchesView.tsx` — **new**
6. `frontend/components/BatchDetailDrawer.tsx` — `initialTab` prop
7. `frontend/components/Sidebar.tsx` — nav item, view union, shortcut re-letter
8. `frontend/app/page.tsx` — view state, fetch branch, coordinator default, render

**Tests (2)**
9. `backend/tests/v1/batches/test_batches.py` — append the six cases above
10. `frontend/app/dashboard/components/MyBatchesView.test.tsx` — **new**
