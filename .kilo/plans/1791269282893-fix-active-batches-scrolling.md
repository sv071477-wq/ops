# Fix Scrolling Issue in ActiveBatchesView

## Problem
The ActiveBatchesView contains two `FullscreenTable` components stacked vertically (batches + sessions), both with `stickyHeader={true}`. This causes scrolling issues because:
1. Both tables set `maxHeight: calc(100vh - stickyTop - 24px)` on their panels
2. In a flex column layout, both try to consume full viewport height
3. The `.table-scroll-wrapper` CSS has `overflow-y-hidden` that may conflict with inline styles

## Root Cause
- `FullscreenTable` at line 147 applies `maxHeight: calc(100vh - ${stickyTop}px - 24px)` when `stickyHeader` is true
- With two tables in a flex column, the first table takes full height, pushing second table down
- Second table also tries to take full height, causing layout issues
- CSS `.table-scroll-wrapper` has `overflow-y-hidden` which may prevent vertical scrolling

## Plan

### 1. Remove stickyHeader from the Sessions table
The sessions table doesn't need a sticky header since it's the second table. Only the batches table (first) should have sticky header.

**File:** `frontend/app/dashboard/components/ActiveBatchesView.tsx`
- Line ~669: Remove `stickyHeader` and `stickyTop` from the second `FullscreenTable` (sessions table)
- Keep `stickyHeader` and `stickyTop` on the first `FullscreenTable` (batches table)

### 2. Fix CSS to allow vertical scrolling when needed
**File:** `frontend/app/globals.css`
- Line 305: Change `.table-scroll-wrapper` from `overflow-y-hidden` to `overflow-y-auto`
- The `FullscreenTable` component already controls overflow via inline styles, so the CSS should not force `overflow-y-hidden`

### 3. Verify the flex container allows proper scrolling
The parent container at line 598 has `flex: 1` but no `minHeight: 0` or `overflow: hidden`. This should work with the fixed tables, but verify the layout.

## Files to Modify
1. `frontend/app/dashboard/components/ActiveBatchesView.tsx` - Remove stickyHeader from sessions table
2. `frontend/app/globals.css` - Fix table-scroll-wrapper overflow-y

## Testing
- Verify batches table scrolls vertically with sticky header
- Verify sessions table scrolls vertically (no sticky header needed)
- Verify both tables work in fullscreen mode
- Verify horizontal scrolling still works
- Verify column pinning (first column) still works