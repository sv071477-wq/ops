# Security Review & Remediation Plan

## Project Context

**Application:** Enterprise Operations Platform (Ops) — manages corporate training batches, schedules, faculty allocations, financial milestones, and quality feedback.

**Stack:** FastAPI (Python 3.12, SQLAlchemy, Pydantic v2, PostgreSQL) backend + Next.js 14 (TypeScript/React) frontend, Docker Compose, Redis, Nginx reverse proxy.

**Current state:** The README documents a second-pass code review (2026-10-06) with three high-severity authorization issues (items 10–12) plus completed UI fixes (items 13–17). No CI/CD pipeline exists (no `.github/workflows`), and no SAST/dependency scanning tooling is configured in the repository.

---

## Findings Summary

| ID | Severity | Category | File(s) | Status |
|----|----------|----------|---------|--------|
| S-01 | High | Broken Access Control | `analytics/service.py:40-51` | From README — verify fix |
| S-02 | High | Broken Access Control | `analytics/service.py:122-129` | From README — verify fix |
| S-03 | High | Broken Access Control | `sessions/service.py:49-74` | From README — open |
| S-04 | High | Information Disclosure | `.env:19-20` (live file) | New — immediate |
| S-05 | High | Data Exposure / RBAC | `auth/controller.py:102-105` | New |
| S-06 | High | Data Exposure / RBAC | `auth/controller.py:77-80` | New |
| S-07 | Medium | Data Exposure / RBAC | `auth/controller.py:93-99` | New |
| S-08 | Medium | Data Exposure / RBAC | `faculty/controller.py:17-25` | New |
| S-09 | Medium | Data Exposure / RBAC | `faculty/controller.py:37-44` | New |
| S-10 | Medium | Data Exposure / RBAC | `roles/controller.py:25-32` | New |
| S-11 | Medium | Session Security | `frontend/context/AuthContext.tsx:26-28` | New |
| S-12 | Medium | Session Security | `frontend/lib/api.ts:550-555` | New |
| S-13 | Medium | Secrets Mgmt | `docker-compose.yml:61`, `.env.example:13` | New |
| S-14 | Medium | Error Handling | `main.py:48-51` | New |
| S-15 | Medium | Error Handling | `database.py:25-29` | New |
| S-16 | Medium | Error Handling | `batches/controller.py:159-167, 264-271` | From README P2 |
| S-17 | Medium | File Upload | `schedules/controller.py:34-38` | New |
| S-18 | Medium | Container Security | `backend/Containerfile` | New |
| S-19 | Low | Rate Limiting | `main.py:116-117` | New |
| S-20 | Low | CSRF | `frontend/context/AuthContext.tsx:23-29` | New |
| S-21 | Low | Missing Sec Artifacts | repo root | New |
| S-22 | Low | Dead Configuration | `config.py:79` | New |

---

## Detailed Findings & Fix Approach

### S-01 — Analytics: empty-scope returns `None` (unbounded) [High]

**From README item 10.** `AnalyticsService._get_scoped_batch_ids` returns `None` for Admin/unrestricted callers and `[]` for managers with no assigned batches. Repository methods (`count_batches`, `list_column_values`, etc.) treat `None` as "no filter → all rows." A non-admin manager with no subordinate coordinators should see zero data, not organization-wide totals.

**Current code analysis:**
```python
# analytics/service.py:40-51
def _get_scoped_batch_ids(self, current_user):
    if not current_user or (current_user.role or "").lower() == "admin":
        return None  # ← unrestricted sentinel
    scope_user_ids = {current_user.id}
    scope_user_ids.update(self.user_repo.get_managed_coordinator_ids(current_user.id))
    scoped_ids = self.analytics_repo.list_scoped_batch_ids(list(scope_user_ids), current_user.id)
    if not scoped_ids:
        return []  # ← correctly returns empty for empty scope
    return scoped_ids
```

The current code *appears* to have been partially fixed (returns `[]` on line 50). **Action:** Verify via test that an unassigned manager receives empty/zero analytics, not all batches. Add regression test for: unassigned manager, scoped manager, Admin.

**Fix:** Ensure `list_scoped_batch_ids` query at `analytics/repository.py:22-28` correctly returns only batches the manager/coordinator owns. Add test coverage for empty-scope scenario.

**Acceptance:** Unassigned manager sees zero/empty scoped analytics and never receives another team's totals.

### S-02 — MBR Export: unbounded data for non-admin (same root cause) [High]

**From README item 11.** `export_mbr` calls `list_all_batches()` when `scoped_ids is None`. Currently the controller passes `current_user`, but the service delegates to `list_all_batches()` for the `None` (Admin) case. Need to confirm: for non-admin managers, `scoped_ids` should never be `None` — it should be `[]` or a real list.

**Fix:** Same as S-01. Ensure `current_user` is properly injected and scoped. The controller at line 20-24 does pass `current_user=current_user`, but verify the service path is correct. Add tests for manager-scoped export vs Admin full export.

**Acceptance:** Manager's downloaded workbook contains only permitted batches; Admin export contains all batches.

### S-03 — Session ledger: unfiltered list returns all records [High]

**From README item 12.** `GET /sessions` (sessions/controller.py:52-61) allows `batch_id` to be omitted. When omitted, `SessionService.list` (sessions/service.py:49-74) only calls `_require_batch_scope` when `batch_id` is supplied. Without `batch_id`, it calls `list_utilizations(batch_id=batch_id, ...)` which returns **every** utilization record to any authenticated user.

**Key gap:** `list_utilizations` at sessions/repository.py:55-74 has no `batch_id` filter when `batch_id=None`, returning all records.

**Fix:** Resolve a permitted batch-ID set from the user's scope *before* querying, always filter by that set. Define intended Faculty visibility explicitly (currently all authenticated users are treated identically).

**Acceptance:** Managers/coordinators receive only in-scope ledger rows; Admin/Finance retain intended visibility; an unfiltered request cannot enumerate unrelated batches.

### S-04 — Live `.env` contains real SMTP credentials [High — Operational]

**File:** `.env:19-20` (git-ignored but present in working directory)

```
SMTP_USER=testmailfortesting838@gmail.com
SMTP_PASSWORD=ehifpxbpjtdaqntp
```

The SMTP_PASSWORD is a real Gmail app password committed to the local environment. While `.env` is in `.gitignore`, any backup, copy, or shared environment leaks this credential.

**Fix:**
1. Rotate the exposed Gmail password immediately.
2. Move secrets to a secrets manager (Docker secrets, HashiCorp Vault, or at minimum an external `.env` file not in the repo).
3. Add `smtp.gmail.com` SMTP credentials to a CI secret-scanning check (e.g., `gitleaks`).
4. Add `.env` to `gitleaks` allow-list exclusions (since it's git-ignored) but still scan for secrets in the repo.

**Acceptance:** The Gmail password is rotated; no real credentials remain in any tracked or local file.

### S-05 — Auth hierarchy exposes full org tree [High]

**File:** `auth/controller.py:102-105`

```python
@router.get("/hierarchy", response_model=List[UserHierarchyNode], dependencies=[Depends(get_current_user)])
def get_organization_hierarchy(service: AuthService = Depends(get_auth_service)) -> Any:
    """Fetch the full organization reporting tree."""
    return service.get_organization_hierarchy()
```

`get_organization_hierarchy` in `auth/service.py:392-419` calls `user_repo.list_active()` and returns the **entire** org tree — names, emails, reporting relationships — to any authenticated user including Coordinators, Sales, and Faculty.

**Fix:** Scope the hierarchy to the caller's visibility: Admin sees all; Manager sees their subtree; Coordinator sees only their direct chain; Sales/Faculty see their own node + direct manager only.

**Acceptance:** Non-admin users receive only their allowed subtree, not the full org chart.

### S-06 — User list endpoint: docstring says Admin-only, dependency allows Managers [High]

**File:** `auth/controller.py:77-80`

```python
@router.get("/users", response_model=List[UserResponse], dependencies=[Depends(require_manager_or_admin)])
def list_users(service: AuthService = Depends(get_auth_service)) -> Any:
    """Admin Only: List all organization users with their assigned roles."""
```

The `require_manager_or_admin` dependency allows any Manager to enumerate all users (including Faculty emails). The docstring contradicts the dependency.

**Fix:** Change dependency to `require_admin` to match the docstring, OR scope results to the caller's hierarchy if managers need a filtered view.

**Acceptance:** Only Admins can list all users (or managers see only their scope, with explicit design decision).

### S-07 — Assignable users endpoint exposes user list to any authenticated user [Medium]

**File:** `auth/controller.py:93-99`

`GET /auth/users/assignable?role=Coordinator` returns all active users of the given role to any authenticated user, including email addresses. Sales reps or Faculty could enumerate the full coordinator/sales/manager rosters.

**Fix:** Require `require_manager_or_admin` or scope to the caller's team/hierarchy.

**Acceptance:** Only Managers/Admins can enumerate assignable users.

### S-08 — Faculty directory exposes emails to any user [Medium]

**File:** `faculty/controller.py:17-25`

```python
@router.get("", response_model=List[FacultyResponse])
def list_faculty(
    faculty_type: Optional[str] = None,
    domain: Optional[str] = None,
    service: FacultyService = Depends(get_faculty_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    return service.list(faculty_type, domain)
```

`FacultyResponse` includes `email`. Any authenticated user — including a Coordinator — can enumerate all Faculty emails.

**Fix:** Remove email from `FacultyResponse` for non-admin callers, or require `require_manager_or_admin`.

**Acceptance:** Faculty emails are not exposed to non-admin users.

### S-09 — Faculty utilization export unrestricted [Medium]

**File:** `faculty/controller.py:37-44`

`GET /faculty/utilization/export` uses `get_current_user` (any authenticated user). `FacultyService.utilization_export_rows` (faculty/service.py:67-78) returns all utilization records without any scoping.

**Fix:** Inject `current_user`, scope export to the caller's batch scope (reuse `_require_batch_scope` pattern), similar to S-03.

**Acceptance:** Export contains only records within the caller's scope.

### S-10 — Roles endpoint exposes internal role structure [Medium]

**File:** `roles/controller.py:25-32`

`GET /roles` with `get_current_user` allows any authenticated user to enumerate all roles and their `system_role` values. This reveals the authorization model to any caller.

**Fix:** Require `require_manager_or_admin` for role enumeration.

**Acceptance:** Only Manager+ roles can list organizational roles.

### S-11 — Session cookie missing `Secure` and `HttpOnly` flags [Medium]

**File:** `frontend/context/AuthContext.tsx:23-29`

```typescript
function setSessionCookie(present: boolean) {
  if (present) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }
}
```

The `ops_session` cookie (used by middleware.ts for navigation-level auth) lacks `Secure` (transmitted over HTTP) and `HttpOnly` (accessible to JavaScript). While it contains no credentials, it is the sole signal the edge middleware uses to allow/deny page navigation. A forged cookie could bypass the navigation guard.

**Fix:** Add `Secure` and `HttpOnly` flags. Set `SameSite=Lax` explicitly.

**Acceptance:** Cookie is `Secure; HttpOnly; SameSite=Lax`.

### S-12 — JWT tokens stored in localStorage (XSS risk) [Medium]

**Files:** `frontend/lib/api.ts:550-555`, `frontend/context/AuthContext.tsx:43-66`

Access and refresh tokens are stored in `localStorage`, which is accessible to any JavaScript running on the page. A single XSS vulnerability exposes all sessions.

**Fix (recommended):** Migrate to `HttpOnly; Secure; SameSite=Strict` cookies for token storage. The backend already supports Bearer auth — add a token-issuing endpoint that also sets the cookie. Client-side JS reads the token only for the initial page load check via the `HttpOnly` cookie presence.

**Alternative (lower-effort):** Keep localStorage but implement a strict CSP (`script-src 'self'`) to mitigate XSS. The current CSP in `main.py:66-76` already restricts scripts — verify it is enforced and add nonce-based inline script policy.

**Acceptance:** Tokens are not readable from JavaScript (HttpOnly) OR CSP is confirmed to block inline script execution.

### S-13 — Hardcoded default SECRET_KEY [Medium]

**Files:** `docker-compose.yml:61`, `.env.example:13`

```
SECRET_KEY=dev_secret_key_super_secure_enterprise_jwt_2026
```

This predictable key is used as the fallback in the Docker Compose backend service. If `SECRET_KEY` is not overridden in production, JWTs can be forged.

**Fix:**
1. In `docker-compose.yml`, remove the `${SECRET_KEY:-dev_secret_key_super_secure_enterprise_jwt_2026}` fallback — require explicit env var.
2. Add a startup validation in `config.py` that rejects the known dev default in production.
3. Document generating a 64-char key: `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

**Acceptance:** Production startup fails if SECRET_KEY is missing or matches the dev default.

### S-14 — Debug error details exposed in non-production [Medium]

**File:** `main.py:48-51`

```python
if settings.ENVIRONMENT != "production":
    detail = f"{type(exc).__name__}: {exc}"
```

In staging/development, full exception tracebacks are returned to clients. This can leak internal paths, SQL fragments, and stack structure.

**Fix:** Log the full detail server-side (via `print` → structured logger), return only a generic message to the client. Use Python `logging` instead of `print`.

**Acceptance:** Client-facing 500 responses never include exception type or message, regardless of environment.

### S-15 — Database connection error leaks connection details [Medium]

**File:** `database.py:25-29`

```python
raise RuntimeError(
    f"PostgreSQL connection failed in production environment. "
    f"DATABASE_URL={settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}. "
    f"Original error: {e}"
)
```

The production startup error includes the DB host, port, and database name, which leaks infrastructure details if this message surfaces in logs accessible to untrusted parties.

**Fix:** Log details to stderr/logging only; raise a generic `RuntimeError("PostgreSQL connection failed in production environment.")`.

**Acceptance:** The `RuntimeError` message contains no host/port/path information.

### S-16 — Swallowed notification exceptions [Medium]

**Files:** `batches/controller.py:159-167, 264-271`

```python
try:
    await NotificationService.notify_batch_approved(...)
except Exception:
    pass
```

Bare `except: pass` hides failures (email service down, SMTP errors, etc.), making operational issues invisible.

**Fix:** Replace with structured logging: `logger.warning("Notification failed: %s", exc)`, include batch ID and request ID. Distinguish between "notification optional" (log and continue) vs "business operation depends on notification" (return error to user).

**Acceptance:** Notification failures appear in logs with context; API never reports success when the core operation failed.

### S-17 — File upload: entire file read into memory before size check [Medium]

**File:** `schedules/controller.py:34-38`

```python
content = await file.read()
if len(content) > max_size:
    raise HTTPException(...)
```

The full file is buffered in memory before the size is checked. A 10 GB file with a `.csv` extension exhausts memory.

**Fix:** Use `UploadFile`'s streaming interface or FastAPI's `File(max_size=...)` to enforce size at the framework level. Add `content_type` validation (`.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `.csv` → `text/csv`).

**Acceptance:** Oversized uploads are rejected before full read; content type is validated.

### S-18 — Backend Containerfile runs as root [Medium]

**File:** `backend/Containerfile`

No `USER` directive — the backend runs as root inside the container. If the FastAPI process is compromised, the attacker has root in the container.

**Fix:** Create a non-root user and switch to it:
```dockerfile
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app app
USER app
```
Ensure the `/app` directory is owned by that user.

**Acceptance:** Container process runs as non-root (uid 1001).

### S-19 — Rate limiting scoped to auth endpoints only [Low]

**File:** `main.py:116-117`

```python
if not request.url.path.startswith("/api/v1/auth/"):
    return await call_next(request)
```

Only `/api/v1/auth/*` endpoints are rate-limited. Brute-force attacks on other endpoints (e.g., batch creation, schedule apply) are unthrottled.

**Fix:** Extend rate limiting to all mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) with appropriate thresholds. Or implement a configurable per-route rate-limit policy.

**Acceptance:** Write endpoints are rate-limited per-user/IP with documented thresholds.

### S-20 — No CSRF protection on cookie-based signals [Low]

**File:** `frontend/context/AuthContext.tsx` + `frontend/middleware.ts`

While API calls use `Authorization: Bearer` headers (not cookies), the `ops_session` cookie is set client-side (`document.cookie`) and the middleware reads it. Since the cookie is not `HttpOnly`, a malicious site could potentially set/forge `ops_session=1` via a subdomain cookie injection, tricking the middleware into allowing navigation (though the API would still reject the forged request). This is a defense-in-depth gap.

**Fix:** Mark `ops_session` as `Secure; HttpOnly; SameSite=Strict`. Add a CSRF token to state-changing API requests if migrating to cookie-based auth.

**Acceptance:** Cookie has all security flags; no cross-site cookie injection is possible.

### S-21 — Missing security artifacts and CI scanning [Low]

**Issues:**
1. No `.github/workflows/` directory — no CI/CD pipeline exists at all.
2. No `security.txt` or `robots.txt` at the web root.
3. No SAST tooling (bandit, semgrep) configured.
4. No dependency vulnerability scanner (`pip-audit`, `npm audit`) in CI.
5. No secret scanner (`gitleaks`, `trufflehog`) configured.
6. `.env` file present in working directory with real credentials (S-04 overlaps).

**Fix:**
1. Create `.github/workflows/security.yml` running: `bandit -r backend/`, `pip-audit -r backend/requirements.txt`, `npm audit`, `gitleaks detect`.
2. Add `security.txt` to Nginx serving root and/or backend.
3. Add `requirements-dev.txt` with `bandit`, `pip-audit`, `pytest-cov`.

**Acceptance:** CI pipeline runs security checks on every PR; failing scans block merge.

### S-22 — FMS_API_KEY configured but never used [Low]

**File:** `config.py:79`

`FMS_API_KEY: str = ""` is defined but `FmsSyncService.sync` (fms_sync/service.py:10-15) does not use it — it returns a hardcoded success dict. This dead config could confuse security auditors or lead to an unauthenticated FMS integration if implemented later.

**Fix:** Either implement FMS auth with the API key (with proper header injection) or remove the config and document that FMS is not yet integrated. Add `APIKeyHeader` dependency when implementing.

**Acceptance:** FMS_API_KEY is either actively used with proper auth headers or removed from config.

---

## Implementation Plan

### Phase 1 — Critical Authorization Fixes (S-01, S-02, S-03)

**Goal:** Close all data-exposure authorization gaps.

**Tasks (sequential):**
1. **Verify/implement empty-scope sentinel discipline (S-01, S-02):**
   - Confirm `_get_scoped_batch_ids` returns `[]` (not `None`) for non-admin managers with no assignments.
   - Add unit tests: unassigned manager → empty analytics; scoped manager → scoped analytics; Admin → full analytics.
   - `analytics/repository.py:22-28` — verify `list_scoped_batch_ids` query is correct.

2. **Close unfiltered session ledger (S-03):**
   - Modify `SessionService.list` (sessions/service.py:49) to always resolve a permitted batch-ID set from the caller's scope before querying, even when `batch_id` is omitted.
   - Add repository-level filtering in `SessionRepository.list_utilizations` (sessions/repository.py:55) for the batch-ID set.
   - Define Faculty visibility explicitly (managers see their subtree; Admin/Finance see all).
   - Add API tests: `GET /sessions` with and without `batch_id`, including unrelated batches, Finance/Admin access, and unauthorized batch IDs.

3. **Verify S-02 MBR export uses injected `current_user`:**
   - Confirm `analytics/controller.py:20-24` passes `current_user` and the service scopes correctly.
   - Add tests: manager export → scoped rows; Admin export → all rows.

**Validation:** `python -m pytest backend/tests/v1/analytics/ backend/tests/v1/sessions/` — all pass.

### Phase 2 — Credential & Secret Hygiene (S-04, S-13)

**Goal:** Eliminate real credentials from the working tree and prevent weak default keys.

**Tasks (sequential):**
1. Rotate the Gmail SMTP password (`ehifpxbpjtdaqntp`) immediately — **manual/operational**.
2. Remove the `SECRET_KEY` fallback in `docker-compose.yml:61` — require explicit env override.
3. Add production SECRET_KEY validation in `config.py:59-75` — reject if missing or < 32 chars or matches the dev default string.
4. Add `gitleaks` config (`.gitleaks.toml`) to scan the repo, with `.env` allowed since it's git-ignored.
5. Add `requirements-dev.txt` with `gitleaks`, `bandit`, `pip-audit`, `pytest-cov`.

**Validation:** `docker compose config` fails cleanly without SECRET_KEY; `bandit -r backend/` reports no HIGH severity issues.

### Phase 3 — Session Token Security (S-11, S-12)

**Goal:** Harden client-side token storage and cookie flags.

**Discussion points needed:**
- **Decision required:** Migrate tokens from `localStorage` to `HttpOnly` cookies, or accept CSP-only mitigation?
    - Cookie approach: More secure but requires backend changes (cookie-issuing endpoint, CSRF token for mutations).
    - CSP approach: Lower effort; current CSP already restricts `script-src 'self'`. Verify it is actually enforced by Nginx and add nonce support.

**Tasks (cookie approach):**
1. Add `set_token_cookie` on login/refresh endpoints — sets `HttpOnly; Secure; SameSite=Lax` cookie.
2. Update `api.ts` to send cookies with `credentials: "include"`.
3. Update middleware to read auth state from the HttpOnly cookie.
4. Add CSRF token to all non-GET API requests.
5. Update `setSessionCookie` in AuthContext to include `Secure; HttpOnly`.

**Tasks (CSP approach if chosen):**
1. Audit current CSP enforcement at the Nginx level (`main.py:66-76` sets headers, but Nginx proxy must not strip them).
2. Add `upgrade-insecure-requests` and `connect-src` matching the actual API URL.
3. Verify no inline scripts exist in the frontend.

**Validation:** `document.cookie` does not return the auth token (cookie approach); or CSP audit shows no `unsafe-inline` for scripts (CSP approach).

### Phase 4 — Data Exposure on Readable Endpoints (S-05, S-06, S-07, S-08, S-09, S-10)

**Goal:** Apply least-privilege to all enumeration endpoints.

| Endpoint | Current | Fix |
|---|---|---|
| `GET /auth/hierarchy` | `get_current_user` (any) | Scope to caller's subtree; Admin sees all. |
| `GET /auth/users` | `require_manager_or_admin` (managers see all) | Change to `require_admin`. |
| `GET /auth/users/assignable` | `get_current_user` (any) | Change to `require_manager_or_admin`. |
| `GET /roles` | `get_current_user` (any) | Change to `require_manager_or_admin`. |
| `GET /roles/{id}` | `get_current_user` (any) | Change to `require_manager_or_admin`. |
| `GET /faculty` | `get_current_user` (any) | Remove `email` from `FacultyResponse` for non-admin; or `require_manager_or_admin`. |
| `GET /faculty/utilization` | `require_coordinator_or_above` | Already restricted; OK. |
| `GET /faculty/utilization/export` | `get_current_user` (any) | Inject `current_user`; scope to caller's batches. |
| `GET /teams` | `get_current_user` (any) | Evaluate — team names/departments are low-risk; keep but remove if sensitive. |
| `GET /teams/{id}` | `get_current_user` (any) | Same. |

**Tasks (parallel across files):**
- `auth/controller.py`, `auth/service.py`: hierarchy scoping
- `auth/controller.py`: change `GET /auth/users` dependency
- `auth/controller.py`: change `GET /auth/users/assignable` dependency
- `roles/controller.py`: change `GET /roles` and `GET /roles/{id}` dependency
- `faculty/controller.py`, `faculty/service.py`, `faculty/repository.py`: scope faculty listing and export
- `faculty/schema.py`: split `FacultyResponse` into public (no email) and admin (with email) views

**Validation:** API tests confirm non-admin users get 403 on restricted endpoints; admin users still see full data.

### Phase 5 — Error Handling & Operational Hygiene (S-14, S-15, S-16, S-22)

1. **Replace `print` with structured logging** in `main.py` (ServerErrorResponseMiddleware). Use Python `logging.getLogger(__name__)`. Client-facing 500 responses return generic message.
2. **Remove DB connection details** from the `RuntimeError` in `database.py:25-29`.
3. **Replace bare `except: pass`** in `batches/controller.py:159-167, 264-271` with `logger.warning(...)` including batch ID.
4. **Remove or implement FMS_API_KEY** (S-22) — recommend removal until FMS is integrated, to avoid dead/ misleading config.

**Validation:** `main.py` error path returns `{"detail": "Internal server error"}` without exception details; logs contain full trace.

### Phase 6 — File Upload Hardening (S-17)

1. Add `File(max_size=MAX_UPLOAD_SIZE)` to all upload endpoints in `schedules/controller.py` and `batches/controller.py`.
2. Add content-type validation alongside extension check.
3. Consider streaming-based parsing for large Excel files (pandas already reads into memory — document the 10MB limit as enforced).

**Validation:** Upload of a 11MB file with `.csv` extension is rejected with 413 before `validate_upload_file` reads content.

### Phase 7 — Container Security (S-18)

1. Add non-root user creation in `backend/Containerfile`.
2. Add `USER app` directive before `EXPOSE`/`CMD`.
3. Verify file ownership of `/app` directory.

**Validation:** `docker run --rm <image> id` shows uid 1001 (non-root).

### Phase 8 — Rate Limiting & CSRF (S-19, S-20)

1. Extend `RedisRateLimitMiddleware` to cover all mutation endpoints, not just auth.
2. Ensure `ops_session` cookie has `Secure; HttpOnly; SameSite=Strict` flags (if cookie approach adopted in S-12).

**Validation:** Non-auth POST endpoints return 429 after threshold exceeded.

### Phase 9 — CI/CD Security Pipeline (S-21)

1. Create `.github/workflows/security.yml`:
   - `bandit -r backend/ -ll` (fail on medium+)
   - `pip-audit -r backend/requirements.txt`
   - `npm audit --audit-level=moderate`
   - `gitleaks detect` (with config excluding `.env`)
2. Create `.gitleaks.toml` with standard rules + allowlist for test fixtures.
3. Add `requirements-dev.txt`.
4. Create `security.txt` served by Nginx.

**Validation:** `gh workflow run security.yml` passes; PRs from forks trigger security scans.

---

## Testing Strategy

### Backend (pytest)

New test files to create:

```
backend/tests/v1/analytics/
  test_analytics_scope.py          # S-01: unassigned/empty-scope vs Admin
  test_mbr_export_scope.py         # S-02: manager vs Admin MBR export

backend/tests/v1/sessions/
  test_session_ledger_rbac.py      # S-03: filtered/unfiltered session list

backend/tests/v1/auth/
  test_hierarchy_scope.py          # S-05: scoped hierarchy per role
  test_user_list_rbac.py           # S-06: manager cannot list all users
  test_assignable_scope.py         # S-07: assignable requires manager+

backend/tests/v1/faculty/
  test_faculty_scope.py            # S-08/S-09: no email leak; scoped export

backend/tests/v1/roles/
  test_roles_rbac.py              # S-10: roles listing restricted

backend/tests/v1/security/
  test_error_suppression.py        # S-14/S-15: no internal details in 500
  test_file_upload_limits.py       # S-17: oversized upload rejected
  test_rate_limiting.py            # S-19: mutation endpoints throttled
```

### Frontend (vitest)

```
frontend/components/__tests__/
  AuthContext.test.tsx              # S-11/S-20: cookie flags, XSS storage
```

### Container Security

```
Manual: docker run --rm <backend_image> id  → expect uid 1001
Manual: bandit -r backend/ -ll              → expect no HIGH
Manual: gitleaks detect                    → expect clean (or documented allowlist)
```

---

## Rollout / Migration Path

| Phase | Change Type | Risk | Rollback |
|-------|-------------|------|----------|
| 1 (AuthZ fixes) | Code + tests | Medium — may break clients relying on unrestricted access | Revert DB-less service changes via rollback; restore old dependency decorators |
| 2 (Secrets) | Config | Low — requires env var changes | Set `SECRET_KEY` env var in deployment |
| 3 (Token storage) | Frontend + backend API change | High — affects all sessions | Keep localStorage fallback behind feature flag; revert cookie endpoint |
| 4 (Data exposure) | Dependency decorator changes | Medium — some users may lose endpoints | Revert decorators to `get_current_user` |
| 5 (Error handling) | Logging changes | Low | Revert logging format |
| 6 (File upload) | Validation rules | Low | Revert max_size |
| 7 (Container) | Dockerfile change | Low | Use previous image tag |
| 8 (Rate limiting) | Middleware config | Low | Set `RATE_LIMIT_ENABLED=false` |
| 9 (CI) | New files only | None | Delete workflow files |

### Deployment checklist

- [ ] `SECRET_KEY` set to 64+ char random value in all environments
- [ ] `REDIS_PASSWORD` set (Redis currently unauthenticated in compose)
- [ ] SMTP credentials rotated (S-04)
- [ ] `NEXT_PUBLIC_API_URL` set explicitly (no fallback to `127.0.0.1:8000`)
- [ ] Nginx configured to proxy `Strict-Transport-Security` from backend or add at edge
- [ ] Alembic migrations applied via `docker compose exec backend alembic upgrade head`

---

## Open Questions

1. **Token storage migration:** Is the team willing to accept the backend API changes (cookie-issuing endpoint + CSRF token) required for `HttpOnly` cookie storage, or should we rely on CSP-only mitigation?
2. **Hierarchy depth:** How many levels deep is the org hierarchy in production? The `get_all_subordinate_ids` BFS walk should be verified for performance on deep trees.
3. **Faculty visibility:** What is the intended visibility for Faculty-role users? Currently treated identically to all authenticated users — is this by design or an omission?
4. **Redis auth in production:** Should Redis be required to have a password in production (currently optional per `config.py:84`)?
5. **Audit log retention:** Is there a retention policy for `audit_logs`? The table grows indefinitely with no cleanup job.
