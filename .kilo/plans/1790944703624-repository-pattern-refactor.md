# Repository Pattern Refactoring Plan

## Current State Analysis

**Problem:** All services directly use `self.db.query()` for database operations. Repositories exist but are empty stubs.

**Files with Direct DB Queries in Services:**
- `backend/app/api/v1/batches/service.py` - ~80+ direct queries
- `backend/app/api/v1/faculty/service.py` - ~15 direct queries
- `backend/app/api/v1/sessions/service.py` - ~30+ direct queries
- `backend/app/api/v1/analytics/service.py` - ~25+ direct queries
- `backend/app/api/v1/gates/service.py` - ~10 direct queries
- `backend/app/api/v1/schedules/service.py` - ~40+ direct queries
- `backend/app/api/v1/teams/service.py` - ~10 direct queries
- `backend/app/api/v1/roles/service.py` - ~8 direct queries
- `backend/app/api/v1/auth/service.py` - ~25+ direct queries
- `backend/app/api/v1/batches/lifecycle_service.py` - ~15 direct queries

**Empty Repository Stubs:**
- `BatchRepository`, `FacultyRepository`, `SessionRepository`, `AnalyticsRepository`
- `GateRepository`, `ScheduleRepository`, `FmsSyncRepository`

## Target Architecture

```
Controller → Service → Repository (Interface) → Repository Implementation → SQLAlchemy Models
                ↑
         Dependency Injection
```

## Refactoring Tasks

### 1. Create Repository Interfaces (Abstract Base Classes)

Create `backend/app/api/v1/{domain}/repository_interfaces.py` for each domain:

- `IBatchRepository` - All batch query methods
- `IFacultyRepository` - Faculty query methods
- `ISessionRepository` - Session/FacultyUtilization query methods
- `IAnalyticsRepository` - Analytics query methods
- `IGateRepository` - Gate-related query methods
- `IScheduleRepository` - Schedule query methods
- `ITeamRepository` - Team query methods
- `IRoleRepository` - Role query methods
- `IUserRepository` - User query methods (for AuthService)

### 2. Implement Repository Classes

Move ALL database queries from services to repository implementations:

**BatchRepository** - Move from BatchService:
- `get_by_id()`, `get_by_batch_id()`, `get_by_id_with_relations()`
- `list_with_filters()` - RBAC scoped listing with all filters
- `get_active_batches()` - Date-filtered active batches with sessions
- `create()`, `update()`, `save()`
- `get_approval_config()`, `update_approval_config()`
- `sync_pending_approvers()`
- `count_by_status()`, `get_scoped_batch_ids()`
- `export_finance_data()`

**FacultyRepository** - Move from FacultyService:
- `list_active_faculty()`, `get_utilization_overview()`
- `get_deployed_faculty_names()`, `get_domain_breakdown()`

**SessionRepository** - Move from SessionService:
- `list_utilizations()`, `list_scheduled_sessions()`
- `get_scheduled_by_id()`, `get_utilization_by_id()`
- `create_scheduled()`, `update_scheduled()`
- `create_utilization()`, `update_utilization()`
- `get_daily_hours_for_faculty()`, `check_conflicts()`
- `transition_status()`, `complete_gate1()`

**AnalyticsRepository** - Move from AnalyticsService:
- `get_manager_dashboard_data()`, `get_scoped_batch_ids()`
- `get_vertical_breakdown()`, `export_mbr_data()`

**GateRepository** - Move from GatekeeperService:
- `get_session_for_gate1()`, `get_batch_for_gate2()`
- `complete_session_gate1()`, `close_batch_gate2()`

**ScheduleRepository** - Move from ExcelIngestionService:
- `get_batch_by_id_or_batch_id()`, `check_existing_session()`
- `bulk_create_sessions()`, `generate_missing_sessions()`
- `get_batch_date_range()`

**TeamRepository** - Move from TeamService:
- `list_teams()`, `get_by_id()`, `create()`, `update()`, `delete()`
- `get_member_count()`, `unassign_users()`

**RoleRepository** - Move from RoleService:
- `list_roles()`, `get_by_id()`, `create()`, `update()`, `delete()`
- `get_assigned_user_count()`

**UserRepository** - Move from AuthService:
- `get_by_email()`, `get_by_id()`, `list_all()`, `create()`, `update()`, `delete()`
- `get_hierarchy()`, `get_coordinators()`, `get_managed_coordinator_ids()`
- `create_mapping()`, `list_mappings()`, `delete_mapping()`
- `log_audit_event()`, `update_login_stats()`

**BatchLifecycleRepository** - Move from BatchLifecycleService:
- `sync_statuses()`, `sync_session_statuses()`
- `calculate_batch_avg_feedback()`, `check_and_update_batch_feedback()`

### 3. Refactor Services to Use Repositories

Each service should:
- Accept repository interfaces via constructor injection
- Delegate ALL database operations to repositories
- Contain only business logic (validation, orchestration, transformations)

### 4. Update Dependency Injection

Modify `backend/app/api/deps_services.py`:
- Create repository factory functions (e.g., `get_batch_repository()`)
- Update service factories to inject repositories

```python
def get_batch_repository(db: Session = Depends(get_db)) -> IBatchRepository:
    return BatchRepository(db)

def get_batch_service(
    batch_repo: IBatchRepository = Depends(get_batch_repository),
    # ... other repos
) -> BatchService:
    return BatchService(batch_repo, ...)
```

### 5. Update Controllers

Controllers already use `get_batch_service()` etc. - no changes needed if DI is properly wired.

## Implementation Order

1. **User/Team/Role Repositories** (foundational, used by others)
2. **Batch Repository** (core domain, most complex)
3. **Session/Faculty Repositories** (depend on Batch)
4. **Analytics/Gate/Schedule Repositories** (depend on above)
5. **BatchLifecycle Repository** (depends on Batch/Session)
6. **Refactor Services** (in same order)
7. **Update DI wiring**
8. **Run tests** to verify

## Validation

- All existing tests must pass
- No `self.db.query()` in any service file
- All query logic in repository implementations
- Services only contain business logic
- Pure dependency injection: services depend on interfaces, not concrete classes

## Risk Mitigation

- Do one domain at a time
- Keep services working during transition by implementing repository methods incrementally
- Run tests after each domain migration