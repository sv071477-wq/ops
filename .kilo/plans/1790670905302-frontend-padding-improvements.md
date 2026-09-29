# Frontend Padding Improvements Plan

## Problem Analysis

The frontend has inconsistent padding across components:
- Arbitrary padding values: 12px, 14px, 16px, 18px, 20px, 22px, 24px, 28px used inconsistently
- No systematic spacing scale
- `glass-panel` utility class lacks default padding
- Main content area relies on parent container padding only

## Proposed Solution

### 1. Define a Consistent Spacing Scale (Tailwind-based)

Add to `globals.css` @theme section:
```css
--space-xs: 4px;    /* 1 unit */
--space-sm: 8px;    /* 2 units */
--space-md: 16px;   /* 4 units - BASE */
--space-lg: 24px;   /* 6 units */
--space-xl: 32px;   /* 8 units */
--space-2xl: 48px;  /* 12 units */
```

### 2. Update Utility Classes

**Update `.glass-panel`** to include default padding:
```css
.glass-panel {
  @apply bg-white/90 border border-border/80 rounded-2xl shadow-sm transition-all duration-200 p-6;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 250, 255, 0.92));
}
```

**Add new utility classes:**
```css
.panel-padding { @apply p-6; }        /* 24px - default panel content */
.panel-padding-sm { @apply p-4; }     /* 16px - compact panels */
.panel-padding-lg { @apply p-8; }     /* 32px - spacious panels */
.section-gap { @apply gap-6; }        /* 24px - between sections */
.card-gap { @apply gap-4; }           /* 16px - between cards */
```

### 3. Key Files to Update

#### A. `app/globals.css` - Add spacing scale and update utilities
#### B. `app/page.tsx` - Main dashboard layout
- Update main container padding to use consistent scale
- Standardize metric cards, filter bar, table containers
#### C. `components/Sidebar.tsx` - Already uses Tailwind spacing (p-3, p-2) - OK
#### D. `components/Navbar.tsx` - Inline padding - convert to utility
#### E. `components/CreateBatchModal.tsx` - Already good (24px/28px)
#### F. `components/BatchDetailDrawer.tsx` - Already good (24px)
#### G. `components/ManagerBoard.tsx` - Standardize glass-panel padding
#### H. `components/ui/card.tsx` - Already uses p-6 (24px) - OK
#### I. `components/forms/modal/WizardModal.tsx` - Check and standardize
#### J. `app/dashboard/components/DashboardLayout.tsx` - Check if exists

### 4. Standardize Common Patterns

| Element | Current | Target |
|---------|---------|--------|
| Page/section container | 16-20px | 24px (p-6) |
| Card/panel content | 14-22px | 24px (p-6) |
| Compact panels (filters, headers) | 12-16px | 16px (p-4) |
| Modal/drawer content | 24-28px | 24px (p-6) |
| Between sections | 18-24px | 24px (gap-6) |
| Between cards | 14-16px | 16px (gap-4) |
| Table cell padding | 12-14px | 12px (px-3 py-3) |

### 5. Desktop-Only Scope

No responsive breakpoints needed. Target desktop viewport (1440px+). Ensure consistent padding at full desktop width.

## Implementation Tasks

1. [x] Update `globals.css` with spacing scale and enhanced utilities
2. [x] Update `app/page.tsx` main layout and all view components
3. [x] Update `components/Navbar.tsx` to use utility classes
4. [x] Update `components/ManagerBoard.tsx` panel padding
5. [x] Update `components/forms/modal/WizardModal.tsx` if needed
6. [x] Verify all modals/drawers use consistent padding
7. [x] Run lint/typecheck to verify no regressions

## Validation

- Visual consistency check across all views at desktop resolution (1440px+)
- No layout breaks or content clipping
- Accessibility: sufficient touch targets (min 44px)