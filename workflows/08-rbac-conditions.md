# RBAC Conditions

## Overview

The backend enforces role-based access control (RBAC) at multiple layers: route dependencies, service-level scope checks, and repository query filters.

## Role Definitions

| Role | Description |
|------|-------------|
| `Admin` | Full system access, cannot create batches |
| `Manager` | Scope-based batch access, analytics |
| `Coordinator` | Create/edit owned batches, log sessions |
| `Sales` | Limited batch ownership via sales_spoc |
| `Faculty` | View assigned sessions, receive notifications |

## Special Teams

| Team | Special Permissions |
|------|---------------------|
| `Delivery` | Only team that can create batches |
| `Finance` | Can update finance fields, sees all batches |
| `Ops` | Default department for teams |

## Permission Matrix by Endpoint

| Endpoint | Auth | Additional Conditions |
|----------|------|----------------------|
| `POST /auth/login` | None | Email/password required |
| `POST /auth/refresh` | None | Valid refresh token |
| `GET /auth/me` | Any authenticated | - |
| `POST /auth/change-password` | Any authenticated | Current password correct |
| `GET /auth/users` | Manager or Admin | - |
| `POST /auth/users` | Admin | - |
| `PATCH /auth/users/{id}` | Admin | - |
| `DELETE /auth/users/{id}` | Admin | Cannot delete self |
| `POST /auth/users/admin-create` | Admin | - |
| `POST /auth/users/coordinator-mapping` | Admin | - |
| `GET /auth/coordinators` | Manager or Admin | - |
| `GET /batches` | Any authenticated | Scoped to user |
| `POST /batches` | Coordinator or above | NOT Admin, Delivery team only |
| `PATCH /batches/{id}` | Coordinator or above | Operational scope |
| `POST /batches/{id}/submit` | Coordinator or above | Operational scope |
| `POST /batches/{id}/approve-level-1` | Any authenticated | Must be approver_1 |
| `POST /batches/{id}/approve-level-2` | Any authenticated | Must be approver_2, approver_1 approved |
| `POST /batches/{id}/approve` | Manager or Admin | Admin bypasses approver_1 check |
| `POST /batches/{id}/lifecycle-status` | Coordinator or above | Operational scope |
| `POST /batches/{id}/close` | Coordinator or above | Operational scope, Gate 1 complete |
| `GET /batches/active` | Any authenticated | Scoped to user |
| `GET /batches/finance/export` | Coordinator or above | Scoped to user |
| `GET /sessions` | Any authenticated | Scoped to user |
| `POST /sessions` | Coordinator or above | Operational scope |
| `PATCH /sessions/{id}` | Coordinator or above | Operational scope, batch not Completed |
| `POST /sessions/{id}/complete` | Coordinator or above | Operational scope |
| `POST /schedules/ingest` | Coordinator or above | - |
| `POST /schedules/apply` | Coordinator or above | Operational scope |
| `GET /faculty` | Any authenticated | - |
| `GET /faculty/utilization` | Coordinator or above | - |
| `GET /analytics/manager-dashboard` | Manager or Admin | - |
| `GET /analytics/mbr-export` | Manager or Admin | - |
| `POST /integrations/fms/sync` | Admin | - |
| `GET /roles` | Any authenticated | - |
| `POST /roles` | Admin | - |
| `PATCH /roles/{id}` | Admin | - |
| `DELETE /roles/{id}` | Admin | Cannot delete if users assigned |
| `GET /teams` | Any authenticated | - |
| `POST /teams` | Admin | - |
| `PATCH /teams/{id}` | Admin | - |
| `DELETE /teams/{id}` | Admin | Unassigns users first |

## Batch Creation Restriction

**Critical Rule:** Admin role CANNOT create batches.

```python
if (current_user.role or "").lower() == "admin":
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrators cannot create batches. Admin acts strictly in a managerial and governance capacity."
    )
```

**Additionally:** Only users in the `Delivery` team can create batches.

## Finance Field Restriction

Only Finance team members or Admin can update these fields:
- `finance_status`
- `finance_status_check_date`
- `finance_check`

## Schema Lock Restrictions

When `batch.is_schema_locked=True`:
- Non-admin/manager/coordinator roles cannot modify: `client_name`, `category`, `program_name`, `technology`, `domain`
- Finance team CAN update finance fields regardless of schema lock

## Scope Resolution Algorithm

### Unrestricted Callers
- Admin role
- Finance team members

### Manager Scope
- Self
- All managed coordinators (BFS over `User.manager_id` and `UserManagerMapping`)

### Coordinator Scope
- Self
- Their manager
- All coordinators under the same manager
- Falls back to self if no manager found

### Batch Visibility Rules
A batch is visible if:
- Caller is `primary_manager_id`, OR
- Caller is `coordinator_id`, OR
- Caller is `sales_spoc_id`, OR
- Caller is `approver_1_id` and batch is `Approval 1 Pending`, OR
- Caller is `approver_2_id` and batch is `Approval 2 Pending`
- `mine=true` further restricts to batches where caller owns via `primary_manager_id` or `coordinator_id`

## Ownership Filter Logic

When `mine=true` is passed:
- For Coordinator: filters to batches where `coordinator_id == caller.id`
- For Manager: filters to batches where `primary_manager_id == caller.id`
- For Finance: returns all scoped batches (Finance owns nothing, so `mine` is a no-op)

## User Model RBAC Fields (from SQLAlchemy)

The `users` table includes:
- `role` (String) - Primary role: Admin, Manager, Coordinator, Sales, Faculty
- `role_id` (FK to roles.id) - Reference to roles table
- `team_id` (FK to teams.id) - Reference to teams table
- `manager_id` (Self-referential FK) - Direct manager
- `is_active` (Boolean) - Account active status

## Team & Role Models (from SQLAlchemy)

### teams
- `id` (UUID, PK)
- `name` (String, unique)
- `department` (String, default: 'Ops')
- `description` (String)
- `is_active` (Boolean)
- `created_at` (TIMESTAMPTZ)

### roles
- `id` (UUID, PK)
- `name` (String, unique)
- `system_role` (String, default: 'Coordinator')
- `is_active` (Boolean)
- `created_at` (TIMESTAMPTZ)

### user_manager_mappings
- `id` (UUID, PK)
- `coordinator_id` (FK to users.id)
- `manager_id` (FK to users.id)
- `assigned_at` (TIMESTAMPTZ)

## Dependency Functions (from backend/app/api/deps.py)

- `get_current_user` - Returns authenticated user from JWT
- `require_admin` - Raises 403 if not Admin
- `require_manager_or_admin` - Raises 403 if not Manager or Admin
- `require_coordinator_or_above` - Raises 403 if not Coordinator, Manager, or Admin
- `get_user_scope` - Resolves operational scope for batch access
- `validate_batch_access` - Validates user has access to specific batch