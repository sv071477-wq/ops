# Fix the misplaced Timetable Ingestion dialog

## Context

The **Ingest Timetable (Excel)** button in the drawer's Sessions & Timetable tab opens
the ingestion modal, but the popup is not aligned — it sits in the wrong place instead
of centered over the drawer.

**Root cause.** `frontend/components/ui/dialog.tsx:37` centers every dialog with
`fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]`. The ingestion modal
is the only `DialogContent` in the codebase that overrides `position`
(`frontend/components/BatchDetailDrawer.tsx:3060`):

```tsx
style={{ width: "100%", maxWidth: 760, background: "#ffffff", borderRadius: 16, position: "relative" }}
```

With `position: relative`, `left/top: 50%` no longer resolve against the viewport — they
resolve against the Radix portal `div` in `document.body`, whose height is auto, i.e. the
modal's own height. So `top: 50%` (half its own height) is exactly cancelled by
`translateY(-50%)` and the box lands at the top of the document, while the horizontal
math still centers it. Confirmed scope: all 7 other drawer modals (`:1272, :2758, :2874,
:2904, :2982, :3402, :3648, :3802`), `admin/ui.tsx:60`, `ConfirmProvider.tsx:115,143` and
`FormModal.tsx:91` inherit `fixed` and are unaffected.

**Why `position: relative` was there — do not just delete it.** The preview step renders
`<FullscreenTable strategy="absolute">` (`:3212-3217`). In fullscreen mode
`FullscreenTable.tsx:130-141` applies `position: absolute; inset: 0`, which resolves
against the nearest *positioned* ancestor; `FullscreenTable.tsx:30-33` documents this
exact requirement. Without a positioned ancestor inside the modal, the preview's
**Full Screen** button would escape the modal and cover the whole page. The dependency is
real, it just belongs on an inner wrapper, not on the dialog box.

## Decisions

- **Drop `position: relative` from the dialog box** so it inherits the shared `fixed`
  centering and matches the other 7 modals.
- **Move the positioned ancestor to the step-2 wrapper** (`:3179`), the flex column that
  already holds the validation banner and the preview table. It carries `flex: 1`, so its
  height is bounded by the dialog's `max-h-[calc(100vh-32px)]` — a definite box for the
  preview's `inset: 0` to fill.
- **No change to `dialog.tsx` layout.** Switching the shared centering to
  `inset-0` + `m-auto` would be more robust, but it touches all 12 dialogs across the
  app for a bug local to one caller. Out of scope; see below.
- **`html { zoom: 0.8 }` (`globals.css:100-102`) is not implicated.** `fixed` dialogs
  center correctly in the zoomed coordinate space — proven by the 7 sibling modals the
  user has not complained about. Do not touch the scale.

## Tasks

### 1. Restore `fixed` centering on the dialog — `frontend/components/BatchDetailDrawer.tsx:3060`

Remove `position: "relative"` from the inline style, leaving:

```tsx
style={{ width: "100%", maxWidth: 760, background: "#ffffff", borderRadius: 16 }}
```

Nothing inside step 1 (`:3102-3177`: `ErrorBanner`, the form, the dashed dropzone, the
hidden file input) is absolutely positioned, so it needs no containing block of its own.

### 2. Give the step-2 wrapper the positioned ancestor — `frontend/components/BatchDetailDrawer.tsx:3179`

Add `position: "relative"` to the existing inline style, with a comment naming the
dependency so the next reader does not "clean it up":

```tsx
{/* `relative` is the containing block for the preview table's `strategy="absolute"`
    fullscreen overlay (`inset: 0`). It must live on this wrapper, never on the
    DialogContent itself — `position: relative` there overrides the shared
    `fixed left-1/2 top-1/2` centering and lands the dialog at the top of the page. */}
<div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", gap: 12 }}>
```

### 3. Guard the invariant in the shared component — `frontend/components/ui/dialog.tsx:31-40`

Comment only, no behaviour change: note that the `fixed` + `left/top: 50%` + `translate`
centering is what positions every dialog, so a caller must not override `position` on
`DialogContent` — an inner wrapper is the place to create a positioned ancestor.

### 4. Regression test — `frontend/components/BatchDetailDrawer.tabs.test.tsx`

jsdom has no layout engine, so this asserts the CSS contract rather than pixels. Reuse
the file's existing harness (`renderDrawer("sessions")` + mocked `@/lib/api`):

1. Render on the `sessions` tab, `fireEvent.click` the **Ingest Timetable (Excel)** button
   (`:1967`), then `await screen.findByRole("dialog", { name: /Timetable Ingestion/i })`.
2. Assert the dialog element does **not** carry an inline `position`
   (`dialog.style.position === ""`) and that its class list still contains `fixed`
   (`left-[50%]`, `top-[50%]` are also fine to assert). This fails today with
   `position === "relative"` and passes after task 1.

Do not attempt to assert the step-2 wrapper's `position` in jsdom: reaching it requires
parsed rows (`extractedRows.length > 0`), i.e. a mocked `api.ingestScheduleFile` plus a
file-input upload. The step-2 fullscreen fill is covered by the manual check instead.

## Risks

1. **The preview's Full Screen overlay is the only thing task 1 could break.** If task 2's
   `position: relative` is omitted, the overlay escapes the modal and covers the page.
   Task 2 and the manual check step 3 exist for this.
2. **Vertical fit after recentring.** The dialog is `max-h-[calc(100vh-32px)]` with
   `overflow-hidden`. Centering with `top: 50%` + `translateY(-50%)` is the same geometry
   the other 7 modals use, so the 16px breathing room holds — confirm on a short window
   (step 4 below).
3. **Nested dialog stacking is unchanged** — the ingest portal still mounts to `document.body`
   above the drawer, and `?/button]:hidden` still suppresses the shared close button, so
   the modal keeps its own `X` at `:3093`.

## Validation

Automated (`frontend/`):

1. `npx vitest run components/BatchDetailDrawer.tabs.test.tsx` — new case plus the 11
   existing drawer cases.
2. `npx vitest run` — full suite (was 192/192).
3. `npx tsc --noEmit`.
4. `npm run build`. (`npm run lint` has no ESLint config in this repo — it prompts for
   setup. Do not run it.)

Manual (`npm run dev`, 100% browser zoom, ≥1024px wide):

1. Drawer → **Sessions & Timetable** → **Ingest Timetable (Excel)**: the dialog is
   centered over the drawer, not pinned to the top of the page.
2. Step 1 dropzone, buttons and template download link lay out unchanged.
3. Parse a timetable, then press **Full Screen** on the preview: the table expands to fill
   the modal and the page behind does not scroll or flash.
4. Repeat step 1 at a short window height (~700px): the dialog fits with a visible margin
   top and bottom, no clipping.

## Out of scope

- Moving the shared centering in `dialog.tsx` from `translate` to `inset-0` + `m-auto`.
  More robust in principle, but it repoints all 12 dialogs in the app.
- The `100vh` compensation fallback listed in `.kilo/plans/1791200137322-ui-scale-zoom-80-percent.md`.
  This dialog is unaffected — no bottom gap to fix here.
- Internal layout polish in step 1 (the upload icon at `:3139` uses
  `margin: "0 auto"` on an inline `<svg>`, which does not centre it). Separate concern
  from the reported misalignment; flag it rather than bundling it in.