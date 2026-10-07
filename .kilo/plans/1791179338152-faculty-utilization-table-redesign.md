# Faculty Utilization table — visual rebuild

## Context

The view still reads as broken after two fix passes. Those passes fixed the filter
bar but left four problems, all confirmed in code:

1. **Regression I introduced.** `FacultyUtilizationView.tsx:582` renders the
   bordered filter panel wrapper unconditionally. When "More filters" is
   collapsed the user sees an empty bordered box with 26px of padding around a
   lone button, hanging below the toolbar.
2. **Two default-visible columns are blank in every row.** Neither
   `backend/scripts/seed_demo.py:436-453` nor
   `backend/scripts/import_real_data.py:572-587` ever sets `vertical`,
   `faculty_type_id` or `program_type_id`. So `Vertical` and `Faculty Type` ship
   visible and render an em-dash in all rows. Worse, making `Faculty Type`
   filterable produced a dropdown whose `optionsFor()` returns `[]` — the same
   dead-dropdown class just fixed in `MyBatchesView`.
3. **15 of 27 columns visible at a hardcoded `minWidth: 2400`**
   (`FacultyUtilizationView.tsx:631`), so the table always scrolls horizontally.
4. **Ragged rows.** `LONG_WRAP_STYLE` / `WRAP_STYLE` free-wrap Topic, Module
   Feedback, Outcome Reason and Venue with `whiteSpace: normal`, and `TD_STYLE`
   sets `verticalAlign: top`. Row heights vary from one to four lines.

### Decisions taken (confirmed with user)

| Decision | Choice |
|---|---|
| Default density | Medium, ~12 columns |
| Blank columns | Hide until populated; suppress filters with no options |
| Scope | This table + one general guard in `TableFilters` |
| Summary/KPI strip | **Out of scope** — not adding |

## Target default column set (12 visible)

Reading order. Date anchors the sticky slot (`globals.css:401` pins whatever is
physically first):

```
Date of Training | Faculty Full Name | Batch ID | Topic | No. of Hours
Status | Mode of Delivery | Feedback Rating | Client | Category
Coordinator | Location/City
```

`Feedback Rating` is promoted into the visible set — it is currently hidden, so
the feedback-driven ledger shows no feedback at all by default.

Hidden by default (15): `venue`, `moduleFeedback`, `facultyTypeName`, `vertical`,
`startTime`, `endTime`, `feedbackSubmitted`, `outcomeReason`, `outcomeAt`,
`outcomeBy`, `createdAt`, `updatedAt`, `id`, `trainingSessionId`, `programTypeId`.

## Tasks

### 1. Fix the empty-panel regression

The `children` slot in `TableFilters.tsx:312-324` is `display: flex` with **no
`flexWrap`**, so two children sit side by side. In
`FacultyUtilizationView.tsx`, stop passing the panel wrapper as an always-rendered
container. Instead pass one wrapper div with `flexWrap: "wrap"` that holds:

- the "More filters" toggle button, sized `flexBasis: "100%"` so it takes its own
  line;
- the bordered `EXPANDED_FILTERS_STYLE` panel, rendered **only** when
  `moreFiltersOpen`.

Result: collapsed state shows a plain button on its own row with no border; the
bordered panel appears only when it has content in it.

### 2. Trim `DEFAULT_HIDDEN` to the 12 above, and reorder the defs

Reorder `UTILIZATION_COLUMN_DEFS` so the 12 visible columns come first in reading
order, then the 15 hidden ones. Update `DEFAULT_HIDDEN` to exactly the 15 keys
listed above. Leave `ColumnKey`, `CELL_DEFS`, `EXPORT_COLUMNS` key coverage and
every `filterable` flag alone — only order and the hidden set change.

Mirror the new order into `EXPORT_COLUMNS` so the CSV keeps matching the screen.

### 3. Bump the column-layout storage key

`useColumnVisibility.ts:58-59` lets a stored layout override `defaultHidden`, so
anyone who has already opened this view keeps the old 15-column set and never
sees the fix. Change `COLUMN_STORAGE_KEY` to
`ops.table.faculty-utilization.columns.v2` and update the constant of the same
name in `FacultyUtilizationView.test.tsx:9`. The old key is simply orphaned.

### 4. Derive the table min-width from the visible columns

Remove the hardcoded `minWidth: 2400`. Compute it from the columns actually
rendering:

```ts
const tableMinWidth = useMemo(
  () => UTILIZATION_COLUMNS.filter((c) => columns.isVisible(c.key))
        .reduce((sum, c) => sum + (c.minWidth ?? 120), 0),
  [columns]
);
```

Fallback 120 per column keeps columns without an explicit `minWidth` from
collapsing. Expected result for the default set is roughly 1,750px, so the table
fits a large laptop and scrolls only when the user turns columns back on. Apply
it to the `<table>` style alongside the existing `glass-table` classes.

### 5. Uniform row heights

Replace free wrapping with single-line + ellipsis + a `title` tooltip carrying the
full text, for `topic`, `moduleFeedback`, `outcomeReason`, `venue` and `client`:

- style: `{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: <existing> }`
- `CellDef.title` already exists and the `<td>` already renders it — set it to the
  raw value.

`LONG_WRAP_STYLE` / `WRAP_STYLE` can then be deleted. `moduleFeedback` and
`outcomeReason` are `sortable: false` today; keep that.

### 6. Muted empty-cell placeholder

`text()` currently returns a full-strength `—`, so a column with no data draws as
loudly as real data. Add an `empty()` helper that renders the `—` with
`MUTED_STYLE`, and route every null/empty cell through it. Use `isBlankTableValue`
from `@/lib/tableUtils` rather than an ad-hoc falsy check, so `0` and `false` are
not swallowed.

### 7. Shared guard: never render an option-list filter with no options

In `TableFilters.tsx`, filter the `selects` array before mapping, dropping any
select whose `options.length === 0`. A dropdown whose only option is "All X" is
broken UI and is what produced the dead Faculty Type control.

Blast radius is small — the only tests that assert a filter label are
`MyBatchesView.test.tsx:178-209` (rows have `client_name`, so it stays) and this
view's own tests (rows have `faculty_type_name`/`vertical`, so they stay).

### 8. Filter config cleanup

In `FacultyUtilizationView.tsx`:

- `SECONDARY_FILTERS`: drop `vertical` (never populated). Keep `facultyTypeName`
  — task 7 hides it automatically while blank, and it appears as soon as rows
  carry a value.
- Keep `PRIMARY_FILTERS` as the 4 currently there.

Also apply the same "skip when empty" rule to the panel's select map, since that
panel is built locally rather than through `TableFilters`.

### 9. Tests

Update in `FacultyUtilizationView.test.tsx` for 12 visible instead of 15:

- `:87` `headerCells()` 15 -> 12; `:94` 14 -> 11; `:108` 16 -> 13.
  `:119-120` (`showAll` -> 27) is unchanged.
- The "lists the columns in reading order" test: expect the 12 new labels in order.
- `COLUMN_STORAGE_KEY` constant at `:9`.

Add:

- collapsed "More filters" renders **no** bordered panel (assert no element has
  the panel border style / the panel is absent from the DOM);
- a filter column that is blank across all rows renders **no** dropdown, and
  appears once a row carries a value;
- `Topic` cell carries a `title` with the full text and does not wrap;
- an empty cell renders the muted placeholder;
- the table's `min-width` tracks the visible column set (turn columns on, assert
  it grows).

## Risks

- **`useTableFilters.ts` warns on unknown filter keys in dev.** Task 8 removes
  filter keys; confirm `getFilter`/`setFilter` are simply not called for removed
  keys rather than passed a dangling key, or the dev console will warn.
- **Column-layout v2 key** discards any layout a user has already customised.
  Intended — the old set is the thing being fixed — but worth stating in the
  commit message.
- **`minWidth` recomputes on every column toggle**, so the table will re-layout
  when columns are switched. Expected and correct; confirm it does not fight the
  horizontal scroll position badly.

## Validation

```powershell
cd frontend
npx tsc --noEmit
npx vitest run app/dashboard/components/FacultyUtilizationView.test.tsx components/table/table.test.tsx
npm test
```

Expected: typecheck clean, full suite green (currently 179 tests). Beyond
automation, eyeball the view at ~1440px and confirm: no empty bordered box when
collapsed, 12 columns with no horizontal scrollbar on a wide screen, uniform row
heights, and no column rendering an em-dash wall.

`npm run lint` is unusable here — the repo has no ESLint config and `next lint`
prompts to create one, so `tsc --noEmit` is the static check.

## Out of scope

- The six admin tabs (no `<thead>` when empty, legacy five-list column pattern).
- The dead server-side filters in `app/page.tsx` (`statusFilter`, `domainFilter`,
  `categoryFilter`) — `Sidebar.tsx` has uncommitted user work in it.
- `frontend/tsconfig.tsbuildinfo` is tracked and rewritten by every `tsc` run.