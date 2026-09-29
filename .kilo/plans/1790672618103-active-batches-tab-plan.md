# Active Batches Tab Implementation Plan

## Overview
Replace the current "Batches" view with an "Active Batches" tab as the default landing page after login. This view will show:
1. **Ongoing Batches** - batches where the filter date falls between `start_date` and `end_date` (inclusive)
2. **Ongoing Sessions** - sessions from both `TrainingSession` (scheduled curriculum) and `FacultyUtilization` (actual delivery) where the session date matches the filter date

Default filter date: **today**

**Note**: The existing "Batches" view (with all batches, search, status/domain/category filters) will be **removed** from the sidebar navigation. Users who need the full batch list can access it via other means if needed, but the primary landing page is now Active Batches.

---

## Backend Changes

### 1. New API Endpoint: `/batches/active`
**File**: `backend/app/api/v1/batches/controller.py`

```python
@router.get("/active", response_model=ActiveBatchesResponse)
def get_active_batches(
    filter_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get ongoing batches and sessions for a specific date with pagination."""
    return service.get_active_batches(filter_date, current_user, skip, limit)
```

### 2. Response Schema
**File**: `backend/app/schemas/batch.py`

```python
class ActiveBatchItem(BaseModel):
    id: str
    batch_id: str
    program_name: str
    client_name: Optional[str]
    category: str
    delivery_mode: str
    location_city: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    status: str
    total_enrollments: int
    training_days: int
    sessions_conducted: int
    progress: float  # computed: (sessions_conducted / training_days) * 100

class ActiveSessionItem(BaseModel):
    id: str
    batch_id: str
    batch_name: str
    session_type: Literal["scheduled", "actual"]  # "scheduled" = TrainingSession, "actual" = FacultyUtilization
    sequence_number: Optional[int]
    module: str
    trainer_name: Optional[str]
    faculty_name: Optional[str]
    session_date: str
    start_time: Optional[str]
    end_time: Optional[str]
    duration_hours: float
    status: str
    venue: Optional[str]
    location_city: Optional[str]
    mode_of_delivery: Optional[str]

class ActiveBatchesResponse(BaseModel):
    filter_date: str
    batches: List[ActiveBatchItem]
    sessions: List[ActiveSessionItem]
    total_batches: int
    total_sessions: int
    skip: int
    limit: int
```

### 3. Service Method: `BatchService.get_active_batches()`
**File**: `backend/app/api/v1/batches/service.py`

```python
def get_active_batches(
    self, 
    filter_date: Optional[str], 
    current_user: User,
    skip: int = 0,
    limit: int = 100
) -> ActiveBatchesResponse:
    # Parse filter_date or default to today (UTC)
    # Query batches where start_date <= filter_date <= end_date (inclusive)
    # Apply RBAC scoping (same as list())
    # Query sessions from both TrainingSession and FacultyUtilization where date = filter_date
    # Exclude terminal statuses: Cancelled, Not Conducted, Completed
    # Sort batches by start_date ASC
    # Sort sessions by start_time ASC
    # Apply pagination (skip/limit)
    # Compute progress = (sessions_conducted / training_days) * 100
    # Return structured response with pagination metadata
```

**Key logic**:
- Parse `filter_date` string to `date` object (default: `datetime.now(timezone.utc).date()`)
- Filter batches: `Batch.start_date.date() <= filter_date <= Batch.end_date.date()` (exclude null dates)
- For sessions:
  - `TrainingSession.session_date == filter_date` AND status NOT IN ('Cancelled', 'Not Conducted', 'Completed')
  - `FacultyUtilization.date_of_training.date() == filter_date` AND status NOT IN ('Cancelled', 'Not Conducted', 'Completed')
- Apply same RBAC scoping as `list()` method (via `get_manager_scope_user_ids()`)
- Compute progress per batch: `(sessions_conducted / training_days) * 100` (capped at 100)
- Sort batches: `start_date ASC NULLS LAST`
- Sort sessions: `start_time ASC NULLS LAST`
- Pagination: `skip`, `limit` params (max 100)
- Return total counts for frontend pagination

---

## Frontend Changes

### 1. Add "active_batches" View Type, Remove "batches"
**Files to modify**:
- `frontend/components/Sidebar.tsx` - Replace "batches" with "active_batches" in navItems and type
- `frontend/app/dashboard/components/DashboardLayout.tsx` - Update props type
- `frontend/app/page.tsx` - Remove "batches" view handling, add "active_batches"

**Type changes**:
```typescript
type ActiveView = "active_batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty";
```

### 2. Update Sidebar Navigation
**File**: `frontend/components/Sidebar.tsx`

- Replace "Active Batches" nav item (was "Batches") as first item
- Update keyboard shortcuts (Ctrl+1 → Active Batches)
- Show only for non-admin users (admins go to /admin)
- Remove "batches" from ActiveView type

### 3. New API Function
**File**: `frontend/lib/api.ts`

```typescript
export interface ActiveBatchItem { ... }
export interface ActiveSessionItem { ... }
export interface ActiveBatchesResponse {
  filter_date: string;
  batches: ActiveBatchItem[];
  sessions: ActiveSessionItem[];
  total_batches: number;
  total_sessions: number;
  skip: number;
  limit: number;
}

async getActiveBatches(params?: { 
  filterDate?: string; 
  skip?: number; 
  limit?: number; 
}): Promise<ActiveBatchesResponse> {
  const query = new URLSearchParams();
  if (params?.filterDate) query.append("filter_date", params.filterDate);
  if (params?.skip) query.append("skip", String(params.skip));
  if (params?.limit) query.append("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return this.request<ActiveBatchesResponse>(`/batches/active${qs}`);
}
```

### 4. New Component: ActiveBatchesView
**File**: `frontend/app/dashboard/components/ActiveBatchesView.tsx`

**Features**:
- Date picker (default: today in YYYY-MM-DD)
- Loading states
- Two tables with pagination:
  1. **Ongoing Batches Table** 
     - Columns: Batch ID, Program, Client, Category, Mode, Location, Start Date, End Date, Status, Enrollments, Progress (%)
     - Default sort: Start Date ASC
     - Pagination: 10 rows/page (configurable)
  2. **Ongoing Sessions Table** 
     - Columns: Batch, Type (Scheduled/Actual), Module, Trainer/Faculty, Date, Time, Duration (hrs), Status, Location
     - Default sort: Time ASC
     - Pagination: 15 rows/page (configurable)
- Empty states for both tables
- Responsive design matching existing UI patterns (glass-panel, glass-table)
- Shows total count badges

### 5. Integrate into Dashboard Page
**File**: `frontend/app/page.tsx`

- Add state for `filterDate` (default: today in YYYY-MM-DD format)
- Add `activeBatchesData` state (ActiveBatchesResponse)
- Add pagination state: `batchPage`, `batchPageSize`, `sessionPage`, `sessionPageSize`
- Fetch data on mount and when filter date changes
- Handle pagination changes for both tables (refetch with skip/limit)
- Render `ActiveBatchesView` when `activeView === "active_batches"`
- Update default `activeView` from `"batches"` to `"active_batches"`
- Pass pagination handlers to ActiveBatchesView

### 6. Update Login Redirect
**File**: `frontend/app/login/page.tsx`

- Already redirects to `/` for non-admin users ✓
- No changes needed

---

## Data Flow

```
User logs in → Redirects to "/" (DashboardPage)
  → activeView = "active_batches" (default)
  → Fetch active batches for today via api.getActiveBatches()
  → Render ActiveBatchesView with:
     - Date picker (today)
     - Table 1: Ongoing batches (filtered by date)
     - Table 2: Ongoing sessions (merged, filtered by date)
User changes date → Re-fetch → Update tables
```

---

## RBAC Considerations

- Reuse existing `get_manager_scope_user_ids()` logic
- Finance team sees all batches
- Managers see batches in their scope
- Coordinators see their assigned batches
- Approvers see batches pending their approval

---

## Edge Cases

1. **Batches with null dates**: Exclude from ongoing batches (cannot determine if active)
2. **Sessions with null dates/times**: Exclude from ongoing sessions or sort to bottom
3. **Timezone handling**: Backend uses UTC dates; frontend sends YYYY-MM-DD; filter_date parsed as UTC date
4. **No data**: Show empty state messages ("No ongoing batches for this date", "No sessions scheduled")
5. **Large datasets**: Backend pagination (skip/limit, max 100) + frontend pagination controls
6. **Terminal session statuses**: Exclude 'Cancelled', 'Not Conducted', 'Completed' from sessions table
7. **Progress calculation**: If training_days = 0, show 0% or N/A

---

## Validation Plan

1. **Backend unit tests**:
   - Test date filtering logic (boundary dates: start_date, end_date inclusive)
   - Test RBAC scoping (manager, coordinator, finance, admin)
   - Test session merge (both TrainingSession and FacultyUtilization returned)
   - Test terminal status exclusion (Cancelled, Not Conducted, Completed)
   - Test pagination (skip/limit, total counts)
   - Test progress calculation (sessions_conducted / training_days * 100)
   - Test sort order (batches by start_date ASC, sessions by start_time ASC)

2. **Frontend integration**:
   - Date picker defaults to today (YYYY-MM-DD)
   - Tables render correctly with all columns
   - Filter date change triggers re-fetch
   - Pagination works for both tables
   - Empty states display correctly
   - Loading states show during fetch

3. **E2E scenarios**:
   - Login as different roles → verify correct data visibility
   - Navigate to Active Batches → verify default date = today
   - Change date → verify data updates
   - Pagination → verify page changes fetch correct data
   - Verify both session types appear (Scheduled + Actual)

---

## File Summary

### Backend (3 files)
1. `backend/app/schemas/batch.py` - Add response schemas
2. `backend/app/api/v1/batches/service.py` - Add `get_active_batches()` method
3. `backend/app/api/v1/batches/controller.py` - Add `/active` endpoint

### Frontend (5 files)
1. `frontend/lib/api.ts` - Add types and API method
2. `frontend/components/Sidebar.tsx` - Add navigation item
3. `frontend/app/dashboard/components/DashboardLayout.tsx` - Update type
4. `frontend/app/dashboard/components/ActiveBatchesView.tsx` - **NEW** component
5. `frontend/app/page.tsx` - Integrate new view, change default

---

## Implementation Order

1. Backend: Schema → Service → Controller → Test
2. Frontend: API types → Sidebar/Layout types → ActiveBatchesView component → Dashboard integration → Test