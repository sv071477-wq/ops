# Production Readiness Fix Plan

## Project Overview
Enterprise Operations Platform (Ops) - Full-stack application with FastAPI (Python 3.12) backend and Next.js 14 (TypeScript) frontend. Manages corporate training batches, schedules, faculty allocations, financial milestones, and quality feedback.

## Critical Security Issues (P0 - Must Fix Before Production)

### 1. Database: Remove SQLite Fallback in Production
**File:** `backend/app/core/database.py:14-29`
**Issue:** Code silently falls back to SQLite if PostgreSQL is unreachable. This is dangerous in production - should fail fast with clear error.
**Fix:** Add `ENVIRONMENT` check; only allow fallback in `development`. In production, raise exception with connection details.

### 2. Rate Limiting: Replace In-Memory with Redis
**File:** `backend/app/main.py:27-52`
**Issue:** `RateLimitMiddleware` uses in-memory dict - doesn't work across multiple workers/containers.
**Fix:** Implement Redis-backed rate limiter using `redis-py`. Add Redis connection to config. Disable in-memory limiter when Redis configured.

### 3. CORS: Enforce Production Origin Configuration
**File:** `backend/app/core/config.py:35-47`
**Issue:** Defaults to localhost origins. No validation that production overrides are set.
**Fix:** Add validator that raises error if `ENVIRONMENT=production` and `BACKEND_CORS_ORIGINS` contains localhost or defaults.

### 4. Security Headers: Add CSP Header
**File:** `backend/app/main.py:13-24`
**Issue:** Missing Content-Security-Policy header.
**Fix:** Add CSP header with restrictive policy (script-src 'self', style-src 'self' 'unsafe-inline', etc.)

### 5. Secrets: Validate SECRET_KEY Strength
**File:** `backend/app/core/config.py:20`
**Issue:** SECRET_KEY required but no minimum entropy validation.
**Fix:** Add validator ensuring SECRET_KEY >= 32 chars in production.

### 6. Auto-Migration on Startup: Disable in Production
**File:** `backend/app/main.py:55-61`
**Issue:** `init_db()` runs ALTER TABLE on every startup - dangerous for production.
**Fix:** Gate `init_db()` behind `ENVIRONMENT != "production"` or explicit flag. Migrations must be explicit via `alembic upgrade head`.

---

## High Priority Bugs & Architecture Issues (P1)

### 7. Faculty Auto-Provisioning Creates Unauthorized Accounts
**File:** `backend/app/api/v1/sessions/service.py:163-218`
**Issue:** `_resolve_faculty()` auto-creates User records with random passwords and `@ops.faculty.internal` emails when faculty name not found. This bypasses admin control.
**Fix:** Remove auto-provisioning. Return 422 error requiring explicit faculty creation by admin. Add admin endpoint to bulk-create faculty.

### 8. Schedule Application Race Condition
**File:** `backend/app/api/v1/schedules/service.py:294-301`
**Issue:** Check-then-insert pattern for duplicate sessions is not atomic. Concurrent requests can create duplicates.
**Fix:** Add unique constraint on `(batch_id, session_date, module)` in DB. Use `ON CONFLICT DO NOTHING` or catch `IntegrityError`.

### 9. Conflict Engine Timezone Inconsistency
**File:** `backend/app/api/v1/schedules/conflict_engine.py:33,40-41`
**Issue:** `date_of_training` handling mixes timezone-aware and naive datetimes. `start_of_day` replacement may break on DST boundaries.
**Fix:** Normalize all datetimes to UTC at API boundary. Use `date()` for date-only comparisons.

### 10. Batch Status Transition Logic Complexity
**File:** `backend/app/api/v1/batches/service.py:328-407`
**Issue:** `update_lifecycle_status` has complex nested logic for "Resume" with multiple edge cases. Hard to test and maintain.
**Fix:** Extract to explicit state machine. Define valid transitions as data. Add comprehensive unit tests for each transition.

### 11. Notification Service is Logging-Only (Incomplete Feature)
**File:** `backend/app/api/v1/notifications/service.py`
**Issue:** All notifications only log - no actual delivery (email, push, webhook).
**Fix:** Implement email notifications using existing `email_service`. Add notification preferences per user. Queue via background task (Celery/RQ) or `BackgroundTasks`.

### 12. Audit Logging Silent Failures
**File:** `backend/app/api/v1/auth/service.py:22-46`
**Issue:** `log_audit_event` catches all exceptions and rolls back silently. Audit failures go unnoticed.
**Fix:** Log audit failures to separate logger. Don't rollback main transaction. Add monitoring alert on audit failure rate.

### 13. File Upload: No Size Limits or Validation
**Files:** `backend/app/api/v1/schedules/controller.py:66-88`, `backend/app/api/v1/batches/controller.py:206-223`
**Issue:** No `File(size_limit=...)` or content-type validation beyond extension check.
**Fix:** Add `File(..., max_size=10_000_000)` (10MB). Validate MIME type. Scan for malicious content.

### 14. Pagination: No Maximum Limit Enforcement
**File:** `backend/app/api/v1/batches/controller.py:133-145`
**Issue:** `limit=5000` default allows massive result sets causing OOM.
**Fix:** Add `max_limit=100` validator. Enforce in dependency or service layer.

### 15. Password Reset: No Rate Limiting on Admin Endpoint
**File:** `backend/app/api/v1/auth/controller.py:124-134`
**Issue:** `admin_change_user_password` has no rate limiting - admin could brute-force or DoS.
**Fix:** Apply stricter rate limit (5/min) to admin password reset endpoints.

---

## Medium Priority Issues (P2)

### 16. Frontend API Client: Token Refresh Race Condition
**File:** `frontend/lib/api.ts:509-529`
**Issue:** Multiple concurrent 401s can trigger multiple refresh attempts. No deduplication.
**Fix:** Add refresh promise caching - store in-flight refresh promise, reuse for concurrent calls.

### 17. Frontend: Hardcoded API URL Default
**File:** `frontend/lib/api.ts:3-4`
**Issue:** Defaults to `http://127.0.0.1:8000/api/v1` - breaks in production Docker/K8s.
**Fix:** Require `NEXT_PUBLIC_API_URL` env var. Fail build if not set in production.

### 18. Frontend: No Error Boundaries
**Files:** `frontend/app/layout.tsx`, `frontend/app/page.tsx`
**Issue:** Uncaught React errors crash entire app. No graceful degradation.
**Fix:** Add Error Boundary component wrapping main content. Show user-friendly error UI with retry.

### 19. Database: Missing Indexes for Common Queries
**Files:** `backend/app/models/*.py`, `db_scheme/schema.dbml`
**Issue:** Frequent queries on `Batch.status`, `Batch.domain`, `FacultyUtilization.faculty_name + date_of_training` may lack optimal indexes.
**Fix:** Add composite indexes:
- `batches (status, domain, start_date)`
- `faculty_utilization (faculty_name, date_of_training)`
- `training_sessions (batch_id, session_date)`

### 20. Docker: Missing Health Checks
**Files:** `docker-compose.yml`, `backend/Containerfile`, `frontend/Containerfile`
**Issue:** No `HEALTHCHECK` directives. Orchestration can't detect unhealthy containers.
**Fix:** Add health check endpoints (`/health`) and Docker HEALTHCHECK with appropriate intervals.

### 21. API: No Request ID / Distributed Tracing
**Files:** `backend/app/main.py`, `backend/app/api/deps.py`
**Issue:** No correlation IDs for request tracing across services.
**Fix:** Add middleware generating `X-Request-ID`. Propagate to logs. Integrate with OpenTelemetry if needed.

### 22. Database Pool Settings Hardcoded
**File:** `backend/app/core/database.py:19-22`
**Issue:** `pool_size=10, max_overflow=20` not configurable.
**Fix:** Move to config via env vars (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`).

### 23. Batch NPS Calculation: Floating Point Precision
**File:** `backend/app/api/v1/batches/service.py:494`
**Issue:** `Decimal(str(round(float(...), 2)))` loses precision. Should use Decimal arithmetic throughout.
**Fix:** Use `Decimal` for all calculations: `((promoters - detractors) * Decimal("100") / total).quantize(Decimal("0.01"))`

### 24. Seed Scripts: Hardcoded/Weak Passwords
**Files:** `backend/scripts/seed_default_users.py:31-35`, `backend/scripts/import_real_data.py:42`
**Issue:** Default passwords from env but fallback to weak hardcoded values.
**Fix:** Remove fallbacks. Require `DEFAULT_USER_PASSWORD` and `IMPORT_DATA_PASSWORD` env vars. Validate strength.

### 25. FMS Integration: No Circuit Breaker
**File:** `backend/app/api/v1/fms_sync/service.py` (not fully read)
**Issue:** External FMS calls have no timeout, retry, or circuit breaker.
**Fix:** Add `httpx` timeout. Implement circuit breaker pattern (e.g., `pybreaker`).

---

## Low Priority / Technical Debt (P3)

### 26. Code Organization: Repository Pattern Inconsistency
**Observation:** Some services use repositories (`BatchRepository`), others use direct DB queries in service.
**Fix:** Standardize on repository pattern for all data access.

### 27. Type Safety: Frontend `any` Types
**File:** `frontend/lib/api.ts` multiple locations
**Issue:** `response.json()` cast to `any` then to interface.
**Fix:** Use proper generic types. Add Zod schemas for runtime validation.

### 28. Testing: Low Coverage
**Observation:** Tests exist but coverage unknown. No integration tests for critical flows.
**Fix:** Add pytest-cov. Target >80% coverage. Add E2E tests for: batch lifecycle, schedule ingest, gate completion.

### 29. Documentation: OpenAPI Spec Incomplete
**Observation:** Some endpoints missing response models, examples.
**Fix:** Add `response_model` to all endpoints. Add `examples` in Pydantic models.

### 30. WebSocket/Real-time: Missing for Collaborative Features
**Observation:** No real-time updates for batch status, approvals, session completions.
**Fix:** Add WebSocket endpoint (FastAPI `WebSocket`). Use for live dashboard updates.

---

## Validation Plan

### Pre-Deployment Checklist
- [ ] All P0 issues resolved
- [ ] All P1 issues resolved
- [ ] PostgreSQL connection verified in staging
- [ ] Redis rate limiting tested under load
- [ ] CORS origins validated for production domain
- [ ] SECRET_KEY generated with 64+ chars entropy
- [ ] Alembic migrations applied explicitly (no auto-migrate)
- [ ] File upload size limits tested
- [ ] Pagination limits enforced
- [ ] Health checks passing in Docker
- [ ] Error boundaries catch React errors
- [ ] Token refresh race condition fixed
- [ ] Audit logging failures alerted

### Load Testing Scenarios
1. 100 concurrent users creating batches
2. 50 concurrent schedule uploads (1000 rows each)
3. 200 concurrent session completions with feedback
4. Token refresh storm (50 simultaneous 401s)

### Security Testing
- [ ] OWASP ZAP scan
- [ ] Dependency vulnerability scan (`pip-audit`, `npm audit`)
- [ ] Penetration test on auth endpoints
- [ ] SQL injection attempts on all query parameters

---

## Implementation Order

### Phase 1: Critical Security (Week 1)
1. Remove SQLite fallback
2. Implement Redis rate limiting
3. Enforce CORS configuration
4. Add CSP header
5. Validate SECRET_KEY strength
6. Disable auto-migration in production

### Phase 2: Data Integrity & Core Bugs (Week 2)
7. Remove faculty auto-provisioning
8. Fix schedule race condition (DB constraint)
9. Fix conflict engine timezone handling
10. Refactor batch status transitions
11. Add file upload limits
12. Enforce pagination max limit

### Phase 3: Observability & Reliability (Week 3)
13. Implement real notifications
14. Fix audit logging failures
15. Add Docker health checks
16. Add request ID tracing
17. Make DB pool configurable
18. Fix NPS Decimal precision

### Phase 4: Frontend & Polish (Week 4)
19. Fix token refresh race condition
20. Require API URL env var
21. Add React error boundaries
22. Add missing database indexes
23. Remove seed script password fallbacks

### Phase 5: Testing & Documentation (Week 5)
24. Increase test coverage
25. Complete OpenAPI documentation
26. Load testing
27. Security scanning

---

## Open Questions for User

1. **Redis Infrastructure**: Do you have Redis available for rate limiting, or should we use a simpler alternative (e.g., database-backed)?
2. **Notification Channels**: Which notification channels are required? (Email only? Slack? Teams? Push?)
3. **Faculty Management**: Should faculty be pre-created by admin, or is self-registration acceptable?
4. **Batch Status Transitions**: Can you provide the exact valid state transition diagram for batches?
5. **Docker Orchestration**: Target platform - Docker Compose, Kubernetes, ECS, or other?
6. **Monitoring Stack**: What logging/monitoring stack? (Datadog, Prometheus/Grafana, CloudWatch, ELK?)
7. **FMS Integration**: Is the FMS sync feature actively used or can it be deprecated/simplified?
8. **Real-time Updates**: Is WebSocket/real-time a priority for this release?

---

## File Reference Summary

| Category | Files to Modify |
|----------|-----------------|
| Config/Security | `backend/app/core/config.py`, `backend/app/core/database.py`, `backend/app/main.py` |
| Auth/Audit | `backend/app/api/v1/auth/service.py`, `backend/app/api/v1/auth/controller.py` |
| Batches | `backend/app/api/v1/batches/service.py`, `backend/app/api/v1/batches/controller.py` |
| Schedules | `backend/app/api/v1/schedules/service.py`, `backend/app/api/v1/schedules/conflict_engine.py` |
| Sessions | `backend/app/api/v1/sessions/service.py` |
| Notifications | `backend/app/api/v1/notifications/service.py` |
| Frontend API | `frontend/lib/api.ts` |
| Frontend Auth | `frontend/context/AuthContext.tsx` |
| Frontend Layout | `frontend/app/layout.tsx` |
| Docker | `docker-compose.yml`, `backend/Containerfile`, `frontend/Containerfile` |
| Database | `db_scheme/schema.dbml`, alembic migrations |
| Scripts | `backend/scripts/seed_default_users.py`, `backend/scripts/import_real_data.py` |