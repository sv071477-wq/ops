# UI Improvement Plan for Form App

## Executive Summary

The current UI suffers from inconsistent styling approaches (Tailwind + inline styles + custom CSS), a monolithic 1000+ line dashboard page, non-responsive tables, accessibility gaps, and basic error handling. This plan outlines a systematic modernization.

---

## Current State Analysis

### Key Problems Identified

| Area | Issues |
|------|--------|
| **Styling Architecture** | Mix of Tailwind utilities, `globals.css` custom classes (`.glass-panel`, `.glass-input`), and extensive inline `style={{}}` objects |
| **Dashboard Page** | 1000+ lines in `page.tsx` with 8+ views, massive inline styles, duplicated filter/pagination logic |
| **Forms** | Wizard modal works but dense; no real-time validation feedback; step transitions lack polish |
| **Tables** | Horizontal scroll only; not mobile-friendly; no column visibility/resizing |
| **Design Tokens** | Colors defined in CSS vars but not fully leveraged; spacing/typography inconsistent |
| **Error Handling** | `alert()` for errors; basic spinners; no toast system in dashboard views |
| **Accessibility** | Missing ARIA on custom components; focus management in wizard; color contrast unverified |
| **Responsive** | Only 2 media queries; tables break on mobile; sidebar not collapsible on small screens |

---

## Phase 1: Design System Foundation (Week 1)

### 1.1 Consolidate Styling Approach
- **Decision**: Migrate fully to Tailwind v4 + CSS variables; remove custom `globals.css` utility classes (`.glass-panel`, `.glass-input`, `.btn-*`, `.badge-*`)
- **Action**: 
  - Define all colors, spacing, radii, shadows in `globals.css` `@theme` block
  - Create `tailwind.config.ts` → remove (Tailwind v4 uses CSS-first config)
  - Replace all inline `style={{}}` with Tailwind utilities
  - Build reusable `Card`, `Button`, `Input`, `Select`, `Table`, `Badge` components using `class-variance-authority`

### 1.2 Design Token Audit
- Standardize color palette: Primary (#0b5cab), Semantic (success/warning/error), Neutral scales
- Define spacing scale (4px base), typography scale, border radius scale
- Document in `frontend/DESIGN_SYSTEM.md`

### 1.3 Component Library Setup
- Create `components/ui/` with properly typed, accessible primitives:
  - `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`
  - `Card`, `CardHeader`, `CardContent`, `CardFooter`
  - `Table`, `TableHeader`, `TableRow`, `TableCell`
  - `Badge`, `Avatar`, `Tooltip`, `Toast`, `Dialog`, `Drawer`
  - `FormField`, `FormLabel`, `FormError`, `FormHelperText`
- Use Radix UI primitives where applicable (`@radix-ui/react-*`)

---

## Phase 2: Dashboard Architecture Refactor (Week 2)

### 2.1 Decompose `page.tsx`
Split into feature-based components:
```
app/
├── dashboard/
│   ├── page.tsx                    # Entry point, minimal
│   ├── components/
│   │   ├── DashboardLayout.tsx     # Shell: sidebar + main + header
│   │   ├── SidebarNav.tsx          # Collapsible, responsive
│   │   ├── ViewSwitcher.tsx        # Tab/segmented control
│   │   └── MetricsGrid.tsx         # Reusable metric cards
│   ├── views/
│   │   ├── BatchesView.tsx         # Batch list + filters + pagination
│   │   ├── ApprovalsView.tsx       # Approval queue
│   │   ├── FinanceView.tsx         # Finance review sheet
│   │   ├── ManagerBoardView.tsx    # Manager dashboard
│   │   ├── AnalyticsView.tsx       # Charts + exports
│   │   └── FacultyView.tsx         # Faculty roster + utilization
│   └── hooks/
│       ├── useBatches.ts           # Data fetching + filtering
│       ├── useFinanceDrafts.ts     # Finance draft state
│       └── usePagination.ts        # Reusable pagination logic
```

### 2.2 State Management
- Extract filter/pagination state into custom hooks
- Use React Query (TanStack Query) for server state (replaces manual `useEffect` fetching)
- Local UI state (modals, drawers) → `useState` or Zustand if complex

### 2.3 Responsive Layout
- Sidebar: Collapsible to icons on `< 1024px`, drawer on `< 768px`
- Tables: Card-based layout on mobile (`< 768px`), full table on desktop
- Use CSS Grid/Flexbox with container queries where possible

---

## Phase 3: Form & Wizard UX Overhaul (Week 3)

### 3.1 Wizard Modal Improvements
- **Step Indicator**: Vertical on mobile, horizontal on desktop; clickable completed steps
- **Validation**: 
  - Real-time field validation on blur (current) + on change (debounced)
  - Show inline errors immediately; disable "Continue" until step valid
  - Summary of all errors on final submit attempt
- **UX Polish**:
  - Auto-focus first invalid field on step change
  - Persist form data to `localStorage` for crash recovery
  - Keyboard shortcuts: `Enter` = next, `Escape` = close/cancel
  - Loading skeleton during async option fetching

### 3.2 Field Components Enhancement
- All fields: Consistent `label`, `error`, `helperText`, `placeholder` patterns
- Add `required` asterisk, character counters for textareas
- Select: Searchable, multi-select support, async options
- DateField: Range picker, presets (this week, next month)
- ChipArray: Drag-to-reorder, duplicate detection

### 3.3 CreateBatchWizard Specific
- Step 1: Add client autocomplete from API
- Step 2: Visual calendar for date range; auto-calc hours from days
- Step 3: Faculty search with role badges; show availability
- Step 4: Pre-flight summary → make it a collapsible sidebar on wide screens

---

## Phase 4: Data Tables & Lists (Week 4)

### 4.1 Reusable DataTable Component
Features:
- Column sorting, filtering (text, select, date range), resizing
- Row selection (single/multi) with bulk actions toolbar
- Virtualized rows for 1000+ records (`@tanstack/react-virtual`)
- Column visibility menu; pinned columns
- Export to CSV/Excel
- Empty, loading, error states
- Mobile: Stacked card view with priority fields

### 4.2 Apply to All Views
- BatchesView: Replace manual table
- ApprovalsView: Add urgency indicator column
- FinanceView: Inline editing with optimistic updates
- FacultyUtilization: Expandable rows for session details

---

## Phase 5: Feedback & Error Handling (Week 5)

### 5.1 Toast/Notification System
- Replace all `alert()` calls with `react-hot-toast` or custom toast
- Types: success, error, warning, info, loading (promise-based)
- Position: top-right; auto-dismiss; action buttons (retry, undo)

### 5.2 Form Error Handling
- Server errors: Map to field-level via `setError()`
- Network errors: Retry button in toast
- Validation errors: Inline + summary banner

### 5.3 Loading States
- Page-level: Skeleton screens (not spinners)
- Button-level: `loading` prop with spinner
- Table-level: Row shimmer during fetch

---

## Phase 6: Accessibility & Polish (Week 6)

### 6.1 Accessibility Audit
- WCAG 2.1 AA compliance
- Focus visible outlines on all interactive elements
- ARIA labels/descriptions on custom components
- Color contrast ratios (4.5:1 text, 3:1 UI)
- Keyboard navigation: Tab order, escape to close modals
- Screen reader: Live regions for toasts, status updates

### 6.2 Visual Polish
- Consistent 8px spacing grid
- Micro-interactions: hover/tap transitions (150ms)
- Empty states with illustrations + CTAs
- Reduced motion support (`prefers-reduced-motion`)

### 6.3 Dark Mode (Optional)
- Extend CSS variables for dark theme
- Toggle in user preferences; persist to localStorage

---

## Technical Decisions Needed

### Question 1: State Management for Dashboard
**Options:**
- A) React Query + local useState (recommended, minimal deps)
- B) Zustand for global UI state + React Query
- C) Redux Toolkit (overkill)

**Recommendation**: A — React Query handles server state; local state stays in components.

### Question 2: Table Library
**Options:**
- A) Build custom DataTable with TanStack Virtual (full control, ~300 LOC)
- B) Use `@tanstack/react-table` v8 (feature-rich, larger bundle)
- C) AG Grid Community (enterprise features, steep learning curve)

**Recommendation**: B — `@tanstack/react-table` balances features/bundle size; integrates with React Query.

### Question 3: Form Library
**Current**: react-hook-form + zod (good)
**Decision**: Keep; enhance with `@hookform/resolvers` + custom field components.

### Question 4: Animation Library
**Options:**
- A) Tailwind `animate-*` + CSS (lightweight)
- B) Framer Motion (powerful, +50kb)
- C) Motion One (smaller, WAAPI-based)

**Recommendation**: A — Tailwind + CSS covers needs; avoid extra deps.

### Question 5: Component Library Approach
**Options:**
- A) Build own on Radix UI (current path, full control)
- B) Adopt shadcn/ui (copy-paste, well-maintained)
- C) Use Headless UI + custom styling

**Recommendation**: B — shadcn/ui components are essentially Radix + Tailwind + CVA; copy relevant ones, customize. Saves weeks of boilerplate.

---

## Migration Strategy

### Incremental Rollout
1. **Week 1**: Design tokens + primitive components (no breaking changes)
2. **Week 2**: New dashboard views alongside old; feature flag per view
3. **Week 3**: Wizard modal v2 in parallel; A/B test with users
4. **Week 4**: DataTable in one view first (Finance), then propagate
5. **Week 5**: Toast system globally; replace alerts incrementally
6. **Week 6**: Accessibility fixes + polish; final QA

### Rollback Plan
- Each phase behind feature flag (`NEXT_PUBLIC_NEW_DASHBOARD=true`)
- Old `page.tsx` preserved as `page.legacy.tsx`
- Quick revert: flip flag, redeploy

---

## Validation & Acceptance Criteria

| Criterion | Target |
|-----------|--------|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Bundle Size Increase | < 50kb gzipped |
| Mobile Usability (Chrome DevTools) | No errors |
| Keyboard Navigation | Full app operable without mouse |
| Visual Regression | < 2% pixel diff vs design mocks |
| User Testing | 5/5 task completion rate for core flows |

---

## Out of Scope
- Backend API changes
- New features (only UI/UX improvements)
- Internationalization (i18n)
- Major information architecture changes

---

## Open Questions for User

1. **Design Direction**: Do you have design mockups/Figma, or should we evolve the current aesthetic?
2. **Priority Views**: Which dashboard views are most critical? (Batches, Approvals, Finance?)
3. **Mobile Usage**: What % of users access on mobile? Affects responsive investment.
4. **Dark Mode**: Required for launch or nice-to-have?
5. **Component Library**: Adopt shadcn/ui components (copy-paste) or build custom on Radix?
6. **Timeline**: Hard deadline or iterative delivery?