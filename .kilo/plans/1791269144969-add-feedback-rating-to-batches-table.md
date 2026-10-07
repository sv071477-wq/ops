# Add Feedback Rating Columns to Batches Table

## Goal
Add `batch_avg_feedback` (average feedback score 1.0-5.0) and `batch_nps` (Net Promoter Score -100 to 100) columns to the batches tables in the frontend, with column visibility toggle support.

## Current State
- Backend model (`backend/app/models/batch.py:77-78`) already has both columns
- Backend schema (`backend/app/schemas/batch.py:274-275`) includes both in `BatchResponse`
- Frontend API types (`frontend/lib/api.ts:195-196`) already define both fields
- Two table views need updating:
  1. `MyBatchesView.tsx` - Coordinator's "My Batches" view
  2. `ActiveBatchesView.tsx` - Active batches view

## Implementation Plan

### 1. MyBatchesView.tsx Updates
- Add two new column definitions to `BATCH_COLUMN_DEFS`:
  - `feedback` - Average Feedback (1.0-5.0), sortable, filterable
  - `nps` - NPS Score (-100 to 100), sortable, filterable
- Add corresponding entries to `COLUMN_KEYS` for column visibility menu
- Add to `EXPORT_COLUMNS` for CSV export
- Add cell rendering in `BatchRow` component with appropriate formatting (stars for feedback, color-coded NPS)
- Add filter fields for both columns

### 2. ActiveBatchesView.tsx Updates
- Add same two columns to `BATCH_COLUMN_DEFS`
- Add to `BATCH_COLUMN_KEYS` for column visibility
- Add to `BATCH_EXPORT_COLUMNS`
- Add cell rendering in `BatchRow` component
- Add filter fields

### 3. UI/UX Details
- **Average Feedback**: Display as "4.5 ★" with star icon, sort numerically
- **NPS**: Display with color coding (green for positive, red for negative, gray for neutral), sort numerically
- Both columns hidden by default (added to `defaultHidden` in `useColumnVisibility`)
- Filterable via dropdown selects in table toolbar

## Files to Modify
1. `frontend/app/dashboard/components/MyBatchesView.tsx`
2. `frontend/app/dashboard/components/ActiveBatchesView.tsx`

## Testing
- Verify columns appear in column visibility menu
- Verify sorting works on both columns
- Verify filtering works on both columns
- Verify CSV export includes both columns
- Verify data displays correctly for batches with/without feedback data