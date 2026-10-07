# Quality Checkpoints — Average Feedback (Gate 1) and NPS Closure (Gate 2)

## Context

Two tables describe a batch's sessions, and the current code conflates them:

| Table | Meaning | Key columns |
| --- | --- | --- |
| `training_sessions` | **Planned** curriculum day | `batch_id`, `status` |
| `faculty_utilization` | **Actual** delivery ledger row ("faculty utilisation") | `batch_id`, `training_session_id`, `status`, `feedback_rating` |
| `batches` | Batch header | `batch_avg_feedback`, `batch_nps`, `nps_*`, `retrospective_notes` |

`FacultyUtilization.status` **defaults to `"Completed"`** (`models/session.py:67`), so today a coordinator can log a delivery with no rating and the planned day still flips to `Completed`, silently opening the average over a subset.

## Decisions

### Gate 1 — average feedback
1. **Write fires when all three hold:**
   - every non-cancelled `training_sessions` row has ≥1 linked `faculty_utilization` row (coverage);
   - every linked ledger row is terminal: `Completed`, `Cancelled`, or `Not Conducted`;
   - at least one `Completed` row carries a rating in 1.00–5.00.
2. **Mean is over rated rows only.** Example: 5 sessions conducted, ratings 4 and 5 → `4.5`. Unrated `Completed` rows and `Cancelled` / `Not Conducted` rows are excluded from the mean and never block.
3. **Terminal set unified** to `{Completed, Cancelled, Not Conducted}` — matches what Gate 2 already enforces (`gates/service.py:15`, `sessions/service.py:22`). Fixes the current bug where one `Not Conducted` day blocks the average forever (`lifecycle_service.py:75` excludes only `Cancelled`).
4. **Write once.** `batch_avg_feedback IS NULL` is the sentinel; a written value is never recalculated, cleared, or overwritten. No flag column.
5. **Gate 1 is complete exactly when `batch_avg_feedback` is non-NULL**, and that is the signal that opens Gate 2.

### Gate 2 — NPS closure
6. **Blocked until Gate 1 is complete.** `batch.batch_avg_feedback is None` → `409`. Sequenced only; Gate 2 never reads or writes `batch_avg_feedback`.
7. **Three inputs only:** `promoters_count`, `passive_count`, `detractors_count`. The average-feedback input and the retrospective-notes textarea are removed, and the workbook upload panel is removed.
8. **NPS is computed server-side**, never client-supplied:
   `total = promoters + passives + detractors`; reject `total == 0`; `nps = round(((promoters - detractors) / total) * 100, 2)`.
   Worked example: 110/50/40 of 200 → 55% − 20% = **+35**.
9. **Delete the workbook import endpoint and parser entirely.**

## Database audit (answering "check the db to store these things")

Everything Gate 2 needs **already exists**:

| Column | Model | `init_db.py` DDL | Status |
| --- | --- | --- | --- |
| `batch_nps` `NUMERIC(6,2)` | `models/batch.py:78` | `db/init_db.py:60` | ok — range −100..100 fits |
| `nps_total_responses` `INTEGER` | `:79` | `:61` | ok |
| `nps_promoters` `INTEGER` | `:80` | `:62` | ok |
| `nps_passives` `INTEGER` | `:81` | `:63` | ok |
| `nps_detractors` `INTEGER` | `:82` | `:64` | ok |

No new column is needed. Three problems found while checking:

- **`batches.retrospective_notes` does not exist.** Not on the `Batch` model and not in the `init_db.py` map, so `batch.retrospective_notes = ...` at `gates/service.py:145` is silently discarded and the UI at `BatchDetailDrawer.tsx:2472` never renders. It is being dropped in this work, so nothing needs adding.
- **`batches.total_feedback_score` is a dead column.** Not declared on the model, read by no application code, populated only by the one-off 0001 import migration. Dropped.
- **The three counts are currently always written as `0`.** `BatchDetailDrawer.tsx:1044` sends only `nps_score`, `average_feedback_score`, `retrospective_notes`; the schema defaults all counts to 0 (`schemas/feedback.py:33-35`).

## Tasks

### 1. Unify the terminal-status constant
Add `TERMINAL_UTILIZATION_STATUSES = {"Completed", "Cancelled", "Not Conducted"}` in `backend/app/models/session.py`; import it in `sessions/service.py` (replacing `_TERMINAL_STATUSES`), `gates/service.py` (replacing `_TERMINAL_SESSION_STATUSES`), and `batches/lifecycle_service.py`.

### 2. Gate 1 — repository additions
`batches/repository_interfaces.py` + `batches/lifecycle_repository.py`:
- `list_utilizations_for_batch(batch_id) -> List[FacultyUtilization]` — every ledger row.
- `list_batches_missing_avg_feedback()` — `Batch.batch_avg_feedback.is_(None)`, used by the sweep.
- Keep `list_completed_feedback_ratings`; document that it includes ledger rows with no linked planned day (they are real deliveries).

### 3. Gate 1 — rewrite the calculation
Replace `BatchLifecycleService.calculate_batch_avg_feedback` (`lifecycle_service.py:66-92`):

```
batch = repo.get_batch_by_id(batch_id)
if not batch or batch.batch_avg_feedback is not None: return None   # write-once guard
planned = repo.list_non_cancelled_training_sessions(batch_id)      # excludes Cancelled
if not planned: return None
ledger  = repo.list_utilizations_for_batch(batch_id)
linked  = {u.training_session_id for u in ledger if u.training_session_id}
if any(s.id not in linked for s in planned): return None           # coverage gap
if any(u.status not in TERMINAL_UTILIZATION_STATUSES for u in ledger): return None
ratings = [u.feedback_rating for u in ledger
           if u.status == "Completed" and u.feedback_rating is not None]
if not ratings: return None
avg = Decimal(str(round(sum(ratings) / len(ratings), 2)))
batch.batch_avg_feedback = avg; batch.updated_at = now; repo.commit()
return avg
```

`check_and_update_batch_feedback` stays the public entry point; its four call sites (`sessions/service.py:220,275,308`, `gates/service.py:90`) are unchanged.

### 4. Gate 1 — remove the silent no-op and widen the sweep
- `lifecycle_service.py:56-59` assigns `session.feedback_rating` / `session.feedback_notes` on `TrainingSession`, which declares neither column. Delete both blocks.
- `sync_all()` (`:105`) iterates only `Pending for Closure` batches. Switch to `list_batches_missing_avg_feedback()` so a batch that finishes while `Ongoing` is still evaluated by the nightly job (`core/scheduler.py:16`) and by `POST /batches/{id}/sync-status`.

### 5. Gate 2 — payload
`backend/app/schemas/feedback.py`: reduce `BatchNpsClosureCreate` to
`promoters_count`, `passive_count`, `detractors_count` (`int`, `ge=0`). Delete
`nps_score`, `total_responses`, `average_feedback_score`, `retrospective_notes`, `client_feedback`.
Delete the now-unreferenced `BatchNpsClosureResponse` and `BatchFeedbackImportResponse`, and clean their re-exports in `schemas/__init__.py` and `gates/response.py`.

### 6. Gate 2 — service logic
`backend/app/api/v1/gates/service.py::close_batch_gate2` (`:105-153`):
- keep the 404 and the "already Completed" 400;
- **new** `409` when `batch.batch_avg_feedback is None`, detail `"Quality Checkpoint 1 must be completed before batch closure"`;
- keep the existing terminal-session check (`:134`);
- `total = p + pa + d`; `422` when `total == 0`;
- `batch.batch_nps = Decimal(str(round(((p - d) / total) * 100, 2)))`;
- write `nps_total_responses`, `nps_promoters`, `nps_passives`, `nps_detractors`;
- delete the `batch_avg_feedback` assignment (`:143-144`) and the `retrospective_notes` assignment (`:145`);
- keep `status = "Completed"` and `is_schema_locked = True`.

`batches/service.py::close_gate2` (`:600`) needs no change — it delegates.

### 7. Gate 2 — notification
`batches/controller.py:266`: replace `score=f"NPS: {closure_in.nps_score}/10"` with the computed index, e.g. `score=f"NPS: {closed_batch.batch_nps:+.0f}"`. `EnterpriseDashboard.tsx:790` already plots NPS on a −100..100 axis, so this aligns the stored value with what the dashboard already assumes.

### 8. Delete the workbook import
- `POST /batches/{id}/feedback-import` (`batches/controller.py:274-284`).
- `BatchService.import_feedback_workbook` (`batches/service.py:657-750`).
- `BatchFeedbackImportResponse` (handled in task 5).
- Keep `validate_upload_file` and `ALLOWED_FEEDBACK_EXTENSIONS` — the timetable ingest still uses them.

### 9. Migration — drop `batches.total_feedback_score`
New `backend/alembic/versions/20261005_0005_drop_batches_total_feedback_score.py`, `down_revision = "20261005_0004"`. `upgrade()` guards on `sa.inspect(op.get_bind()).get_columns("batches")` and issues `DROP COLUMN`; `downgrade()` re-adds `NUMERIC(10, 2)`.

**Do not edit the 0001 import migration** — it runs before 0005 and must keep inserting into the column it created. Dump `SELECT batch_id, total_feedback_score FROM batches` before running; the values are not reconstructible because the rated-delivery count is not stored.

### 10. Frontend — Gate 2 panel
`frontend/components/BatchDetailDrawer.tsx`:
- delete the upload block (`:2402-2452`) and `handleImportFeedback` (`:1022-1035`), plus `feedbackFile` / `isImportingFeedback` / `feedbackImportMessage` state (`:753-755`);
- when `activeBatch.batch_avg_feedback == null`, replace the Execute button with a locked note: "Quality Checkpoint 1 must be completed first — the average batch feedback is written once every delivery is logged.";
- in the closed summary (`:2454-2480`) drop the retrospective block and show the three counts plus the computed NPS.

### 11. Frontend — Gate 2 modal
Replace `:2852-2896` with three integer inputs (`min="0"`, `step="1"`) using the user's wording:
- **Promoters** — "Loyal brand advocates who are likely to recommend your product or service. Votes from 9–10."
- **Passives** — "Satisfied but unenthusiastic customers who are vulnerable to competitive offerings. Votes from 7–8."
- **Detractors** — "Unhappy customers who can damage your brand and impede growth through negative word-of-mouth. Votes from 0–6."

Add a live preview line: `total`, each percentage, and `NPS = promoters% − detractors%`. Disable submit while `total === 0`.

State: delete `gate2Nps`, `gate2AvgFeedback`, `gate2RetroNotes` (`:748-750`); add `gate2Promoters`, `gate2Passives`, `gate2Detractors` (init `0`). Update `handleCloseBatchGate2` (`:1044-1048`) to send only the three counts.

### 12. Frontend — Checkpoint 1 panel
Replace `:2352-2374`. Drive the value branch off `activeBatch.batch_avg_feedback` (the backend is the authority) and delete the locally recomputed `allSessionsCompleted` / `completedSessions` (`:465-466`). Derive progress from `scheduledSessions` + `sessions` (already loaded, `:459-460`): `planned` = days not `Cancelled`, `logged` = days with `utilization_logged`, `closed` = days with a terminal status. Render:
- value present → the score, with "All N deliveries logged and closed";
- `logged < planned` → `"{logged} of {planned} deliveries logged · {planned - logged} session(s) still to log"`;
- `closed < planned` → `"All {planned} deliveries logged · {planned - closed} awaiting outcome"`;
- otherwise → `"No feedback submitted"`.

### 13. Frontend — types and validation
- `lib/api.ts:399` `BatchNpsClosurePayload` → the three counts only; delete `importBatchFeedback`; delete `total_feedback_score` (`:196`) and `retrospective_notes` (`:204`) from `Batch`.
- `lib/validation/schemas.ts:252` `gate2Schema` → three non-negative integers, dropping `nps_score` and `average_feedback_score`.

### 14. Schedule endpoint reports the real ledger status
`sessions/service.py:94` returns `"status": "Completed" if util else s.status`, which reports a day as Completed whenever any ledger row exists even if that row is `Scheduled`. Change to `util.status if util else s.status`. Without this the Checkpoint 1 counters lie. `utilization_logged` (`:97`) is already correct.

### 15. Tests
`backend/tests/v1/gates/test_feedback_calculation.py` — the existing four should still pass. Add:
- planned day with **no** ledger row → `None`, no write;
- `Not Conducted` planned day + ledger row → gate opens, mean from `Completed` rows only;
- `Completed` row with `feedback_rating = NULL` → does not block, excluded from the mean;
- all closed, zero rated rows → `None`, column stays `NULL`;
- **write-once**: after a value is written, correcting a rating or adding a rated delivery leaves it unchanged;
- 5 sessions with ratings 4 and 5 → `batch_avg_feedback == 4.5` (the worked example).

`backend/tests/v1/gates/test_gates.py`:
- rewrite `test_gate2_batch_nps_closure` — payload `{35, 3, 2}`, assert `batch_nps == 82.5`, `nps_total_responses == 40`, and that `batch_avg_feedback` is unchanged (the fixture batch already has `4.50`, `conftest.py:81`);
- new: `batch_avg_feedback = None` → `409`;
- new: all three counts zero → `422`;
- new: `/feedback-import` no longer exists.

Plus a migration test that `batches.total_feedback_score` is gone.

## Validation

```
cd backend && python -m pytest tests/v1/gates tests/v1/sessions tests/v1/batches -q
cd frontend && npm run lint && npm run build
alembic upgrade head     # confirm the drop is inspector-guarded and re-runnable
```

Manual walkthrough: batch with 5 planned days, log all 5 as `Completed` but rate only 2 → panel shows `4.5 / 5.0`, `batch_avg_feedback = 4.5`, Gate 2 button becomes active. Enter 110 / 50 / 40 → preview shows total 200, 55% / 25% / 20%, NPS `+35`; after close, `batches` holds `batch_nps=35.00`, `nps_total_responses=200`, the three counts, `status=Completed`, `is_schema_locked=true`, and `batch_avg_feedback` still `4.5`.

## Risks

- **A batch with zero ratings can never close.** The Gate 1 marker is the existence of `batch_avg_feedback`, and a fully logged batch with no rating leaves it `NULL`. This is the stated design; flag it to the business.
- **Mixed NPS scales in existing data.** Rows already closed hold 0–10 client scores while new closures store a −100..100 index. `EnterpriseDashboard.tsx:790` already plots the index scale, so existing rows render near zero. Needs a one-off backfill or a manual review pass — decide before release.
- **Dropping `total_feedback_score` is destructive** and its values are not reconstructible. Dump first.
- Previously in-flight batches may already hold values written by the old loose logic. The sweep only fills `NULL` batches, so no backfill script is needed and nothing is clobbered.
- `Not Conducted` now unblocks the average, so batches that previously showed "Awaiting all sessions" will start showing a score.

## Out of scope

- `analytics.count_pending_gate1` / `count_pending_gate2` — unchanged metrics.
- Hand-editing or re-opening `batch_avg_feedback`.
- Retrofitting `feedback_rating` / `feedback_notes` onto `training_sessions`.
- Recalculating existing `batch_nps` rows (see Risks).