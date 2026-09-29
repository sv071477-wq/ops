# Frontend Audit Report — Enterprise Ops Platform

**Scope:** `frontend/` (Next.js 14.2.5 App Router, React 18.3, TypeScript 5.5)
**Date:** 2026-09-29
**Nature:** Read-only assessment. No source files were modified.

---

## 1. Executive Summary

The frontend is a **functionally complete but architecturally fractured** application. All three business workflows (batch lifecycle, scheduling, faculty utilization) are implemented and reachable, but that functionality sits on top of roughly **50% dead code**, **two parallel component trees**, **two competing data-fetching strategies (one of them non-functional)**, and a **live CSS bug that silently breaks the visual design of the four largest screens**.

The single most important finding: the codebase contains an **abandoned refactor** (`src/`, 32 files) that is *better* code than what actually runs, is *never imported by anything*, and is *held together by a `tsconfig` alias hack that will silently misroute imports if a directory is ever added at the repo root**.

| Metric | Value |
|---|---|
| TS/TSX source files | 88 |
| Reachable from Next.js entry points | 39 |
| **Orphaned / dead** | **49 (56%)** |
| `src/**` files reachable from the app | **0 of 32** |
| Largest file | `components/BatchDetailDrawer.tsx` — **3,687 lines** |
| Total test count | **33 tests, 6 files** |
| Coverage of app code | ~6% |
| Live CSS-variable references that resolve to nothing | **200+** |

---

## 2. Stack & Build

| Item | Value | Notes |
|---|---|---|
| Framework | Next.js 14.2.5, App Router | `output: "standalone"` for container deploy |
| React | 18.3.1 | |
| Language | TypeScript 5.5.3, `strict: true` | `target: es2017` — quite old for a 2026 project |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss` 4.3.3) | CSS-first `@theme` config, no `tailwind.config.js` |
| Component primitives | Radix UI + `class-variance-authority` | shadcn-style in `components/ui/` |
| Data | TanStack Query 5.104 | **installed and configured, but never mounted** |
| Forms | react-hook-form 7.51 + Zod 3.22 | |
| Tests | Vitest 5 + MSW 2 + Testing Library | |
| State mgmt | **None** (no Redux/Zustand/Jotai) | Context + props only |
| Env vars | One: `NEXT_PUBLIC_API_URL` | |

**Runtime shape:** 4 routes total — `/`, `/login`, `/admin`, and a dead `/dashboard` folder with no `page.tsx`. Every route is a client component; there is **no `middleware.ts`**, no RSC data fetching, and no SSR.

---

## 3. Critical Findings

### 3.1 CRITICAL — Undefined CSS variables break the design of every major screen

`app/globals.css` defines its design tokens in a Tailwind v4 `@theme` block using **`--color-*` prefixed names** (`--color-primary`, `--color-muted-foreground`, …). Tailwind v4 emits those to `:root` under their full names.

However, the legacy inline-style layer in the four largest components references **unprefixed names that are defined nowhere**:

| Referenced | Defined in `@theme`? | Used in |
|---|---|---|
| `var(--text-main)` | **No** | `app/page.tsx`, `app/admin/page.tsx`, `BatchDetailDrawer.tsx`, `EnterpriseDashboard.tsx` |
| `var(--text-muted)` | **No** | same, plus `lib/ErrorBoundary.tsx` |
| `var(--text-dim)` | **No** | same |
| `var(--border-subtle)` | **No** | same |
| `var(--primary)` | **No** (only `--color-primary`) | same |
| `var(--emerald)` | **No** | same |
| `var(--amber)` | **No** | same |
| `var(--accent-primary)` | **No** | `app/page.tsx:925` |

**Evidence:** `app/globals.css:5-73` is the only application stylesheet (`Glob frontend/**/*.css` returns only `globals.css` plus two committed `coverage/` artifacts). Grepping all `*.css` for these definitions returns **zero matches**. A content search for the usages **exceeded a 200-match limit**, spanning `app/page.tsx:510-1294`, `components/BatchDetailDrawer.tsx:822-2000+`, and `lib/ErrorBoundary.tsx:246-247`.

**Impact.** Per CSS spec, an invalid `var()` reference makes the whole declaration compute to `unset`:
- `color: "var(--text-main)"` → text inherits instead of using the intended near-black.
- `borderBottom: "1px solid var(--border-subtle)"` → **the entire shorthand is invalid, so no border renders at all.**
- `boxShadow: "var(--shadow-lg)"` → no shadow.

So the table row separators, panel borders, and text hierarchy across the main dashboard, admin portal, and batch detail drawer are all silently not applying. Note `var(--shadow-lg)` and `var(--font-display)` *are* valid (`globals.css:60`, `:8`) — the breakage is specific to the eight names above. This strongly suggests a Tailwind v3 → v4 migration that renamed tokens in CSS but not in the ~200 inline style objects.

**This is the highest-value, lowest-risk fix in the codebase:** add eight alias definitions to `:root` and the entire UI comes back.

### 3.2 CRITICAL — `QueryClientProvider` is never mounted

`components/providers/QueryProvider.tsx` is a correct, complete provider (`staleTime` 5 min, `retry: 1`, devtools). It has **zero importers**. `app/layout.tsx` is 25 lines and mounts only `AuthProvider` + `ErrorBoundary`:

```tsx
// app/layout.tsx:19-21
<AuthProvider>
  <ErrorBoundary>{children}</ErrorBoundary>
</AuthProvider>
```

Yet `@tanstack/react-query` is a production dependency, and **25 hooks** across 6 files call `useQuery`/`useMutation`/`useQueryClient`. Any of them throws `No QueryClient set` on first render. This is currently masked only because nothing imports them — so the moment anyone completes the `src/` migration, they get a white screen.

The one existing test (`useBatches.test.tsx:7-16`) works around this by constructing its own local `QueryClient`.

### 3.3 CRITICAL — `src/` is an abandoned refactor, wired up by an alias landmine

`src/` contains 32 files: `features/{batches,finance,analytics,faculty,approvals}` and `shared/components/{ui,dashboard}`. Evidence it is abandoned:

- **Zero** `@/src/...` import statements exist in the repo.
- All 11 `@/features/*` and `@/shared/*` imports are **internal to `src/`**; no live file imports `src/`.
- `src/` imports *from* the live tree 26 times, but the reverse never happens.
- Git history (`src/` created in commit `838d8b8d`, 2026-09-10, *"restrucutured the code for the di and feature layered arch"*) shows ~10 subsequent commits, all backend-focused. Two later "Refactor code structure" commits (most recently 2026-09-25) never wired it in.
- It does not type-check: `BatchOperationsHub.tsx:215` reads `b.completion_rate`, absent from its own `Batch` interface.
- Its barrel `src/shared/components/ui/index.ts:1-72` re-exports from `@/components/ui/*` (the *old* tree) rather than its own siblings — a textbook "copied the folder, kept using the originals" half-migration.
- It duplicates 9 domain types from `lib/api.ts` with **conflicting shapes**. Notably `ManagerDashboardSummary` is entirely different between the two definitions, so the `src/` hooks are typed against a contract the backend does not return.

**The alias landmine.** `tsconfig.json:22-24`:
```json
"paths": { "@/*": ["./*", "./src/*"] }
```
TypeScript tries `./*` first and falls through to `./src/*`. This is unambiguous **only by accident** — no top-level segment currently exists at both `<root>/X` and `<root>/src/X`. The moment someone creates `./features/` or `./shared/` at the repo root, **every existing `@/features/*` import silently re-points at the wrong file with no error and no warning.** A partial migration that leaves a stub at the root would likewise appear to succeed while changing nothing — which is exactly the failure the inverted barrel proves already happened once.

**Compounding:** `vitest.config.ts:55-61` uses a *completely different* alias map (`@/lib`→`./lib`, `@/components`→`./components`, `@`→`./src`). So `@/context/AuthContext` and `@/hooks/useMediaQuery` — valid for `tsc` — resolve to non-existent `src/context/...` under Vitest. The first test that imports `AuthContext` will fail to resolve.

### 3.4 HIGH — A well-built error system exists and is 100% unreachable

| File | Lines | Status |
|---|---|---|
| `lib/errors.ts` | 245 | **Dead** — `AppError` base + 7 subclasses, `normalizeError`, `createErrorFromResponse`, `getUserFriendlyMessage` |
| `lib/errorHandler.ts` | 65 | **Dead** |
| `lib/ErrorBoundary.tsx` | 274 | **Dead** — has `resetKeys`, structured `logError`, error-report download, `withErrorBoundary` HOC |
| `components/ErrorBoundary.tsx` | 136 | **Live** (`app/layout.tsx:3`) — bare `console.error` only |
| `lib/toast.tsx` | 214 | **Dead** — `ToastProvider` never mounted |

**The app runs the weaker of the two error boundaries, and the stronger one would crash if mounted:** `lib/ErrorBoundary.tsx:95` calls `useToast()`, which throws `"useToast must be used within a ToastProvider"` (`lib/toast.tsx:210-212`). Its fallback UI would throw a second error while rendering the first.

**The chain is severed at the root:** `lib/api.ts:618` throws a bare `new Error(message)`, discarding HTTP status, error code, and details. So even if the taxonomy were wired, `normalizeError` would classify every API failure as `UNKNOWN_ERROR`, and `createErrorFromResponse` — which needs a real `Response` — would never run.

**Consequence in the UI:** all 18 `alert()` calls (6 in `app/page.tsx`, 8 in `app/admin/page.tsx`, 2 in `BatchDetailDrawer.tsx`, 2 in dead files) are the *only* user-facing error channel, and one of them fires on the **success** path (`app/admin/page.tsx:389` — `alert("Approval levels saved")`). There are three competing toast systems and **none is mounted**.

### 3.5 HIGH — No working route protection or authorization

There is no `middleware.ts`. Route guarding is hand-rolled in **three different styles across three files**, all client-side:

- `app/page.tsx:111-117` — `router.push` / `router.replace`
- `app/admin/page.tsx:297-313` — `window.location.href`, with **both** branches coexisting
- `app/login/page.tsx:17-26` — inverse guard

Because `api.getToken()` returns `null` server-side (`lib/api.ts:551-554`) and every route is a client component, **unauthenticated users receive full HTML for every page** and are bounced only after hydration.

**Authorization is UI-only.** `isApprover`, `isFinanceViewAvailable`, `canCreateBatch` gate *rendering* and nothing else. Any user can call `api.deleteUser` or `api.deleteBatch` from the console.

**One dead branch:** `app/page.tsx:496` tests `user?.role?.toLowerCase() === "finance"`, but `User.role` (`lib/api.ts:40`) is the union `"Admin" | "Manager" | "Coordinator" | "Sales" | "Faculty"` — `"finance"` is not a member. Finance access relies entirely on the `team_name === "finance"` half of the same expression.

---

## 4. Data Layer

### 4.1 API client — `lib/api.ts` (1,249 lines)

A single `class ApiService` exported as a module-level singleton (`lib/api.ts:549`, `:1248`), exposing **79 methods** (76 public, 3 private) across auth, users, teams, roles, batches, sessions, schedules, faculty, finance, analytics, and FMS integration.

**Well-designed:** the 401-refresh de-duplication via a cached `refreshPromise` (`:558`, `:596-605`) is the one genuinely good concurrency detail in the file.

**Problems:**

| Issue | Evidence | Consequence |
|---|---|---|
| Base URL computed at **module load** | `:16` `const API_BASE = getApiBaseUrl()` | Throws during module init in prod if env var missing — opaque boot failure |
| `next.config.js` rewrite is **dead code** | `next.config.js:8-15` | `api.ts:571` always builds absolute URLs, so the `/api/v1/:path*` proxy can never fire; the browser is fully dependent on backend CORS |
| **6 methods bypass `request()`** | `:881`, `:1090`, `:1143`, `:1211` | Never auto-refresh a 401, never share error parsing |
| All errors collapse to bare `Error` | `:618` | No status, code, or details — this is what breaks the error taxonomy (§3.4) |
| No timeout / `AbortSignal` support | — | A hung request hangs the UI indefinitely |
| 200-with-empty-body throws `SyntaxError` | `:626` | Reported as a parse error, not an API error |
| **No `api.logout()`** | — | Logout is client-side only; refresh token is never revoked server-side |
| Token desync | `:607-608` vs `AuthContext.tsx:21` | Client-side refresh writes `localStorage` but never notifies the context, so `AuthContext.token` silently goes stale |
| Pointless URL round-trip | `:631` | `${API_BASE.replace("/api/v1","")}/api/v1/...` === `${API_BASE}/...` |
| `endpoint.startsWith("http")` passthrough | `:571` | Unguarded; also auto-attaches the Bearer token |

**Stale API methods:** 8 declared but never called anywhere — `createUser`, `getMyReports`, `approveBatch` (superseded by `decideBatch`), `updateBatchOption`, and the 3 `*ProgramType` methods, plus `rescheduleSession`.

### 4.2 Two competing data strategies — one is dead

**Live (100% of production traffic):** raw `api.*` inside `useEffect` + `useState`.
- **261 `useState`, 30 `useEffect`, 79 `api.*` call sites.** `app/admin/page.tsx` alone has **81 `useState`**; `BatchDetailDrawer.tsx` has **76**.

**Dead:** 25 TanStack Query hooks across `app/dashboard/hooks/` and `src/features/*/hooks/` — ~50 `api.*` calls, plus 2 orphaned components (`BatchOperationsHub.tsx` 262 lines, `ApprovalQueue.tsx` 150 lines) and `DashboardLayout.tsx` (54 lines, the sole `<Toaster/>` mount).

Net production capabilities: **no caching, no dedupe, no retry, no cancellation, no background refresh.** Data is frozen at mount.

**The two hook trees also disagree on query keys**, so if both were ever mounted they would double-fetch and invalidations would not cross-fire:

| Data | `app/dashboard/hooks` | `src/features/*` |
|---|---|---|
| Manager dashboard | `["manager-dashboard"]` | `["managerDashboard"]` |
| Faculty list | `["faculty-list", …]` | `["facultyList", …]` |
| Users | `["users"]` | `["allUsers"]` |
| Finance batches | `["finance-drafts"]` | `["financeBatches", …]` |

**Structural defects in the live fetch code:**
- **Race conditions.** `app/page.tsx:138-150` and `BatchDetailDrawer.tsx:126-135` have no `AbortController` and no request-generation guard — a slow response for a stale filter can clobber fresh state.
- **Duplicate requests per navigation** — `app/page.tsx:272-297` and `:309-313` can both fire on a single view change.
- **Silent failure everywhere.** `.catch(() => default)` on 3/3 calls at `app/page.tsx:256-258`, 4/5 at `app/admin/page.tsx:319-323`, 7/7 at `BatchDetailDrawer.tsx:140-146`. A total backend outage renders as "empty list", not an error.
- **Errors logged, never surfaced** — `console.error` with no error state in 10+ places.

### 4.3 State management

- **10 hand-rolled page/pageSize pairs** in `app/page.tsx` + 6 more in `app/admin/page.tsx`, each a copy-pasted `slice()` `useMemo`. `app/dashboard/hooks/usePagination.ts` implements this generically and is **imported by nothing**. `app/admin/page.tsx` never resets pages at all — searching users while on page 5 yields an empty table.
- **`financeDrafts` (`app/page.tsx:56-61`)** is a hand-rolled write-through draft cache managed by three separate mechanisms (sync effect, patcher, bulk `Promise.all` saver). The same 4-field dirty comparison is duplicated three times. The bulk saver has no concurrency cap and no partial-failure accounting — one failure leaves the table in an indeterminate state.
- **Server-side BFS in the client** — `EnterpriseDashboard.tsx:681-721` does a manual breadth-first traversal with `users.find()` *inside* the loop; O(n²)–O(n³) per recomputation.
- **No global state library.** `BatchDetailDrawer` keeps a private copy of the batch (`:115`) that must be manually resynced via `onBatchUpdated` — a second source of truth for the same entity.

---

## 5. Component & Styling Architecture

### 5.1 Two design systems coexist

- **New (Tailwind + cva):** `components/ui/*` and the (dead) `src/shared/components/ui/*`.
- **Old (inline `style={{}}` + CSS vars):** the four mega-components.

`globals.css` carries **both**: a Tailwind v4 `@theme` block *and* a 200-line legacy utility layer (`.glass-panel`, `.btn-*`, `.badge-*`, `.modal-*`, `.glass-table`). The `src/` tree is the *better* code and the *unreachable* code — deleting it would discard the only Tailwind-native UI in the repo.

### 5.2 Mega-components

| File | Lines | `useState` |
|---|---|---|
| `components/BatchDetailDrawer.tsx` | **3,687** | 76 |
| `app/admin/page.tsx` | 2,402 | 81 |
| `components/EnterpriseDashboard.tsx` | 2,253 | 12 |
| `app/page.tsx` | 1,345 | 36 |
| `lib/api.ts` | 1,249 | — |

`BatchDetailDrawer.tsx` is 2.7× the next-largest file and holds 76 state hooks in a single function component; ~1,240 lines below the state block belong in 5–6 separate components.

### 5.3 Duplicate UI primitives

`components/ui/*` (16 files) and `src/shared/components/ui/*` (17 files) overlap heavily. Some are identical (`badge.tsx`, `table.tsx`), some near-identical (`dialog.tsx`, `drawer.tsx` differ only by a `size` prop), and some are **genuinely different** — `input.tsx`, `select.tsx`, `label.tsx` wrap in an a11y label/error wrapper in `src/` but are bare in the root tree; `form-field.tsx` exports **disjoint APIs** (`FormError`/`FormHelperText` vs `FormItem`/`FormControl`/`FormMessage`).

Two genuine defects in the live tree: `components/ui/card.tsx:34` types `<h3>` as `React.HTMLParagraphElement` (the `src/` copy has the correct fix), and `components/ui/use-toast.ts:7` sets `TOAST_REMOVE_DELAY = 1000000` (~16.7 minutes) vs the `src/` copy's `5000`.

`components/ApproveBatchModal.tsx` and `components/ChangePasswordModal.tsx` are **not** duplicates — they are 3-line re-export shims preserving the old import path. The canonical code lives in `components/forms/`. This creates a latent barrel cycle (`forms/index.ts` → `forms/batch/index.ts` → `CreateBatchModal` → `forms/modal/FormModal` → `forms/fields`), currently masked because `@/components/forms` is imported by nothing.

---

## 6. Forms & Validation

This is the **strongest area** of the frontend.

- `lib/validation/schemas.ts` (238 lines) defines **14 well-built Zod schemas** with cross-field refinements (end > start, start not in the past, rejection-reason-when-rejected, session-ID-when-completed).
- `components/forms/modal/FormModal.tsx` is a clean single-stage modal: `zodResolver` + `FormProvider` + `useForm`.
- `components/forms/modal/WizardModal.tsx` is a clean multi-stage variant — **now dead** (its only consumer was the batch creation form, converted to single-stage).
- 7 reusable field components (`TextField`, `SelectField`, `DateField`, `NumberField`, `TextAreaField`, `PasswordField`, `ChipArrayField`) are consistently implemented with `Controller` + accessibility wiring.

**Gaps:** `FormModal` does not reset on close, so abandoned input persists across open/close cycles. `ChipArrayField` duplicates-guard is missing, so the same trainer can be added twice.

---

## 7. Testing

**33 tests across 6 files — roughly 6% coverage of application code.**

| Test file | Tests | Covers |
|---|---|---|
| `lib/dateUtils.test.ts` | 19 | The only genuinely well-tested module |
| `src/features/batches/hooks/useBatches.test.tsx` | 6 | Against a locally-built `QueryClient` |
| `components/ui/{button,input,card,badge}.test.tsx` | 5+6+3+4 | Primitives only |

**Zero tests** for `lib/api.ts` (1,249 lines — the entire data layer), `context/AuthContext.tsx`, all 14 Zod schemas, both error boundaries, and all 3 error modules.

**Structural problems:**
1. **`app/**` is excluded from `vitest.config.ts:11`**, so the four largest files — ~10,700 lines — are *structurally untestable*.
2. **Coverage thresholds are vacuous.** v8 `all` is not enabled, so only loaded files are reported. The `src/features/**/hooks/**` 70% bar is propped up by a single file; the other four never appear in the report.
3. **MSW mocks 5 of 76 public API methods.** Three handlers (`/approvals`, `/finance`, `/analytics`) target endpoints that **do not exist** in `lib/api.ts` — aspirational mocks from an earlier API shape. The `/faculty` handler returns `{faculty: [...]}` but the real contract is a bare array.
4. **`vitest.setup.ts` makes auth untestable:** the `localStorage` stub returns a value only for `auth_token`, so `refresh_token` always reads `null` and `AuthContext`'s refresh path would immediately log out.
5. **Stale setup code:** mocks `next-auth/react` (not a dependency) and stubs `HTMLCanvasElement.getContext` (no charting library installed).

**Stale artifacts:** `frontend/coverage/` is committed to the repo, and `tsconfig.tsbuildinfo` sits at the frontend root.

---

## 8. Recommendations

### Immediate — low risk, high value

1. **Define the 8 missing CSS variables** in `app/globals.css` (add a `:root` alias block mapping `--text-main`/`--text-muted`/`--text-dim`/`--border-subtle`/`--primary`/`--emerald`/`--amber`/`--accent-primary` to their `--color-*` equivalents). Single change, restores the design of every major screen.
2. **Mount `QueryProvider`** in `app/layout.tsx` — otherwise the dependency is a trap for the next contributor.
3. **Add `app/**` to `vitest.config.ts` `include`** and remove the committed `coverage/` + `tsconfig.tsbuildinfo` artifacts.
4. **Unify the alias config** so `vitest.config.ts` matches `tsconfig.json` semantics (add `@/context`, `@/app`, `@/hooks`).

### Short term — resolve the fork in the road

5. **Decide the `src/` question explicitly.** Either (a) delete `src/` and remove `"./src/*"` from `tsconfig.json:23` — zero live breakage, removes the alias landmine and ~1,500 dead lines; or (b) commit to finishing the migration, which requires mounting the provider, reconciling the duplicate types, and rewriting the four mega-components. **Leaving it as-is is the only bad option** — the dual-root alias will eventually misroute imports silently.
6. **Delete the dead error/toast islands or promote them.** If promoting `lib/ErrorBoundary.tsx`, first remove its `useToast()` call (`:95`) or mount `lib/toast.tsx`'s `ToastProvider` — otherwise the boundary crashes inside its own fallback. Then make `lib/api.ts` throw typed errors from `lib/errors.ts` so the taxonomy actually functions.
7. **Replace the 18 `alert()` calls** with the toast system, including the success-path `alert` at `app/admin/page.tsx:389`.

### Medium term — structural

8. **Add real route protection** via `middleware.ts` and enforce authorization in the data layer, not just in render logic. Fix or remove the dead `role === "finance"` branch at `app/page.tsx:496`.
9. **Adopt TanStack Query in the live app** (or remove the dependency) to get caching, dedupe, and cancellation — the provider already exists.
10. **Break up `BatchDetailDrawer.tsx`** (3,687 lines / 76 state hooks) into 5–6 components; extract a shared pagination hook (one already exists, unused) to collapse the 16 hand-rolled page/pageSize pairs.
11. **Add request-generation guards or `AbortController`** to the effect-based fetchers to close the race conditions.

### Explicitly out of scope for this report

Backend API design, database schema, deployment/CI, and the domain model were not assessed.

---

## 9. Open Questions

1. **Is `src/` meant to be finished, or discarded?** This is the single decision that unblocks the most work. Deletion is mechanical; completion is a multi-file rewrite of the four largest components.
2. **Should `next.config.js`'s rewrite be made to work** (relative `/api/v1/*` URLs to proxy through Next, removing the CORS dependency), or is direct cross-origin access to FastAPI intentional?
3. **Is the two-tier `components/forms/` + shim structure intentional** as a migration seam, or leftover? It currently creates a latent barrel cycle.
