# UI Improvement List — Non-Admin Pages

Audit of every non-admin surface in `frontend/` compared against the table standard already
implemented in `frontend/app/admin/page.tsx` + `frontend/components/admin/tabs/*`.

Every item carries a `file:line` reference. Nothing here is speculative; each line was read.

---

## 1. Executive summary — the table gap

There are **6 admin tables** and **13 non-admin tables**. Every admin table has the full
toolbar. **Zero** non-admin tables have column show/hide, CSV export, a sticky header, or a
pinned first column.

Verified by grep — `ColumnsMenu`, `useColumnVisibility`, `ExportButton`, `TableMenu`,
`RefreshButton`, `stickyHeader` and `table-pin-first-col` appear **only** in
`components/admin/tabs/*`:

| # | Table | file:line | Cols | Cols menu | Sticky hdr | Pin 1st col | CSV export | Pagination | Empty | Loading | Error |
|---|-------|-----------|------|-----------|------------|-------------|------------|------------|-------|---------|-------|
| 1 | Pending Approvals | `app/page.tsx:906` | 6 | ❌ | ❌ | ❌ | ❌ | ✅ | td | ❌ | ❌ |
| 2 | Finance Review Sheet | `app/page.tsx:1199` | 21 | ❌ | ❌ | ❌ | ⚠️ bespoke XLSX | ✅ | td | ❌ | ❌ |
| 3 | Ongoing Batches | `dashboard/components/ActiveBatchesView.tsx:657` | 9 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 4 | Ongoing Sessions | `dashboard/components/ActiveBatchesView.tsx:863` | 8 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 5 | My Batches | `dashboard/components/MyBatchesView.tsx:529` | 9 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 6 | Faculty Utilization | `dashboard/components/FacultyUtilizationView.tsx:684` | 27 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ⚠️ shown as empty |
| 7 | Supervised Personnel | `components/ManagerBoard.tsx:910` | 6 | ❌ | ❌ | ❌ | ❌ | ❌ **none** | ✅ | ❌ | ❌ |
| 8 | Manager Workload Ledger | `components/EnterpriseDashboard.tsx:2181` | 9 | ❌ | ❌ | ❌ | ❌ | ✅ | td | ⚠️ page-level | ❌ |
| 9 | Coordinator Workload Ledger | `components/EnterpriseDashboard.tsx:2298` | 9 | ❌ | ❌ | ❌ | ❌ | ✅ | td | ⚠️ page-level | ❌ |
| 10 | Client Portfolio | `components/EnterpriseDashboard.tsx:2416` | 6 | ❌ | ❌ | ❌ | ❌ | ✅ | td | ⚠️ page-level | ❌ |
| 11 | Period Activity Feed | `components/EnterpriseDashboard.tsx:2599` | 9 | ❌ | ❌ | ❌ | ❌ | ✅ | **div outside table** | ⚠️ page-level | ❌ |
| 12 | Faculty Utilization & Delivery Ledger | `components/BatchDetailDrawer.tsx:2138` | 19 | ❌ | ❌ | ❌ | ❌ | ❌ **none** | td | ❌ | ❌ |
| 13 | Timetable Ingestion Preview | `components/BatchDetailDrawer.tsx:3212` | 5 | ❌ | ❌ | ❌ | ❌ | ❌ **none** | td | ❌ | ⚠️ |

Two tables have **no pagination at all** and render every row (#7, #12, #13). Two tables are
so wide that horizontal scrolling destroys the row identity (#2 at 2200px, #6 at 3200px), and
neither pins the first column.

---

## 2. Tables — bring every non-admin table up to the admin standard

### 2.1 Column show/hide (`ColumnsMenu` + `useColumnVisibility`) — highest value

The admin pattern is 4 constants + 1 hook:
`SORT_ACCESSORS` → `SORT_OPTIONS` → `FILTER_FIELDS` → `COLUMNS` → `useColumnVisibility` →
`<ColumnsMenu>` in the `actions` slot (`admin/tabs/UsersTab.tsx:29-66,117,294-299`).

Add the same to all 13 tables. Suggested `defaultHidden` per table so the first render is
readable, with everything one click away in the Columns menu:

**#6 Faculty Utilization — 27 columns, `minWidth: 3200`** (`FacultyUtilizationView.tsx:684`)
Worst case in the app. Suggested default-hidden: `id`, `trainingSessionId`, `programTypeId`,
`createdAt`, `updatedAt`, `feedbackSubmitted`, `outcomeAt`, `outcomeBy`, `startTime`,
`endTime`, `feedbackRating`, `outcomeReason`. Note the raw DB id columns (`ID`,
`Training Session ID`, `Program Type ID` at `:709-711`) should be hidden by default *and*
relocated behind a row-detail popover — they are not user-facing fields.

**#12 Delivery Ledger — 19 columns inside a 960px modal** (`BatchDetailDrawer.tsx:2138`)
Default-hidden: `seq`, `category`, `facultyVertical`, `program`, `venue`, `city`,
`moduleFeedback`, `coordinator`, `entity`. Also: `vertical` (col 4, `:2190`) and
`facultyVertical` (col 11, `:2212`) render the identical `s.vertical` value — collapse to one
column before adding a hide toggle.

**#2 Finance Review Sheet — 21 columns, `minWidth: 2200`** (`app/page.tsx:1199`)
Default-hidden: `category`, `technology`, `domain`, `mode`, `location`, `sowNumber`,
`approvalId`, `checkDate`, `remarks`, `trainingDays`. This alone makes the sheet usable
without horizontal scroll.

**#4 Ongoing Sessions** — default-hidden `delivery` (`:922`), `type` (`:874`).
**#5 My Batches** — default-hidden `schedule` (`:588`).
**#3 Ongoing Batches** — default-hidden `sessionsConducted` (`:716`).
**#1 Pending Approvals** — default-hidden `mode` (`:911`).
**#8/#9 Workload Ledgers** — default-hidden `enrollments`, `hours`.
**#10 Client Portfolio** — nothing to hide; still add the menu for consistency, or omit.
**#7 Supervised Personnel** — default-hidden `batchesHandled` (`:945`).
**#13 Timetable Preview** — 5 columns, no need for a menu.

Also add `defaultHidden` support to the admin tabs where none is passed today
(`useColumnVisibility.ts:5-9` already supports it; no admin tab uses it — e.g. `UsersTab`
has 7 columns and always shows all 7).

### 2.2 Persist the column choice

`useColumnVisibility` keeps state in `useState` only (`hooks/useColumnVisibility.ts:29`), so
every reload resets to the default. Persist per table key in `localStorage`
(`useColumnVisibility({ columns, defaultHidden, storageKey: "faculty-utilization" })`).
Persist page size too — `pageSize` is `useState` in `app/page.tsx:156-157`,
`ActiveBatchesView.tsx`, `MyBatchesView.tsx:358`, `FacultyUtilizationView.tsx:277`,
`ManagerBoard.tsx`, `UsersTab.tsx:103` and every other tab.

### 2.3 Sticky header + sticky `<thead>`

All 6 admin tabs pass `stickyHeader stickyTop={NAVBAR_HEIGHT}`
(`admin/ui.tsx:15` = 90, e.g. `UsersTab.tsx:238-239`). No non-admin table does, so on a long
table the toolbar, the primary action and every column heading scroll away.

Add `stickyHeader` to #1–#11 (`FullscreenTable.tsx:42-46` already supports it). For the two
tables inside `BatchDetailDrawer` (#12, #13) use `stickyThead` only — the drawer panel is
already fixed-height with its own scroll container, so pinning the whole panel would fight
`.modal-scroll-content` (`globals.css:309-330`).

### 2.4 Pin the first column (`table-pin-first-col`)

`globals.css:648-668` provides it; `UsersTab.tsx:361`, `TeamsTab.tsx:273`,
`RolesTab.tsx:318`, `TaxonomyTab.tsx:271`, `MappingsTab.tsx:268`, `FmsTab.tsx:264` all use it.
Add to every non-admin table with `minWidth` — #2 (2200px), #6 (3200px), #3, #4, #5
(1180px), #8, #9 (800px), #11 (700px). Without it, the Batch ID / Client identity scrolls off
screen and the user loses track of which row they are reading.

### 2.5 CSV export (`ExportButton`)

`ExportButton` + `lib/csv.ts` are unused outside admin. Add to all 13. Each table needs an
`EXPORT_COLUMNS: CsvColumn<T>[]` constant following `UsersTab.tsx:70-78`.

Note the export must be fed the **filtered** rows (`filtered`) as admin does, not the raw
rows. Two exceptions worth handling:
- **#2 Finance** already has a bespoke XLSX export (`app/page.tsx:663-676`, button at
  `:1180-1183`). Keep the XLSX for finance, but fix it: the current call does **not** forward
  the active sort, so the exported order differs from what is on screen.
- **#12 Delivery Ledger** is the highest-value export in the app (faculty timesheets) and
  currently has none.

### 2.6 `TableMenu` overflow for secondary row actions

`TableMenu` (`TableTools.tsx:48-108`) is the admin pattern for actions that should not take a
permanent button. Use it for:
- **#12** `BatchDetailDrawer.tsx:2256-2296` — 3–4 buttons crammed into every one of 19
  columns. Collapse to `TableMenu` (plus a primary action) exactly like `UsersTab.tsx:482-513`
  uses `RowActions`.
- **#2** `app/page.tsx:1318-1325` — per-row Save.
- **#1** `app/page.tsx:967-973` — per-row "View Full Batch Details".

### 2.7 Pagination where it is missing

- **#7 ManagerBoard** `ManagerBoard.tsx:910-1000` — renders every row, no
  `PaginationControls` at all, while the import list at `:10` pulls `FullscreenTable,
  SortableHeaderCell, TableFilters` only. Add page state + `footer={<PaginationControls/>}`.
- **#12 Delivery Ledger** `BatchDetailDrawer.tsx:2170` — renders every filtered row inside a
  960px modal. This is the worst offender: a batch with 60 sessions produces a 60-row,
  19-column scroll inside a modal.
- **#13 Timetable Preview** `BatchDetailDrawer.tsx:3230` — an Excel upload can produce
  hundreds of rows, all rendered.

### 2.8 `RefreshButton` + visible refresh state

`RefreshButton` (`TableTools.tsx:221`) is used only by `FmsTab` and `MappingsTab`. The
non-admin tables refresh silently — `BatchDetailDrawer.tsx:699,822,951,981,1007,1030,1157`
and `app/page.tsx:694`. Add `RefreshButton` to #1, #2, #6, #8–#11.

### 2.9 Standardise empty / loading / error states

Admin uses `EmptyState` (`admin/ui.tsx:157-178`), `LoadingState` (`:180`), `ErrorBanner`
(`:226`), all of which support an **action**. Non-admin tables use bare
`<td colSpan>N</td>` text with no "Clear filters" affordance:

- #1 `app/page.tsx:918-923`, #2 `:1226-1231`, #8 `:2198-2203`, #9 `:2315-2320`,
  #10 `:2439-2444`, #12 `BatchDetailDrawer.tsx:2163-2168`, #13 `:3223-3228`.
- **#11 is structurally broken**: `EnterpriseDashboard.tsx:2594-2598` renders a `<div>`
  *instead of* the `<table>` when empty, so the entire `<thead>` — and every sort control —
  disappears while the toolbar stays. Fix by keeping the `<table>` and using
  `<EmptyState>` inside a `colSpan` row, as the other five do.
- No table distinguishes "no data yet" from "your filters hid everything". Every one should.
- **#6** renders its error as an empty state:
  `FacultyUtilizationView.tsx:717-718` `error ? <EmptyRow message="Could not load…" />`. The
  other three views use a red `ErrorRow` (`ActiveBatchesView.tsx:180-191`). Error must never
  look like emptiness.
- **#7** has no loading state (the `isLoading` prop `:40,:111` only drives the Refresh
  spinner at `:502`) and no error state at all (`ManagerBoardProps` `:36-47` has no `error`).
- **#1, #2, #8–#12** have no loading state inside the table. #1/#2 also have none anywhere —
  `app/page.tsx:174` `isLoading` is never consulted in the approvals branch (`:825-983`) nor
  in finance (`:986-1335`).
- Loading rows are gated on `length === 0` (`MyBatchesView.tsx:602`,
  `ActiveBatchesView.tsx:737,935`), so refreshing over existing rows shows no loading
  affordance at all.
- **#12** has no error state for its data fetch: `loadSessions`
  `BatchDetailDrawer.tsx:831-846` swallows failures with `.catch(() => [])` (`:836-837`) and
  `console.error` (`:842`). A failed fetch renders as "No Sessions Scheduled Yet"
  (`:1909`). There are 9 other error states in the same file, so this is an omission, not a
  pattern.

### 2.10 Row click → batch detail

`MyBatchesView.tsx:268-270` is the only table where clicking a row opens the detail drawer.
Add it to #1, #3, #4, #8, #9, #10, #11 — the identity cell should be a link.

Fix the existing one while you are there: `MyBatchesView.tsx:268-270` `<tr onClick>` has no
`tabIndex`, no `role`, no `onKeyDown` → mouse-only. The per-row button at `:306-316` has no
`aria-label` naming the batch.

### 2.11 One column definition per table (kill the parallel lists)

Every table currently maintains 4–5 hand-synced lists. `BatchDetailDrawer.tsx` for the
ledger has **five**: `LEDGER_ACCESSORS` (`:97-117`), `LEDGER_FILTER_FIELDS` (`:121-140`),
`LEDGER_SORT_OPTIONS` (`:142-162`), the 19 `<th>` elements (`:2141-2159`), and
`LEDGER_COLUMNS = 19` (`:54`). `EnterpriseDashboard.tsx` invents a private `TableColumn<T>`
framework (`:662-668`) plus builders (`:670-702`) that `page.tsx` does not use.

Replace with one `COLUMNS` array carrying `{ key, label, accessor, sortable, align, csv }`,
and derive `SORT_ACCESSORS` / `SORT_OPTIONS` / `FILTER_FIELDS` / the `<thead>` from it — the
way `UsersTab.tsx:58-66` drives `ColumnsMenu`. This makes column show/hide, sort options,
filters and export impossible to desynchronise.

### 2.12 Fix sort/filter options that reference invisible columns

- **#1** `APPROVAL_SORT_OPTIONS` (`app/page.tsx:54-63`) offers 8 keys but only 5 are rendered
  columns. `program`, `domain`, `city` are rendered as *sub-labels inside* the Batch/Client/
  Mode cells (`:943,947,951`), so selecting them in "Sort by" reorders rows with zero visible
  feedback — no `aria-sort` target, no header highlight. The `domain` filter (`:871-879`) has
  the same problem: it filters on a column that is not in the header row.
- **#12** `LEDGER_SORT_OPTIONS` offers `status` "Session Status"
  (`BatchDetailDrawer.tsx:161`) and a Status filter exists (`:2117-2124`), but there is **no
  `status` column header** — status renders inside the Actions cell (`:2269-2296`).

### 2.13 Unify the cell/header metric

Three incompatible paddings coexist: `px-5 py-3.5` (`admin/ui.tsx:17`), `12px 14px`
(`ManagerBoard.tsx:976`, `FacultyUtilizationView.tsx:62`), `14px 16px`
(`ActiveBatchesView.tsx:282`, `MyBatchesView.tsx:272`, `app/page.tsx:936`).

`.glass-table thead th` (`globals.css:625-627`) forces `uppercase tracking-wider text-xs`
while `SortableHeaderCell` sets its own `fontSize`/`textTransform`
(`SortableHeaderCell.tsx:9-21`) and the caller `style` is spread **last** (`:76`) — so
headings end up half-styled depending on which constant wins. Pick one header style and one
cell style, export them from `components/admin/ui.tsx` (or move them to
`components/table/`), and delete the 5 local shadows: `WORKLOAD_TH_STYLE`
(`EnterpriseDashboard.tsx:704`), `ACTIVITY_FEED_TH_STYLE` (`:772`),
`ACTIVITY_NUMERIC_TH_STYLE` (`:775`), `FINANCE_TH_STYLE` (`app/page.tsx:114`),
`APPROVAL_TH_STYLE` (`:117`), `LEDGER_TH_STYLE` / `LEDGER_CENTERED_TH_STYLE` /
`TIMETABLE_TH_STYLE` (`BatchDetailDrawer.tsx:41,48,50`), `TH_STYLE` / `NUMERIC_TH_STYLE`
(`FacultyUtilizationView.tsx:56,59`), `TABLE_TH_STYLE`
(`ActiveBatchesView.tsx:244`), `BATCH_TH_STYLE` (`MyBatchesView.tsx:231`).

Also: `FacultyUtilizationView.tsx:72-82` sets `BE_FILTER_STYLE.height = 34` while
`TableFilters.CONTROL_HEIGHT = 36` (`TableFilters.tsx:13`) — the comment at `:70-71` claims
the bespoke box "must match the shared controls' box exactly". It does not.

### 2.14 Add `glass-table` where it is missing

`BatchDetailDrawer.tsx:2138` and `:3212` render `<table>` with inline styles and **no
`glass-table` class**, so they get no `thead` styling and no `tbody tr:hover td` row hover
(`globals.css:625-635`).

### 2.15 Fix the column-count magic numbers

`LEDGER_COLUMNS = 19` / `TIMETABLE_COLUMNS = 5` (`BatchDetailDrawer.tsx:54-55`),
`COLUMN_COUNT = 27` (`FacultyUtilizationView.tsx:84`),
`BATCH_COLUMN_COUNT = 9` / `SESSION_COLUMN_COUNT = 8`
(`ActiveBatchesView.tsx:13-14`). Derive from the `COLUMNS` array (see 2.11) so a column
change cannot leave `colSpan` wrong.

---

## 3. Shared components & design system

### 3.1 Fix the `TableFilters` `bespoke` label bug

`TableFilters.tsx:262` calls `<Field label={entry.label} width={entry.width}>` with **no
`htmlFor`**, so the rendered `<label>` (`:126`) has no `for` attribute and clicking it does
nothing. Consequences:
- `FacultyUtilizationView.tsx:568-584` — the Feedback `<select>` has **no accessible name**.
  The two date inputs hide the bug by adding explicit `aria-label` (`:595`, `:611`); the
  select does not.
- `app/page.tsx:1109-1126` — the Workflow `<select>` has neither `title` nor `aria-label`.

Fix: give `TableFilterBespokeConfig` an `id` and pass it through to `Field htmlFor`, or have
`Field` fall back to wrapping the control.

### 3.2 Introduce a `<DataTable>` shell so this stops recurring

The admin pattern is copy-pasted across 6 tabs and the divergence is now 13 tables deep.
Extract one component that owns: `FullscreenTable` wiring (`stickyHeader`, `stickyTop`,
`panelClassName`, `title`), the `COLUMNS`-driven `<thead>`, `TableFilters` + `ColumnsMenu` +
`ExportButton` + `RefreshButton` + `TableMenu` in `actions`, `PaginationControls` in `footer`,
`glass-table table-pin-first-col`, and the empty/loading/error branches. Each table then
declares only its `COLUMNS` array + row type + CSV map.

### 3.3 `globals.css` — ~50 dead class definitions

Verified zero `.tsx` consumers: `glass-panel-sm`, `glass-panel-lg`, `panel-padding*`,
`section-gap`, `card-gap`, `decision-btn`, `decision-btn-active`, `info-card`, `details-grid`,
`status-badge`, `form-field*` (4), `label`, `label-required`, `input-disabled`, `icon-*` (4),
`page-header`, `page-title`, `page-subtitle`, `btn-outline`, `btn-ghost`, `btn-icon-*` (3),
`btn-group`, `spinner-*`, `focus-ring`, `focus-visible-ring`, `text-balance`,
`transition-smooth`, `transition-fast-smooth`, `animate-pulse`, `animate-scale-up`,
`animate-slide-in-*`, `user-avatar`, `workspace-emblem`, `search-wrapper*`, `nav-btn*`,
`user-menu-btn`, `dropdown-popover*`, `container-responsive`, `section`.

The irony: `ApproveBatchModal` inlines `.decision-btn`, `.info-card`, `.details-grid` and
`.status-badge` — and all four already exist in `globals.css` and are unused.

Unused design tokens: `--space-*` (6), `--shadow-*` (6), `--transition-*` (3),
`--primary-strong`, `--emerald`, `--amber`, and every tint token —
`--color-primary-hover`, `--color-primary-light`, `--color-destructive-light`,
`--color-success-light`, `--color-warning-light`, `--color-info-light`. Those six tints are
exactly the slots the views replaced with literals (`#e8f2fb`, `#fef3c7`, `#fee2e2`,
`#dcfce7`, `#fef2f2`). Either wire them up or delete them.

Also: `--font-display` (`globals.css:8`) is a byte-identical copy of `--font-sans` (`:6`), so
`fontFamily:"var(--font-display)"` (`ActiveBatchesView.tsx:125`, `MyBatchesView.tsx:133`) is
a no-op.

### 3.4 Fix the broken `--destructive` reference

`globals.css:502-505` `.label-required::after { color: hsl(var(--destructive)) }` — the token
is `--color-destructive` (`:26`), and the `hsl()` wrapper is wrong for a bare HSL triplet. The
required-field asterisk silently inherits colour instead of rendering destructive.

### 3.5 Collapse three badge systems into one

- `components/ui/badge.tsx` (Radix-free, variant-based)
- `admin/ui.tsx:273` `StatusPill`
- `globals.css:179-205` `.badge-*` (raw `amber-50`/`green-50`/`emerald-50` + 200-weight
  borders, outside the token set)

Plus **three triplicated hex status→colour maps** that disagree with each other:
`ActiveBatchesView.tsx:46-56`, `MyBatchesView.tsx:29-39`, `FacultyUtilizationView.tsx:120-128`
(`#d97706` vs `#b45309` for the same branch; `FacultyUtilizationView` has no `requested`
branch at all). Plus `EnterpriseDashboard.tsx:221-231` `STATUS_COLORS` and
`BatchDetailDrawer.tsx:920-929` `getStatusColor` (dead — never called).

Consolidate on one `StatusPill` driven by a single tone map. Note `.badge` applies
`uppercase tracking-wider` while `StatusPill` deliberately opts out with `normal-case
tracking-normal` (`admin/ui.tsx:275`) — the same status text renders differently depending on
which class is used.

### 3.6 Collapse three button systems into `Button`

`page.tsx` mixes legacy `.btn .btn-primary` (`:969,1172,1180,1321`), the shared `Button`, and
Tailwind-styled raw `<button>`s (`EnterpriseDashboard.tsx:1338,1530,1746,1762`).
`page.tsx` and `EnterpriseDashboard.tsx` never import `Button` at all.

Four different sizes for the same class of panel-level button in `page.tsx`:
`padding:"5px 10px", fontSize:"0.775rem"` (`:970`) vs `5px 12px / 0.75rem` (`:1322`) vs
`8px 11px / 0.8rem` (`:1173`) vs `8px 11px` (`:1180`).

Also three different `glass-panel` paddings for sibling panels: `"22px 24px"`
(`EnterpriseDashboard.tsx:1421,1985,1996,2077`), `"24px"` (`:1519,1737`), `"18px 20px"` /
`"16px 18px"` (`:2466,2476,2486,2498`).

### 3.7 Replace hardcoded hex with tokens

`#0b5cab` is the de-facto primary used in ~25 places, but `--color-primary` is
`hsl(214 88% 27%)` (`globals.css:16`) — a **different** value. Sites:
`SortableHeaderCell.tsx:7` (`ACCENT`), `ManagerBoard.tsx:334,355,379,383,614,697,725,741,787,792,840,990`,
`ActiveBatchesView.tsx:170,189,193`, `MyBatchesView.tsx:189`, `FacultyUtilizationView.tsx:178`,
`ErrorBoundary.tsx:114,123`.

`#f8fafc` appears 3× as "the page background" (`page.tsx:743`, `ErrorBoundary.tsx:48`,
`BatchDetailDrawer.tsx:2140,3214`) and `FullscreenTable.tsx:74` uses a **4th** value
`#f8fbff`. The token is `hsl(220 33% 98%)`.

Also: `app/page.tsx:743` inline `background:"#f8fafc"` **overrides** `.dashboard-shell`
(`globals.css:621-623`), making the theme token dead on this page. `BatchDetailDrawer.tsx`
has **210** hex literal occurrences and overrides `.glass-panel`'s gradient with
`background:"#ffffff"` at 20 sites (`:1394,1444,1453,1462,1482,1535,1550,1599,1682,1946,2067,2615,2744,2784,2888,2990,3180,3300,3582,3783`).
`ManagerBoard.tsx` has 75.

Two parallel naming systems for the same colours (`--text-main` vs `--color-foreground`),
mixed freely inside single components. And `var(--accent-primary)` (`app/page.tsx:1247`) is a
third spelling of the primary.

### 3.8 Delete the duplicate exports in `components/table/index.ts`

`Components/ApproveBatchModal.tsx` and `components/ChangePasswordModal.tsx` are 2-line
re-export shims for the real components in `components/forms/*`. Import the real paths.

### 3.9 `TableFilters` — replace inline styles with tokens

`TableFilters.tsx:16-55` is entirely inline style objects while the same file's siblings use
Tailwind (`TableTools.tsx:31`). `TableFilters` `selects`/`sort` render raw `<select>`
elements while `components/ui/select.tsx` is a full Radix Select that nothing uses.

---

## 4. Per-page improvements

### 4.1 Login — `app/login/page.tsx`

- Uses raw inline styles + `glass-panel`, while the rest of the app moved to `Button`,
  `Input`, `Label`. Migrate to the shared primitives (`:86-135`).
- Labels at `:76` and `:98` have **no `htmlFor`** and no `id` on the inputs (`:81,103`) —
  clicking the label does nothing.
- `error` message at `:68-70` has no `role="alert"` / `aria-live`.
- No `<h1>` → the page `<title>` is whatever `app/layout.tsx` sets; no page-specific metadata.
- `:20-22` uses `window.location.href = targetRoute` — full page reload instead of
  `router.push`, discarding the already-loaded auth context.
- `catch (err: any)` (`:36`) — untyped.
- No "forgot password" / contact-admin affordance, and no hint that the account must be
  provisioned by an admin.
- Button is `.btn btn-primary` (`:131`) — the only button system on the page.
- Decorative blurred circles (`:47-48`) have no `aria-hidden`.

### 4.2 Navbar — `components/Navbar.tsx`

- Entirely inline styles (`:22-165`) with hardcoded `rgba(160,190,223,0.7)`,
  `rgba(255,255,255,0.8)`, `#e8f2fb`, `#bae6fd`, `#0b5cab`, `#f7f9fb`, `linear-gradient(135deg,#0b5cab,#0d74c8)`.
  The gradient is the app logo and it is **not** tokenised — the login page hardcodes the same
  pair again (`app/login/page.tsx:54`).
- `24px` vertical padding (`:29`) makes the header **90px tall** — the largest single UI
  element on the page for a 42px logo. `admin/ui.tsx:15` hardcodes `NAVBAR_HEIGHT = 90` to
  compensate. Reduce and re-derive the constant from a CSS variable so the two cannot drift.
- Logout button (`:137-163`) is icon-only with `title="Logout"` only — no `aria-label`. It
  also uses `onMouseOver`/`onMouseOut` DOM mutation (`:153-160`), so it has **no
  `:focus-visible` state** and does not respond to keyboard focus at all.
- No `aria-current="page"` on the Admin link (`:86-88`); active state is colour-only.
- `onOpenCreateModal` prop (`:10`) is declared and never used.
- User pill shows only `full_name.split(" ")[0]` (`:128`) — no way to see the full name.
- No mobile menu; the brand + admin link + user pill + logout will collide below ~640px.

### 4.3 Sidebar — `components/Sidebar.tsx`

- **Collapsed-state ARIA bug**: `:214` reports `aria-expanded={isWorkspaceMenuOpen}` but the
  popover is gated on `!isCollapsed` (`:246`). A collapsed sidebar reports
  `aria-expanded="true"` while rendering nothing, and "Admin & Governance" (`:259-275`)
  becomes **unreachable** at collapsed widths with no alternative trigger.
- `:213-214` `aria-haspopup="true"` should be `"menu"`, and there is no `aria-controls`.
- `:249` `role="menu"` has invalid children: a heading div (`:251-253`), a static info row
  (`:254-257`), then one `role="menuitem"` (`:270`).
- `<nav>` (`:302-350`) contains buttons directly — no `<ul>`/`<li>` list semantics.
- `:186` `<aside>` has no `id` and no `aria-label`; the mobile trigger (`:429-438`) has no
  `aria-controls`.
- **View switching is not routing.** `:319` `setActiveView(item.id as any)`; `activeView` is
  React state only (`app/page.tsx:139`). Refresh loses the view, browser Back does nothing,
  no view is linkable. `usePathname` is imported at `:44` and **never used**.
  This is the single biggest structural UX gap on the non-admin side.
- Two sources of truth for the same breakpoint: JS `useIsMobile` = `max-width:768px`,
  `useIsTablet` = `max-width:1024px` (`hooks/useMediaQuery.ts:22,26`) vs Tailwind `lg:`
  (1024px) at `:179,432`.
- **Hydration flash**: `useMediaQuery.ts:6` starts at `false` then syncs in an effect
  (`:8-16`); `Sidebar.tsx:46-47,172,186-199` derives the whole layout from it → the desktop
  sidebar paints on a 375px viewport first. Use `useSyncExternalStore`.
- `:55` `sidebarRef` created, never attached. `:172` `sidebarWidth` — the `isMobile ? 0` branch
  is unreachable because `:198` overrides with `isMobile ? 288 : …`. `:190,195` Tailwind
  `w-72`/`w-20`/`w-64` are dead because `:197-199` sets inline `style.width`.
- Keyboard shortcuts `:81-107` (Ctrl/Cmd+2/3/4/5) have **no visible hint**, no
  `aria-keyshortcuts`, no `title`; `Ctrl+4`/`Ctrl+5` are OS-reserved on Windows/Linux; and
  `Ctrl+2` (`:84-86`) calls `setActiveView("my_batches")` unconditionally, bypassing the
  `canSeeMyBatches` gate at `:66`.
- Dead imports: `Settings`, `HelpCircle`, `ChevronsUpDown`, `ExternalLink`, `Sparkles`
  (`:7-9`).
- `onFilterCategory` / `activeCategoryFilter` are passed from `app/page.tsx:752-753`,
  declared (`Sidebar.tsx:30-31`), destructured (`:39-40`) and **never used** — so
  `categoryFilter` is always `"ALL"` and the `category` API param (`app/page.tsx:233`) is
  always `undefined`.

### 4.4 `app/page.tsx` — Approvals + Finance (the two inline tables)

- 71% of this 1391-line file is two hand-rolled tables (`:825-983` approvals, `:986-1335`
  finance). Extract both into `app/dashboard/components/` like the other four views.
- 21 of 27 icon imports are unused (`:26-30`): `Layers, Search, Filter, Plus, PlayCircle,
  Archive, Eye, Lock, Building2, MapPin, Sparkles, AlertTriangle, BarChart3, Download, Users,
  Briefcase, TrendingUp, PlusCircle, Calendar, ShieldCheck, Kanban`.
- Dead code: `handleSubmitBatch` (`:701-708`) and `getStatusBadgeColor` (`:724-733`) are
  defined and never called.
- **`fetchBatches` (`:236-238`) and `fetchAnalytics` (`:383-385`) swallow errors to
  `console.error`.** These are the only data sources for the analytics view and
  `EnterpriseDashboard` has no `error` prop (`:21-27`), so a failed load renders a
  fully-populated-looking dashboard of zeros with no indication anything broke.
- `FINANCE_FILTER_STYLE` (`:121-132`) duplicates `TableFilters.tsx:38-49` `CONTROL_STYLE`
  and **has already drifted**: `#fff` vs `var(--color-card)`, `var(--border-subtle)` vs
  `var(--color-input)`, missing `fontWeight`/`letterSpacing` parity.
- Finance KPI cards count over unfiltered `batches` (`:1009-1010`) while the badge beside the
  heading reads `filteredFinanceBatches.length of batches.length` (`:1003`) — "Pending Review"
  can exceed the visible row count with no explanation.
- **Unlabeled editable cells** in the finance table: Approval-ID `<input>` (`:1262-1278`),
  Finance-Status `<select>` (`:1282-1298`) and Check-Date `<input>` (`:1301-1313`) have only
  placeholders — no label, no `aria-label`, no `id`; their `<th>`s (`:1216,1218,1219`) carry
  no `id` and the cells declare no `headers`.
- `:1040` uses `<span>✏️</span>` as a KPI "icon" — an emoji, no `aria-hidden`, no text
  alternative.
- `minWidth:"2200px"` (`:1199`) with no `table-pin-first-col` → the Batch ID (the row's only
  identity) scrolls out of view.
- `:1271,1289,1309` repeat the same 6-property inline input style object three times;
  `:1247-1315` repeats `{padding:"12px 14px", userSelect:"text", cursor:"text"}` on all 21
  cells.
- The "Save All (n)" pseudo-bulk action (`:327-375`, button `:1169-1178`) writes every dirty
  row in the current filtered set with no row selection, no list of affected rows, and no
  count of rows vs count of fields.
- `:1008-1046` — a JSX IIFE computes two counts on every render over unfiltered `batches`.
  Should be a `useMemo`.
- `:273-287` rebuilds the whole `financeDrafts` record on every `batches` change; since
  `financeFilterFields` (`:535-543`) and `financeSortAccessors` (`:577-598`) both depend on
  it, **every keystroke in any editable finance cell invalidates all 4 filter accessors, all
  19 sort accessors, and re-collects every dropdown option.**
- `:690-699` reuses the "Initializing Operations Platform…" spinner as the admin redirect
  hold — a redirect and a data load share one visual state.

### 4.5 `ActiveBatchesView.tsx`

- Missing `ColumnsMenu`, `ExportButton`, `stickyHeader`, `table-pin-first-col`.
- No row click → detail (no `onOpenBatchDetail` prop at all, `:16-31`).
- Two different page-size ladders for two tables in the same view: `[10,25,50,100]` (`:651`)
  vs `[15,25,50,100]` (`:857`).
- **Two different totals for the same table in the same panel**: the header pill shows the
  *server* `total_batches` (`:643`) while `PaginationControls` shows the *filtered* count
  (`:649`).
- "Sessions Today" uses `data.total_sessions` (server total, both types) (`:472,544-546`)
  while `hoursScheduled` (`:476-479`) sums **scheduled only** — two cards describing
  different populations with no disclosure.
- `:442-448` resets pages on `filtersVersion` only; changing `filterDate` (`:503-510`) does
  not reset `batchPage`/`sessionPage` → can land on an out-of-range page (recovered only by
  the clamp effect at `PaginationControls.tsx:41-43`).
- Progress bar (`:322-332`) is a plain `<div>`: no `role="progressbar"`,
  no `aria-valuenow/min/max`, colour-only encoding via `progressColor` (`:193-198`).
- `SESSION_ACCESSORS.batchName` (`:227`) is defined but consumed by no column and no sort
  option.
- `headerStyle={{padding:"20px 24px"}}` (`:491,570,761`) defeats the `FullscreenTable`
  default `14px 20px` (`FullscreenTable.tsx:49`); admin tabs do not override it.
- **Verbatim duplicated with `MyBatchesView.tsx`** (≈230 lines across the two files):
  `formatTime` (`:33-44` ≡ `FacultyUtilizationView.tsx:107-118`), `statusBadgeColor` +
  `StatusBadge` (`:46-76` ≡ `MyBatchesView.tsx:29-59`), `SummaryCard` (`:78-148` ≡
  `MyBatchesView.tsx:86-156`), `EmptyRow`/`LoadingRow`/`ErrorRow` (`:150-191` ≡
  `MyBatchesView.tsx:158-210`).

### 4.6 `MyBatchesView.tsx`

- Missing `ColumnsMenu`, `ExportButton`, `stickyHeader`, `table-pin-first-col`.
- `actions` slot not used at all (`:446-517`) — no panel-level tooling.
- Row click not keyboard reachable (see 2.10).
- Same duplication set as 4.5.
- `minWidth: 1180` (`:529`) with no `table-pin-first-col` → "Batch & Program" scrolls away.

### 4.7 `FacultyUtilizationView.tsx`

- 27 columns, `minWidth: 3200`, **no `ColumnsMenu`, no pinned first column, no sticky
  header**. Worst table in the app.
- **It does not use `useTableSort` / `useTableFilters` / `lib/tableUtils` at all.** It
  reimplements sort (`:350-410`), filter (`:295-333`), blank-sinking (`:391-394`), option
  collection (`:281-282`) and hand-rolls the search haystack (`:299-317`). Plus it needs a
  sentinel adapter `to/fromSharedFilterValue` (`:93-100`) that exists **only** because the
  shared hooks are bypassed. Every other table and the whole admin area uses the hooks.
- Its local comparator (`:396-404`) has **no ISO-date handling**, so dates compare as raw
  strings — unlike `compareTableValues` (`lib/tableUtils.ts:26-44`) which is ISO-aware. This
  is a correctness bug, not just duplication.
- Error rendered as an empty state (`:717-718`).
- 13 fixed-px toolbar controls in one row (8 selects `:533-564` + 3 bespoke `:585-616` +
  search + sort) — the toolbar will not wrap gracefully.
- `BE_FILTER_STYLE.height = 34` vs `TableFilters.CONTROL_HEIGHT = 36`.
- `SORT_OPTIONS` (`:37-54`) has **16** entries but the report says 17 sortable columns of 27 —
  and the `SortKey` union (`:12-28`) has **17** members while the `switch` (`:353-385`) has
  **no `default` case**, so TypeScript cannot prove exhaustiveness and a new key silently
  falls into the `created_at` branch.
- 13 `useState` filter/sort/page values (`:261-278`) — exactly what the shared hooks exist to
  encapsulate.
- **No test file.** `MyBatchesView.test.tsx` and `ActiveBatchesView.test.tsx` exist; nothing
  guards the 27-column header/body 1:1 alignment (`:687-713` vs `:199-253`).
- Hand-built footer bar (`:639-641`, `padding:"10px 16px"`, `borderTop:"1px solid #e2e8f0"`,
  `background:"#f8fafc"`) sits directly above `PaginationControls`
  (`PaginationControls.tsx:68` = `border-t border-border bg-muted/40 px-4 py-2.5`) — two
  different borders, backgrounds and paddings in one footer.
- `RefreshCw` (`:630`) and the loading icon (`:178`) are missing `aria-hidden`.

### 4.8 `ManagerBoard.tsx`

- Personnel table (`:910`) has **no `PaginationControls`** and no `FullscreenTable` `title`,
  `actions` or `footer` — the heading sits outside the panel (`:827-844`) and disappears in
  fullscreen.
- **No loading state and no error state** for the table (`isLoading` `:40,:111` only drives
  the Refresh spinner at `:502`; `ManagerBoardProps` `:36-47` has no `error`).
- `panelClassName=""` (`:862`) strips `glass-panel` while inline `border`/`borderRadius:10`/
  `background:"#ffffff"` (`:863`) re-add it by hand — and the outer `glass-panel padding:24`
  (`:827`) then nests a padding-0 `FullscreenTable` inside it. Double-panel.
- Missing `ColumnsMenu`, `ExportButton`, `stickyHeader`, `table-pin-first-col`.
- **Zero Tailwind responsive prefixes in the whole 1018-line file.** The kanban relies on
  `gridTemplateColumns: repeat(7, minmax(280px,1fr))` (`:512-514`) = 1960px of mandatory
  horizontal scroll, plus hardcoded viewport math `maxHeight:"calc(100vh - 280px)"` (`:531`)
  which collapses toward zero on a short viewport.
- **Kanban cards are mouse-only**: `:595-607` `<div onClick>` with no `role="button"`, no
  `tabIndex`, no `onKeyDown`. Same for the "View ›" affordance (`:741-743`). This is the
  primary drill-down on the page.
- `:460-470` domain `<select>` has **no `<label>`**.
- `:473-492` "Urgent Attention Only" toggle has **no `aria-pressed`**; `:314-363` view-mode
  button group has no `role="group"`, no `aria-label`, no `aria-pressed`.
- `:378-441` KPI ribbon is a bare `<div>` grid — no landmark, no heading, values not
  announced.
- 75 hex literals in this one file.
- `:854-859` panel empty state and `:964-972` `<tr colSpan=6>` empty state = two different
  designs for the same condition. Coordinator bar empty state is one line of text (`:1899` in
  `EnterpriseDashboard`) while the manager equivalent (`:1800-1817`) is a full illustrated
  card with a CTA.
- Dead imports: `Filter`, `Building2`, `Calendar`, `Sparkles`, `ExternalLink`
  (`:18,25,26,27,32`).
- Functional bugs: `:177` in-flight filter tests `batch_nps === null` while the NPS-closure
  filter two stages later correctly tests `=== null || === undefined` (`:192`) — a batch with
  `undefined` NPS matches **neither** stage and vanishes. `:432` "Urgent Manager Action"
  sums `l2Count + overdueCount`, but `overdueCount` (`:256-261`) includes Approval-2-Pending,
  so any batch pending >3 days is double-counted. `:240-243` duplicates the
  `daysPending`/`isOverdueApproval` rule from `:256-261`.

### 4.9 `EnterpriseDashboard.tsx` — 2651 lines

- 4 tables, all missing `ColumnsMenu`, `ExportButton`, `stickyHeader`, `table-pin-first-col`.
- `titleStyle={{marginBottom:0, whiteSpace:"normal"}}` is passed at `:2138`, `:2255`,
  `:2373`, `:2527` purely to undo the wrapper's own ellipsis truncation
  (`FullscreenTable.tsx:178-180`) — a symptom of the caption being hand-built
  (`SectionHeader` `:198-219`) instead of using `PanelTitle` (`admin/ui.tsx:45`).
- **`teamKpiData.sort()` mutates a memoised array**: `:1584-1586` calls `.sort()` in place on
  the memoised value from `:1223-1241`, permanently reordering it every render. (`:1704` is
  safe only because `.filter()` copies first.)
- **The workload bar charts and the ledger tables read different row sets.** Bars use
  `paginatedManagerWorkload` (`:1820`) / `paginatedCoordinatorWorkload` (`:1902`), sliced from
  **unsorted, unfiltered** `managerWorkload` (`:983-986`); tables use
  `paginatedManagerLedger` (`:2205`) / `paginatedCoordinatorLedger` (`:2322`), sliced from
  sorted+filtered rows (`:1040-1043`, `:1058-1061`). Typing in the ledger's search box changes
  the table but not the bars above it. Pagination totals diverge for the same reason (`:1888`
  vs `:2171`).
- `:903-909` forces `setWorkloadTab("managers")` whenever `managers.length > 0`, so any
  re-fetch of `users` bounces a coordinator-only manager off the Coordinators tab onto the
  "No Subordinate Managers" empty state (`:1799-1817`) they had already dismissed.
- `:100-125` `Trend` component + `KpiCard`'s `trend` prop (`:133,140,170`) — **no call site
  passes `trend`** (the 8 cards are `:1405-1412`). The whole trend feature is unreachable.
- `:789` `chartPage` is written at `:914` and never read; `:790` `chartPageSize` declared and
  never referenced.
- **The `ENTERPRISE_DASHBOARD` admin branch is unreachable**: `:799` `isOrgAdmin` plus the
  admin-only paths at `:826-829,888,1153,1183,1321,1326`. `app/page.tsx:221-223`
  `router.replace("/admin")` and `:690` early-return for admins, and `EnterpriseDashboard` is
  imported only by `page.tsx`. All "Executive View (All Teams)" UI is dead as wired.
- `:1162` `if (t.name.toLowerCase().includes("finance")) return false;` — a business rule
  hardcoded as a substring match inside a `useMemo`.
- Three near-identical hand-rolled tab groups with **three different
  `padding`/`borderRadius`/`background` sets for the same widget**: `:1333-1373`
  (`6px 13px`/7), `:1526-1550` (`6px 13px`/6), `:1745-1778` (`6px 14px`/6). None uses
  `TableFilters`' `children` full-width row (`TableFilters.tsx:283-295`), none has
  `role="tab"`/`aria-selected`/`aria-pressed`/`aria-controls`, none has roving `tabIndex`,
  and none declares `type="button"`.
- `KpiCard` draws its icon **twice** per card — a 52px watermark at `opacity:0.08`
  (`:156-158`) and a 14px chip (`:163-165`). The watermark is not `aria-hidden`.
- `SvgDonutChart` (`:236-305`), `SvgDeliveryTimeline` (`:310-411`), `SvgGroupedBar`
  (`:416-494`), `QualityBubble` (`:573-638`), `RingProgress` (`:176-196`), `TeamRoleDonut`
  (`:499-534`) render **pure SVG with no `role="img"`, no `aria-label`, no `<title>`/`<desc>`**.
  For `SvgGroupedBar` and `SvgDeliveryTimeline` the numbers exist **only** inside `<text>`
  nodes.
- `SvgDeliveryTimeline:338-339` hard-slices `.slice(-12)`, so the "historical and scheduled
  initiation rate" subtitle (`:1997`) silently truncates to 12 buckets.
- Silent truncation with no "+N more": `RankedBars maxItems = 8` (`:547`), tech `.slice(0,10)`
  (`:1641`), cities `maxItems = 6` (`:1692`), bubbles `.slice(0,12)` (`:1270`).
- `SvgGroupedBar:477` truncates labels with `slice(0,9) + "…"` inside SVG text, no tooltip.
- `:181` `SvgDeliveryTimeline` sets a **fixed `id="velocityGrad"`** on its `<linearGradient>`
  (`:369`). Two instances on one page would collide. Latent today, breaks the moment anyone
  renders it twice.
- Pagination accents hardcoded to two different colours: `#0b5cab` (`:1893,2176,2411,2589`)
  and `#06b6d4` (`:1975,2293`), while #1/#2 use the theme default — the same footer component
  renders two different accents depending on the page.
- `isBatchInPeriod` allocates 5 `Date` pairs per batch per render: `:80` calls `getPeriodRange`
  (`:45-76`, 2 `new Date`) inside `periodCounts` (`:923-926`, 4 passes) and
  `activeBatchesDataset` (`:933`).
- `subordinateUserIds` BFS is cubic: `:835-861` — `while (queue)` × `users.forEach` (`:837`)
  × `users.find` (`:840`), re-run on every `users` identity change (`:864`).
- `:249` `let accumulatedDash` is mutated inside `data.map` during render (`:260-261`) —
  correct only because the function resets each render; fragile and non-reentrant.
- `:1578-1590`, `:1665-1733` sit inside `gridTemplateColumns:"1fr 1fr"` whose children have
  no `minWidth:0`, so long team names force overflow.
- Four fixed 2-column grids with **no breakpoint escape**, all inline so Tailwind responsive
  prefixes cannot apply: `:1555`, `:1667` (`1fr 1fr`), `:2007`, `:2364` (`2fr 1fr`).
- Unused icon imports: `TrendingUp`, `ChevronDown`, `Zap`, `Filter`, `Check` (`:5,7,7,8,8`).
- `:221-231` `STATUS_COLORS` inline pill (`:2629-2641`) instead of the shared `Badge`;
  `page.tsx:710-722` `getStatusBadge` is a **third** status system.

### 4.10 `BatchDetailDrawer.tsx` — 4288 lines

- Both tables missing `ColumnsMenu`, `ExportButton`, `PaginationControls` (render every row),
  `RefreshButton`, `TableMenu`, `stickyThead`, `glass-table`, and any loading/error state.
  See the table at §1 #12/#13 and §2.
- **It is called a drawer but renders a centred modal**: `className="modal-overlay"`
  (`:1168` → `fixed inset-0 flex items-center justify-center`), `maxWidth: 960` (`:1180`).
  A 19-column table therefore lives in a 960px box and depends entirely on horizontal scroll.
- `maxHeight` conflict: panel inline `92vh` (`:1181`) vs `.modal-content { max-h-[90vh] }`
  (`globals.css:213`) vs body `.modal-scroll-content { max-height: calc(90vh - 200px) }`
  (`globals.css:310`). ~200px of dead space plus a nested scrollbar.
- **Escape does not close the drawer.** The only `keydown` listener in the file is `:593-603`,
  scoped to the utilization modal. Overlay click closes (`:1169`); Escape does not.
- **No dialog semantics**: `:1167-1191` has no `role="dialog"`, no `aria-modal`, no
  `aria-labelledby` pointing at the `<h2>` (`:1204`). **No focus trap, no focus restoration**
  in the drawer or in 7 of the 8 modals — only the utilization modal declares them
  (`:3776-3778`) and autofocuses (`:585`).
- **8 hand-rolled modal overlays** (`:2600,2742,2769,2873,2975,3285,3558,3748`), each
  re-declaring `position:fixed; inset:0; background:"rgba(15,23,42,0.6|0.65)";
  backdropFilter:"blur(4px)"; padding:16` — while Radix `Dialog` (`components/ui/dialog.tsx`,
  used by `AdminDialog` and `FormModal`) already provides focus trap, Escape and
  `aria-modal`. `.modal-overlay`/`.modal-content` in `globals.css:207-215` duplicate Radix
  with **no focus trap, no `role="dialog"`, no Escape**.
- **6 identical hand-rolled error banners** (`:2624-2638,2747,2793-2807,2897-2911,3028-3042,3319-3333`)
  using raw hex `#fef2f2/#fecaca/#f43f5e` instead of `ErrorBanner` (`admin/ui.tsx:226`).
- **5 identical hand-rolled pills** (`:2178-2189,2200-2211,2216-2227,2238-2249,2270-2281`).
- **Tab bar is not a tab bar**: `:1229` `flex gap-3 px-6 border-b` — no `role="tablist"`,
  no `role="tab"`, no `aria-selected`, no `aria-controls`, no arrow-key navigation, no
  `overflow-x-auto`/`flex-wrap`. Selected state is class-only (`:1239`).
- **Fullscreen inside the drawer is broken**: `scaleUp` animation (`:1189`) creates a
  transform containing block, which is why `strategy="absolute"` is needed (`:1282`); the
  absolute fullscreen panel (`:1283`) is positioned against `.modal-scroll-content`, which is
  **itself the scroll container** (`globals.css:309`), and `FullscreenTable` **skips
  body scroll-lock when `strategy !== "fixed"`** (`FullscreenTable.tsx:106`) → fullscreen
  inside the drawer leaves the outer page scrollable. Also the fullscreen panel is
  `zIndex: 100` (`FullscreenTable.tsx:135`) — the **lowest** of five z tiers in play (990 /
  100 / 1050 / 1060 / 1100), with no token.
- Overlay `padding:"16px"` (`:1172`) + panel `maxHeight: 92vh` (`:1181`) > 100vh on short
  viewports.
- **Sessions fetch has no error state at all** (see 2.9).
- **Mixed data sources for the same entity**: most of the file reads `activeBatch`
  (`= currentBatch || batch`, `:856`), but the quality-gates tab reads the raw `batch` prop at
  `:2346,2391,2443,2458,2465`, and handlers use `batch` directly at
  `:430,938,1058,1085,1114,1148,1150,832`. After an in-drawer mutation that only calls
  `setCurrentBatch` (`:383,440`), the Quality Checkpoints tab shows stale values.
- **`useEffect` at `:305-317` depends on `batch` object identity** and unconditionally calls
  `setActiveTab(initialTab)` (`:309`) + re-fetches (`:311`). Any parent re-render producing a
  new `batch` reference — including `onBatchUpdated()` at `:700,1158,952,982` — resets the
  user's tab selection.
- **81 `useState` hooks** (`:291-767`), 8 independent modal open flags with **no
  mutual-exclusion logic** (`:335,394,492,717,730,738,746,757`), 12 async handlers, all in one
  4000-line component.
- `parseRemarksList` (`:201-220`) is invoked **5 times per render** (`:1688,1697×2,1703,1718`),
  each running two regex passes + a lookbehind `split` — unmemoised on every keystroke in
  every open modal.
- `sessionVenue` (`:724`) and `sessionMode` (`:725`) are declared with setters but never read;
  `handleCreateSession` (`:938-946`) sends neither — dead state **and** a silent data gap in
  the Add Session modal.
- `getStatusColor` (`:920-929`) — dead, never called.
- 9 unused icon imports (`:18-19,21`): `MapPin`, `Monitor`, `FileText`, `Star`, `User`,
  `ShieldCheck`, `Briefcase`, `Info`, `Hash`.
- `vertical` (col 4, `:2190`) and `facultyVertical` (col 11, `:2212`) render the identical
  `s.vertical` — two duplicate columns.
- `resolveFacultyType()` (`:88-95`) is used for sort/filter (`:477`) but the rendered badge
  re-implements the same ternary inline at `:2228` — display value and sorted value computed
  by two separate expressions.
- Session scheduling form duplicated **3×** with different field sets: Add Session
  (`:2641-2737`), Edit Scheduled Session (`:2748-2763`), Log Utilization (`:3843-4223`).
- The **Curriculum Schedule** card list (`:1935-2051`) behaves like a table (Day / Module /
  Date / Time / Hours / Trainer in one `<span>` at `:1976`) with no search, sort, filter,
  row count or empty state.
- Tab badge at `:1263` shows `sessions.length` (utilization rows) while the body leads with
  `scheduledSessions` (schedule days) — labelled "Sessions & Timetable" with no distinction.
- Section captions are `<div>`/`<span>` (`:1921,2060,3123`), never headings. Document outline
  is flat.
- Close buttons with no accessible name: `:3022`, `:3310`, `:3615`; their `<X>` icons
  (`:3023,3314,3623`) have no `aria-hidden`.
- File inputs are `display:"none"` (`:2426,3103`) with no `:focus-visible` affordance.
- 210 hex literals; 20 sites override `.glass-panel`'s gradient with `background:"#ffffff"`.
- Hardcoded px grids with zero breakpoints: `:1443` (`1fr 1fr 1fr`), `:1486`
  (`repeat(4,1fr)`), `:1533`, `:1603`, `:1647`, `:2657`, `:2750`, `:3336`, `:3929`
  (`1.4fr 1fr 1fr`), `:4191` (`200px 1fr`). The only responsive value in the file is
  `:3870`.
- `payload: any` at `:372` and `:672` — untyped write payloads on the two highest-risk
  mutations.
- `if (!activeBatch) return null;` (`:857`) is an unreachable second check (TS already
  narrowed `batch` at `:854`).

### 4.11 `CreateBatchModal.tsx`

Fully on the shared stack — this is the model the others should follow. Remaining issues:
- **No initial focus target.** `FormModal.tsx:105` renders Cancel first, so focus lands on
  Cancel rather than `batch_id`.
- `PreFlightSummary` calls **`form.watch()` with no field list** (`:323`) → subscribes the
  entire form; every keystroke re-renders the whole `size="full"` `max-w-4xl` modal including
  `PreFlightSummary` (103 lines of JSX). `ScheduleFields` adds three more (`:250-252`).
- Options load failure is swallowed to `console.error` (`:52`) — **no visible error, no
  loading state, no disabled state**. The user sees empty `SelectField` dropdowns that then
  fail validation with "Required".
- Hardcoded raw Tailwind palette outside the token set: `border-green-500` (`:363`),
  `border-purple-500` (`:377`), `border-amber-500` (`:390`), `text-amber-600` (`:394,406`).
  `green-500`/`purple-500` have **no `@theme` token at all**.
- `ScheduleFields` uses raw `grid gap-4 md:grid-cols-2` (`:260`) while its sibling sections
  use `grid-form-2` (`:104,208`).
- Empty placeholder is ASCII `"-"` in 8 places (`:355,357,360,370,374,379,392,397`) while the
  codebase convention is `"—"` (`lib/dateUtils.ts:9`).
- `form: any` at `:247` and `:313`.
- `:235` decorative accent bar has no `aria-hidden`.
- `<p>` used for the calendar-days hint (`:291`) instead of the `*Field` helper pattern.
- `facultyMembers: Array<{name?:string}>` (`:57,328`) duplicates the schema's
  `facultyChipSchema` (`schemas.ts:135`).
- `location_city` is conditionally `required` in the UI (`:254,271-279`) but
  `z.string().optional()` unconditionally in the schema (`schemas.ts:126`) — the F2F/Blended
  requirement is client-only.

### 4.12 `ApproveBatchModal.tsx` — the worst modal in the app

- **The decision control bypasses the shared field system entirely**: raw
  `react-hook-form` `Controller` + `<button>` (`:136-175`). It should be `SelectField` or a
  proper radio group.
- **Two separate `<Controller name="decision">` instances** (`:136`, `:156`) both declaring
  `rules={{required:"Decision is required"}}` (`:139,159`).
- Semantically a radio group rendered as two buttons: **no `role="radiogroup"`,
  no `role="radio"`, no `aria-checked`/`aria-pressed`**, no arrow-key navigation.
- `border-input bg-background` (`:148,168`) — `border-input` (`hsl(220 13% 91%)`,
  `globals.css:30`) is used as a **fill colour**.
- Raw `green-50`/`green-700` (`:147`) instead of `--color-success` / `--color-success-light`
  (`globals.css:32-34`).
- **The four CSS classes it re-implements already exist in `globals.css` and are unused**:
  `.decision-btn` (`:531`) + `.decision-btn-active` (`:535`) ≡ the inline
  `flex items-center justify-center gap-2 p-3 rounded-lg font-semibold text-sm transition-all`
  at `:145`/`:165`; `.info-card` (`:540`) ≡ `:78`; `.details-grid` (`:545`) ≡ `:94,121`;
  `.status-badge` (`:550`) not used at all.
- `.details-grid` is re-implemented with a **non-responsive** `grid-cols-2` (`:94,121,135`).
- `<label>` (`:134`) "Authorization Decision *" has **no `htmlFor`** and wraps no control.
- Icons `Lock` (`:81`), `CheckCircle2` (`:151`), `XCircle` (`:171`) — no `aria-hidden`.
- `throw new Error(err.message || …)` (`:47`) **discards `err.detail`**, which `FormModal`
  prefers over `err.message` (`FormModal.tsx:61-71`).
- `getStatusBadge` (`:53-59`) builds `Badge` without `size="sm"` and prints the raw `status`
  string in the fallback branch (`:58`), instead of the shared `StatusPill`
  (`admin/ui.tsx:273-283`).
- Detail grid is an untyped 16-entry `[label, value]` array literal (`:95-112`); `batch.status`
  (`:111`) is injected as bare text while the two approver statuses get badges (`:124,128`).
- Keyboard: `type="button"` on the decision buttons (`:142,162`) means Enter submits via the
  footer rather than activating the focused decision — the keyboard path never reaches the
  reject reason until the decision is already chosen.
- Trailing whitespace `:74`.

### 4.13 `ConfirmProvider.tsx`

Mostly correct (Radix, `autoFocus` on the control, real `<form>`, `role="alert"`). Remaining:
- `DialogFooter className="mt-4"` (`:181`) **overrides the component's own `p-6 border-t`**
  (`components/ui/dialog.tsx:68`) with a margin, so the buttons sit flush against the dialog
  edge. `FormModal.tsx:104` uses `border-t p-4` instead. Two footers for one primitive.
- **No `aria-describedby`** wiring the `role="alert"` message (`:177`) to the input (`:162,170`
  set only `aria-invalid`). Contrast `TextField.tsx:64`.
- Error only clears on `onChange` (`:163,172`), not on re-submit.
- Only `minLength` is checked (`:91-96`) — no required check, so an empty prompt resolves `""`.
- **No in-flight guard**: calling `confirm()`/`requestPrompt()` twice before settling
  overwrites the resolver (`:62,69`) and the first promise never settles.
- `confirmValue`/`promptValue` (`:101-102`) are `useMemo` over already-`useCallback`'d
  functions — dead memoisation.
- **No consumer in any of the four dashboard views** — only `BatchDetailDrawer` (`:12`) and the
  admin tabs use it. Destructive batch actions in the non-admin views have no confirmation.

### 4.14 `ErrorBoundary.tsx`

- **100% inline styles + raw hex**, ignoring `glass-panel`, `btn btn-primary` and
  `ErrorBanner` (`admin/ui.tsx:226-236`, which correctly uses
  `border-destructive/25 bg-destructive-light text-destructive` + `role="alert"`):
  `#f8fafc` (`:48`), `#fff` (`:52`), `#e2e8f0` (`:53`), `#fef2f2` (`:64`), `#ef4444` (`:70`),
  `#f1f5f9` (`:96`), `#0b5cab` (`:114,123`).
- **Hover via imperative DOM mutation**: `onMouseOver`/`onMouseOut` writing
  `e.currentTarget.style.background` (`:123-124`). This bypasses `:hover` **and**
  `:focus-visible` → the retry button has no designed focus affordance.
- Bare `<button>` (`:107`) — no `type="button"`, no `aria-label`. `AlertTriangle` (`:70`) and
  `RefreshCw` (`:126`) have no `aria-hidden`. No `role="alert"` on the fallback container.
- `<details>` (`:89-105`) discloses `error.toString()` (`:103`) to end users, and
  `componentDidCatch` (`:26-28`) `console.error`s in production.
- `minHeight:"100vh"` (`:42`) — the boundary wraps the **entire app** (`layout.tsx:22`), so any
  throw replaces the shell with a full-viewport page and discards the sidebar/nav.
- No reset on navigation (no `componentDidUpdate`), so one transient error bricks the session.
- `padding:"32px"` (`:55`) is off-scale vs the app's `p-4/p-5/p-6` rhythm.

---

## 5. Accessibility

- **Role/aria defects** (all listed inline above): Sidebar collapsed `aria-expanded` bug;
  invalid `role="menu"` children; ManagerBoard mouse-only kanban cards; MyBatches
  mouse-only rows; drawer with no `role="dialog"`/`aria-modal`/`aria-labelledby`; no Escape
  on the drawer or 7 of 8 modals; no focus trap in 8 surfaces; tab bars with no tab semantics;
  unlabeled `<label>`s in login, ManagerBoard, ApproveBatchModal; unlabeled finance editable
  cells; unlabeled bespoke filter selects (`TableFilters.tsx:262`).
- **No `<caption>` or accessible name on any of the 13 tables.** `SortableHeaderCell` supplies
  `scope="col"` + `aria-sort` (`SortableHeaderCell.tsx:70-71`), so caption is the one missing
  accessible name.
- **Charts have no text alternative.** 6 SVG chart components in `EnterpriseDashboard.tsx`
  render no `role="img"`, no `aria-label`, no `<title>`/`<desc>`; for `SvgGroupedBar` and
  `SvgDeliveryTimeline` the values exist **only** inside `<text>` nodes.
- **Progress bar** `ActiveBatchesView.tsx:322-332` has no `role="progressbar"` /
  `aria-valuenow`.
- **Decorative SVGs are not hidden**: the `KpiCard` watermark (`:156-158`), login background
  circles (`app/login/page.tsx:47-48`), `CreateBatchModal:235` accent bar.
- **Missing `aria-hidden` on icons**: `ManagerBoard.tsx:502`, `MyBatchesView.tsx:404`,
  `ActiveBatchesView.tsx:518`, `FacultyUtilizationView.tsx:178,630`, `ErrorBoundary.tsx:70,126`,
  `ApproveBatchModal.tsx:81,151,171`, `BatchDetailDrawer.tsx:3023,3314,3623`, the Navbar
  logout icon (`:162`).
- **Contrast**: `--text-dim` = `--color-muted-foreground` at **78% opacity**
  (`globals.css:78`) is the colour of every toolbar label (`TableFilters.tsx:33`, 0.62rem /
  weight 800) and every column heading (`SortableHeaderCell.tsx:17`, 0.78rem uppercase) —
  small text at reduced alpha, below AA.
- `--text-dim` and the raw `amber-50`/`green-50` badge backgrounds (`globals.css:183-205`)
  need an AA audit against their text pairs.
- **Keyboard shortcuts** (Ctrl/Cmd+2–5, `Sidebar.tsx:81-107`) have no visible hint, no
  `aria-keyshortcuts`, no `title`; `Ctrl+4`/`Ctrl+5` are OS-reserved on Windows/Linux.
- `.modal-overlay`/`.modal-content` (`globals.css:207-215`) duplicate Radix with no focus trap
  and no Escape — live in `BatchDetailDrawer.tsx:1168-1176`.

## 6. Responsive

- **Zero responsive support in the two biggest files**: `ManagerBoard.tsx` (1018 lines, no
  Tailwind breakpoint at all, `repeat(7, minmax(280px,1fr))` = 1960px mandatory scroll,
  `calc(100vh - 280px)` viewport math) and `BatchDetailDrawer.tsx` (4288 lines, one
  `repeat(auto-fit, minmax(140px,1fr))` at `:3870` as the only responsive value).
- `EnterpriseDashboard.tsx` fixed `1fr 1fr` / `2fr 1fr` grids at `:1555,1667,2007,2364`, all
  **inline**, so Tailwind responsive prefixes cannot apply.
- `BatchDetailDrawer.tsx` fixed px grids at `:1443,1486,1533,1603,1647,2657,2750,3336,3929,4191`.
- `ApproveBatchModal.tsx` `grid-cols-2` with no `sm:`/`md:` variant (`:94,121,135`).
- `app/page.tsx:736-745` `padding:"24px"` + `gap:24` with no mobile reduction, and
  `:743` inline `background` overrides `.dashboard-shell`.
- `ErrorBoundary.tsx:42` `minHeight:"100vh"` inside the app shell.
- **Hydration flash**: `hooks/useMediaQuery.ts:6` starts `false` and syncs in an effect
  (`:8-16`); `Sidebar.tsx:46-47,172,186-199` derives the whole layout from it → desktop sidebar
  paints on a 375px viewport first. Use `useSyncExternalStore`.
- **Two breakpoint sources of truth**: JS `max-width:768px` / `max-width:1024px`
  (`useMediaQuery.ts:22,26`) vs Tailwind `lg:` (1024px) at `Sidebar.tsx:179,432`.
- `globals.css:706-713` forces `header`/`main` padding with `!important` at ≤640px,
  overriding any component padding.
- **No dark mode at all.** Zero `dark:` / `prefers-color-scheme` / `.dark` matches in
  `frontend/**`. Every colour in these views is a light-mode literal plus `rgba(255,255,255,…)`
  overlays, and the token block (`globals.css:10-40`) has no paired dark variants. Before
  dark mode is even possible, the hardcoded hex in §3.7 must be tokenised.

## 7. Performance

- `page.tsx:273-287` rebuilds `financeDrafts` on every `batches` change → **every keystroke in
  any editable finance cell invalidates all 4 filter accessors, all 19 sort accessors, and
  re-collects every dropdown option** (`useTableFilters.ts:53-63`).
- `BatchDetailDrawer.tsx:201-220` `parseRemarksList` invoked 5× per render
  (`:1688,1697×2,1703,1718`) — two regex passes + a lookbehind `split` each, on every
  keystroke in every open modal. Memoise.
- `EnterpriseDashboard.tsx:80` `isBatchInPeriod` allocates 5 `Date` pairs per batch per render
  (`getPeriodRange` `:45-76`, 2 `new Date`; `periodCounts` `:923-926` makes 4 passes,
  `activeBatchesDataset` `:933` 1 more).
- `EnterpriseDashboard.tsx:835-861` `subordinateUserIds` BFS is O(n³) — `while (queue)` ×
  `users.forEach` (`:837`) × `users.find` (`:840`), re-run on every `users` identity change.
- `EnterpriseDashboard.tsx:1584-1586` mutates a memoised array in place via `.sort()`.
- `CreateBatchModal.tsx:323` bare `form.watch()` subscribes the whole form; every keystroke
  re-renders the entire `max-w-4xl` modal.
- `page.tsx:1008-1046` — a JSX IIFE computing two counts on every render over unfiltered
  `batches`; should be a `useMemo`.
- **All pagination is client-side** and the server call is capped at
  `limit: 100` (`page.tsx:263`; `api.getActiveBatches` only forwards
  `filter_date/skip/limit`, `lib/api.ts:981-992`). No table sends `skip`/`limit` per page, so
  page 6 of a 500-row table shows nothing.
- `FacultyUtilizationView.tsx` 13 `useState` values (`:261-278`) driving hand-rolled
  filter/sort that re-collect options on every change.
- `react-virtual` and `@tanstack/react-table` are both in `package.json` but unused — the
  3200px-wide, 27-column table has no row virtualisation.

## 8. Dead code to remove

| Item | Location |
|---|---|
| `Trend` component + `KpiCard.trend` prop — no call site passes `trend` | `EnterpriseDashboard.tsx:100-125,133,140,170` |
| `chartPage` (written never read), `chartPageSize` (never referenced) | `EnterpriseDashboard.tsx:789-790,914` |
| Unreachable `ENTERPRISE_DASHBOARD` admin branch | `EnterpriseDashboard.tsx:799,826-829,888,1153,1183,1321,1326` |
| `getStatusColor` | `BatchDetailDrawer.tsx:920-929` |
| `sessionVenue`, `sessionMode` — setters exist, never read, never sent | `BatchDetailDrawer.tsx:724-725,938-946` |
| `handleSubmitBatch`, `getStatusBadgeColor` | `app/page.tsx:701-708,724-733` |
| `sidebarRef` (created, never attached), unused `pathname` | `Sidebar.tsx:55,44` |
| Dead Sidebar props `onFilterCategory`/`activeCategoryFilter` | `Sidebar.tsx:30-31,39-40`; passed at `app/page.tsx:752-753` |
| Dead Tailwind widths `w-72`/`w-20`/`w-64` (overridden by inline width) | `Sidebar.tsx:190,195` |
| Unreachable `isMobile ? 0` branch | `Sidebar.tsx:172` vs `:198` |
| Unused imports | `BatchDetailDrawer.tsx:18-19,21` (9) · `app/page.tsx:26-30` (21 of 27) · `EnterpriseDashboard.tsx:5,7,7,8,8` (5) · `ManagerBoard.tsx:18,25,26,27,32` (5) · `Sidebar.tsx:7-9` (5) |
| Unused accessor `SESSION_ACCESSORS.batchName` | `ActiveBatchesView.tsx:227` |
| `Navbar.onOpenCreateModal` — declared, never used | `Navbar.tsx:10` |
| `confirmValue`/`promptValue` — `useMemo` over `useCallback` | `ConfirmProvider.tsx:101-102` |
| Unreachable second null check | `BatchDetailDrawer.tsx:857` |
| 2-line re-export shims | `components/ApproveBatchModal.tsx`, `components/ChangePasswordModal.tsx` |
| ~50 unused CSS classes + 15 unused tokens | `globals.css` (see §3.3) |
| Unused deps: `@tanstack/react-table`, `@tanstack/react-virtual` | `frontend/package.json` |

## 9. Suggested implementation order

**Phase 1 — table parity (the user's explicit ask).**
1. Add `useColumnVisibility` + `ColumnsMenu` to all 13 tables, driven by a single `COLUMNS`
   array per table (§2.1, §2.11, §2.15). Start with #6 (27 cols), #12 (19 cols), #2 (21 cols) —
   these are unusable without it.
2. Persist column + page-size state in `localStorage` (§2.2).
3. Add `stickyHeader` + `table-pin-first-col` to #1–#11; `stickyThead` for #12/#13 (§2.3, §2.4).
4. Add `ExportButton` to all 13; fix the finance XLSX export to forward sort order (§2.5).
5. Add `PaginationControls` to #7, #12, #13 (§2.7).
6. Replace all hand-rolled empty/loading/error markup with `EmptyState`/`LoadingState`/
   `ErrorBanner`; fix the #11 empty-state bug and the #6 error-as-empty-state bug (§2.9).

**Phase 2 — extract `<DataTable>`** so the above stops being copy-paste (§3.2), then move
`BatchDetailDrawer` and `EnterpriseDashboard` onto it.

**Phase 3 — modals & chrome.** Radix-ise the 8 drawer modals (§4.10), rewrite
`ApproveBatchModal`'s decision control (§4.12), fix `ErrorBoundary` (§4.14), tokenise
`Navbar`/`Sidebar`/`login` (§4.1–4.3), make the sidebar URL-routable (§4.3).

**Phase 4 — design system.** Delete or wire the dead CSS/tokens (§3.3), fix the `--destructive`
reference (§3.4), collapse the badge/button systems (§3.5, §3.6), replace hardcoded hex with
tokens (§3.7). Then dark mode becomes possible (§6).

**Phase 5 — a11y, responsive, performance.** Per §5, §6, §7, plus the dead-code sweep (§8).
