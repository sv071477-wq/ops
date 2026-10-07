# Fix React #310 crash on "Manage Schedule" (BatchDetailDrawer hook order)

## Context / root cause

Clicking **Manage Schedule** crashes the page with `Minified React error #310`
("Rendered more hooks than during the previous render").

Single offender, confirmed by exhaustive scan of `frontend/components/BatchDetailDrawer.tsx`
(110 hook calls; 109 at lines 328-956):

- `frontend/components/BatchDetailDrawer.tsx:958` — `if (!isOpen || !batch) return null;`
- `frontend/components/BatchDetailDrawer.tsx:1009` — `useMemo` for `remarkEntries`, **after** that guard

`frontend/app/page.tsx:1652-1663` mounts `<BatchDetailDrawer />` unconditionally and only
flips props (`batch={null}` / `isOpen={false}` -> the selected batch). So the first render is
always the *closed* one (109 hooks), and the click makes the next render need 110.

Trigger chain: `MyBatchesView.tsx:243` -> `page.tsx:898` `openBatchDetail(batch, "sessions")`
-> `page.tsx:363-366` -> drawer props change -> 110th hook -> throw.

Why it shipped: `frontend/components/BatchDetailDrawer.tabs.test.tsx:51-57` always mounts with
`isOpen` true and a non-null batch, so the closed -> open transition is never exercised. There is
also no ESLint config in the repo, so `rules-of-hooks` never ran.

## Decisions

- Minimal fix: move the one hook. No component split.
- Do not change `activeBatch`'s type to `Batch | null` — ~100 downstream reads of `activeBatch.*`
  after the guard would become type errors for no behavioural gain.
- ESLint / component decomposition are explicitly out of scope.

## Tasks

### 1. Hoist the hook above the guard (`BatchDetailDrawer.tsx`)

Delete lines 1007-1009 (the comment + `useMemo`) and insert, immediately before the
`if (!isOpen || !batch) return null;` line at 958:

```tsx
  // Parsed once per remarks change: the audit list is read five times per render
  // otherwise, each read running two regex passes and a lookbehind split.
  // Must stay above the `!isOpen` guard: page.tsx mounts this drawer permanently and
  // only flips `batch`/`isOpen`, so a hook below the guard means 109 hooks on the
  // closed render and 110 on the next one (React error #310).
  const remarkSource = currentBatch ?? batch;
  const remarkEntries = useMemo(() => parseRemarksList(remarkSource?.remarks), [remarkSource?.remarks]);
```

Notes:
- `remarkSource` is `Batch | null`, so `remarkSource?.remarks` is honest optional chaining —
  unlike `activeBatch?.remarks`, which is typed non-nullable and would be a lie.
- `remarkSource` resolves to the same object as `activeBatch` (`activeBatch = currentBatch || batch!`),
  so `remarkEntries` is unchanged in value.
- `parseRemarksList` already returns `[]` for `undefined` (`BatchDetailDrawer.tsx:233`), so no
  empty-array constant or extra guard is needed.
- `remarkEntries` is only consumed in the JSX after the guard, so leaving its consumers in place
  is correct.

### 2. Regression test (closed -> open transition)

In `frontend/components/BatchDetailDrawer.tabs.test.tsx`, add a test that mounts closed then rerenders open:

```tsx
it("opens without a hooks-order error when mounted closed first", async () => {
  const { rerender } = render(
    <ConfirmProvider>
      <BatchDetailDrawer batch={null} isOpen={false} onClose={() => {}} initialTab="sessions" />
    </ConfirmProvider>
  );
  expect(screen.queryByText(/Sessions & Timetable/i)).toBeNull();

  rerender(
    <ConfirmProvider>
      <BatchDetailDrawer batch={batch} isOpen onClose={() => {}} initialTab="sessions" />
    </ConfirmProvider>
  );

  await waitFor(() => expect(getSessions).toHaveBeenCalled());
  expect(screen.getAllByText(/Sessions & Timetable/i).length).toBeGreaterThan(0);
});
```

`getSessions` is already mocked in that file. Before the fix this test throws error #310, so it is a
genuine regression guard, not a tautology.

## Risks

- `BatchDetailDrawer` is 4289 lines with 110 hooks; any future hook added below line 958 re-creates
  this crash. The regression test in task 2 is the only automated guard (no ESLint in repo).
- The `useEffect` at `BatchDetailDrawer.tsx:952` fires on the closed -> open transition and calls
  `loadSessions()`, which reads `activeBatch` (`:923`). It is already guarded by `if (!target) return;`
  and only runs when `isOpen && batchId`, so no change needed — do not "fix" it as part of this work.
- `remarkEntries` moving above the guard means it is now computed on every render while closed
  (memoised on `remarkSource?.remarks`, so it recomputes only when the source changes). Negligible.

## Out of scope

- Adding ESLint / `eslint-plugin-react-hooks` so `rules-of-hooks` runs in CI.
- Splitting `BatchDetailDrawer` into per-tab child components.
- Improving `ErrorBoundary` to surface non-minified errors.
- The `useCallback`-inside-returned-object pattern in `hooks/useTableFilters.ts:135` and
  `hooks/useColumnVisibility.ts:98` (a lint violation, but hook order is stable; not the cause).

## Validation

From `frontend/`:

1. `npx vitest run components/BatchDetailDrawer.tabs.test.tsx components/BatchDetailDrawer.utilization.test.tsx app/dashboard/components/MyBatchesView.test.tsx`
2. `npx vitest run` (full suite)
3. `npx tsc --noEmit`
4. `npm run build`
5. Manual: `npm run dev` -> My Batches -> click **Manage Schedule** on a batch. Drawer must open on
   the "Sessions & Timetable" tab with no ErrorBoundary, then open the timetable ingestion modal,
   download the template, and parse a sheet.