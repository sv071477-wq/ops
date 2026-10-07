# Render the UI at 80% scale by default (CSS `zoom`)

## Context

At 100% browser zoom the app reads as oversized: generous paddings, tall controls,
and a type scale that fills more of the screen than a dense ops dashboard needs. The
UI already looks correct at 80% browser zoom, so the goal is to reproduce that
rendering while leaving the browser at 100%.

The layout's fixed-pixel width budget is what makes 80% look better. On a 1440px
screen the content column is 1112 CSS px, but the My Batches filter toolbar needs
1160px (`MyBatchesView.tsx:358-404`, `TableFilters.tsx:252`) and its table sets
`minWidth: 1180` (`MyBatchesView.tsx:445`) — so both overflow. At 80% zoom the
viewport is effectively 1800 CSS px and both fit. Scaling by 0.8 reproduces that.

## Decisions

- **`zoom: 0.8` on `html`, not `font-size: 80%`.** `zoom` scales rem, px, Tailwind
  utilities and the ~100 hand-written inline px paddings inside `BatchDetailDrawer.tsx`
  together, preserving every internal proportion. `font-size` would shrink only the
  rem-based half and leave control heights (`CONTROL_HEIGHT = 36`), panel padding
  (`FullscreenTable.tsx:49`), cell padding (`MyBatchesView.tsx:153`) and the whole
  drawer at full size.
- **On `html`, not an inner wrapper.** Radix portals — the drawer, all 8 modals,
  selects, dropdowns — render into `document.body`. A zoom on an inner wrapper would
  leave every one of them unscaled. `FullscreenTable.tsx:30-34` already documents
  this class of ancestor-transform trap.
- **Desktop only, `min-width: 1024px`.** Below that, 14px body text would render at
  ~11.2 physical px. Phones are a real target (mobile sidebar drawer at
  `Sidebar.tsx:360`; 900px/640px breakpoints at `globals.css:435,441`).
- **Compensate the two micro-label sets fully**, so they hold today's physical size.
  `0.62rem / 0.8 = 0.775rem`, `0.75rem / 0.8 = 0.9375rem`, `0.78rem / 0.8 = 0.975rem`.
- Scale factor exposed as `--app-scale` so it is tunable in one place.
- **No JS viewport math is affected.** Verified: zero `innerWidth`, `innerHeight`,
  `getBoundingClientRect` or `getComputedStyle` in any `.tsx`. All 12 `100vh`/`100vw`
  uses are pure CSS.

## Tasks

### 1. Add the scale token — `frontend/app/globals.css`

In the `:root` block (lines 61-71), add:

```css
  --app-scale: 0.8;
```

### 2. Apply the zoom — `frontend/app/globals.css`

Immediately after the `@layer base` block closes at line 87:

```css
@media (min-width: 1024px) {
  /* UI scale. 0.8 renders the app at the size it has at 80% browser zoom, as CSS,
     so the browser stays at 100%. On `html` rather than an inner wrapper so Radix
     portals -- the drawer, all 8 modals, selects, dropdowns -- stay inside the
     scaled box. Desktop only: at phone widths this would put body text at ~11.2
     physical px. */
  html {
    zoom: var(--app-scale);
  }
}
```

Top-level `@media` (not nested in `@layer`) so it wins the cascade outright.

### 3. Compensate the toolbar micro-labels — `frontend/components/table/TableFilters.tsx:29`

`LABEL_SLOT_STYLE.fontSize`: `"0.62rem"` -> `"0.775rem"`.

Holds ~9.92 physical px instead of ~7.94. `globals.css:64-66` already records that
these labels sit near the AA limit at 0.62rem and needed their colour bumped
78% -> 88%, so they are the one size that must not shrink. `whiteSpace: "nowrap"`
(line 34) is unchanged — confirm the longest label ("Delivery Mode") still fits its
150px field.

### 4. Compensate the column headings — two constants, not one

Which constant wins depends on whether the caller passes a `style`, because both
components spread caller `style` **last** (`SortableHeaderCell.tsx:76`, `:107`).
Both must move or tables diverge:

- `frontend/components/ui/panel.tsx:30` — `TABLE_TH_STYLE.fontSize`:
  `"0.75rem"` -> `"0.9375rem"`. This is the effective value for every table, since
  all callers build their heading style from it (`MyBatchesView.tsx:154`,
  `ActiveBatchesView.tsx:259`, `page.tsx:237,240`, `EnterpriseDashboard.tsx:862-866`,
  and the admin tabs).
- `frontend/components/table/SortableHeaderCell.tsx:16` — `SORTABLE_TH_STYLE.fontSize`:
  `"0.78rem"` -> `"0.975rem"`. Covers headings that do not override, including the
  drawer's local `TIMETABLE_TH_STYLE` (`BatchDetailDrawer.tsx:71`), which does not
  spread `TABLE_TH_STYLE`.

**Accepted tradeoff:** headings land at 12.0 physical px against 11.2 for body
`text-sm`, a 0.8px inversion. Heading weight (700), `uppercase` and `letterSpacing`
carry the hierarchy, so it still reads correctly. Recorded here rather than silently.

## What this supersedes

`zoom: 0.8` raises the effective CSS-px budget to `viewport / 0.8` — 1800 CSS px on a
1440px screen, leaving a ~1496px content column after page padding, shell gap and the
256px sidebar. The 1160px toolbar and the 1180px table both fit. **Do not also
implement** the five responsive-layout changes (flexible `TableFilters` field widths,
shrinkable actions cluster in `FullscreenTable.tsx:205-215`, icon-only action
buttons, lower `minWidth`, icon row actions). They are superseded, and stacking them
would shrink the UI twice.

## Risks

`zoom` has no test coverage — jsdom does not implement it, so the whole suite can
pass while the UI is broken. Every item below is a manual check.

1. **`100vh` compensation is the one real unknown.** Symptom if it fails: a ~20%
   empty band at the bottom of a full-height view. Watch `page.tsx:870`
   (`minHeight: "100vh"`) and `FullscreenTable.tsx:147`
   (`maxHeight: calc(100vh - ${stickyTop}px - 24px)`).
   Fallback, only if the band appears: inside the same `@media` block add
   `html, body { height: 100%; }`, change `page.tsx:870` to `minHeight: "100%"`, and
   divide the remaining `calc(100vh …)` sites by the scale
   (`calc((100vh - 88px) / var(--app-scale))`). The drawer's 8 modals
   (`BatchDetailDrawer.tsx:2759` onward) and `ManagerBoard.tsx:158` (floored at
   420px) are centred or floored, so a shortfall there is cosmetic — fix only if visible.
2. **Radix overlay alignment.** `Select`, the `ColumnsMenu` dropdown,
   `ConfirmProvider`, and the drawer itself are floating-ui positioned portals.
   Symptom: a popover offset from its trigger. Reference element and portal share
   the same zoomed coordinate space, so this should hold, but it must be eyeballed.
3. **Sticky positioning under zoom.** Confirm `table-pin-thead` (pinned headings)
   and `table-pin-first-col` (pinned first column) still stick when scrolling.
4. **Wider headings.** `whiteSpace: "nowrap"` plus the 25% larger headings grow column
   widths. Slack is ~316px, so confirm no table gains a horizontal scrollbar.
5. No `@media print`, canvas or `devicePixelRatio` usage exists, so no print or
   screenshot regression surface.

## Validation

Automated (`frontend/`) — proves nothing broke structurally, and nothing about layout:

1. `npx vitest run`
2. `npx tsc --noEmit`
3. `npm run build`

Manual (`npm run dev`), at 100% browser zoom, in this order:

1. My Batches — panel fills the viewport with no bottom gap; filter toolbar on one
   line; no horizontal scrollbar; no jitter now that `.glass-panel:hover`
   (`globals.css:95-102`) is border+shadow only.
2. Open **Manage Schedule** — drawer renders inside the scaled box, tabs work, then
   open the timetable ingestion modal and confirm it is not visibly short.
3. Every Radix overlay: a filter `Select`, the `ColumnsMenu` dropdown, a confirm dialog.
4. Scroll the table — sticky headings and pinned first column hold.
5. Any `Select`/`DropdownMenu` across Active Batches and Faculty Utilization.
6. Narrow the window below 1024px — scale drops away and the mobile layout is unscaled.

## Out of scope

- The five responsive-layout fixes (superseded, see above).
- Shrinking the type scale generally. Body `text-sm` becomes 11.2 physical px; if that
  reads as too small, that is a separate decision about `--text-*` tokens in the
  `@theme` block (`globals.css:5-59`), not a change to this plan.
- Per-user scale preference or a UI toggle for it.