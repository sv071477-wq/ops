# Frontend Refactor Plan - Enterprise Operations Platform

## Executive Summary

The current frontend is a **Next.js 14 App Router** application with **React 18**, **TypeScript**, **TanStack Query**, **React Hook Form + Zod**, and **Radix UI + Tailwind CSS v4**. While functionally complete, it suffers from severe architectural issues: monolithic components (1000+ line page.tsx), inconsistent styling (inline styles + Tailwind + CSS variables mixed), no design system, poor separation of concerns, and performance anti-patterns.

---

## Current State Analysis

### Tech Stack
| Layer | Technology | Version | Status |
|-------|------------|---------|--------|
| Framework | Next.js | 14.2.5 | App Router |
| Language | TypeScript | 5.5.3 | Strict mode off |
| State (Server) | TanStack Query | 5.104.0 | Good |
| State (Client) | React Context + useState | - | Scattered |
| Forms | React Hook Form | 7.51.0 | Good |
| Validation | Zod | 3.22.4 | Good |
| UI Primitives | Radix UI | Latest | Good |
| Styling | Tailwind CSS | 4.3.3 | Misused |
| Icons | Lucide React | 0.400.0 | Good |

### Critical Issues Found

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Inline styles everywhere | 🔴 Critical | All components | Unmaintainable, no theme support, breaks SSR |
| Monolithic page.tsx (1000+ lines) | 🔴 Critical | `app/page.tsx` | Impossible to test, debug, or reuse |
| No design system | 🔴 Critical | All UI components | Inconsistent UX, duplicated code |
| Mixed styling approaches | 🔴 Critical | globals.css + inline styles | Conflicts, maintenance burden |
| Business logic in components | 🟠 High | page.tsx, BatchDetailDrawer | Untestable, tight coupling |
| No component composition | 🟠 High | All large components | Code duplication, large bundle |
| Missing error boundaries per feature | 🟠 High | Only root ErrorBoundary | Crashes entire app on partial failure |
| No loading/error states consistency | 🟠 Medium | Various components | Poor UX |
| Type safety gaps | 🟠 Medium | api.ts, hooks | Runtime errors |
| No test infrastructure | 🟡 Medium | Frontend root | No regression protection |

---

## Refactor Strategy: Incremental Modernization

**Approach**: Strangler Fig pattern - build new architecture alongside old, migrate view by view.

### Phase 1: Foundation (Week 1-2)
**Goal**: Establish design system, remove inline styles, set up testing

#### Tasks
1. **Design System Setup**
   - Create `packages/ui` or `src/components/ui` with proper component library
   - Define design tokens (colors, spacing, typography, shadows) in `tailwind.config.ts`
   - Remove all CSS variables from globals.css, use Tailwind theme
   - Create base components: Button, Input, Select, Table, Card, Badge, Modal, Toast, Tooltip, Avatar, DropdownMenu

2. **Eliminate Inline Styles**
   - Replace all `style={{...}}` with Tailwind classes
   - Create utility classes for common patterns (glass-panel, metric-card, status-badge)
   - Use CSS-in-JS only for truly dynamic values (progress bar widths)

3. **Testing Infrastructure**
   - Add Vitest + React Testing Library + MSW
   - Configure coverage thresholds (80% for utils, 60% for components)
   - Add Storybook for component documentation

4. **TypeScript Strict Mode**
   - Enable `strict: true` in tsconfig.json
   - Fix all `any` types, add proper generics

### Phase 2: Architecture Restructure (Week 2-3)
**Goal**: Separate concerns, enable code reuse

#### Tasks
1. **Feature-Based Folder Structure**
   ```
   src/
   ├── features/
   │   ├── batches/
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   ├── types/
   │   │   └── api.ts
   │   ├── approvals/
   │   ├── finance/
   │   ├── analytics/
   │   └── faculty/
   ├── shared/
   │   ├── components/ui/          # Design system
   │   ├── hooks/                  # useAuth, useMediaQuery, etc.
   │   ├── lib/                    # api, dateUtils, validation
   │   ├── context/                # AuthContext
   │   └── types/
   ├── app/
   │   ├── (auth)/login/
   │   ├── (dashboard)/
   │   │   ├── batches/
   │   │   ├── approvals/
   │   │   ├── finance/
   │   │   ├── analytics/
   │   │   └── faculty/
   │   └── admin/
   └── providers/
   ```

2. **Custom Hooks for Data Fetching** (already partially done in `useDashboardData.ts`)
   - Move ALL API calls to feature-specific hooks
   - Use TanStack Query consistently with proper cache keys
   - Add optimistic updates for mutations

3. **State Management**
   - Keep React Context for auth only
   - Use TanStack Query for server state
   - Use local useState/useReducer for ephemeral UI state
   - Consider Zustand for complex client state (filters, UI preferences)

### Phase 3: View Migration (Week 3-5)
**Goal**: Migrate each view to new architecture

#### Migration Order (by complexity)
1. **Login Page** - Simple, isolated, good starting point
2. **Faculty Utilization** - Least complex dashboard view
3. **Approval Queue** - Medium complexity
4. **Finance Review Sheet** - Complex but self-contained
5. **Batch Operations Hub** - Core view, high complexity
6. **Manager Board** - Complex, needs Kanban refactor
7. **Enterprise Dashboard** - Most complex, heavy visualizations
8. **Batch Detail Drawer** - Massive component, split into sub-components

#### Per-View Migration Checklist
- [ ] Create feature folder with components/hooks/types
- [ ] Extract business logic into custom hooks
- [ ] Split monolithic components into presentational + container
- [ ] Replace inline styles with design system components
- [ ] Add proper loading/error/empty states
- [ ] Add unit tests for hooks and utils
- [ ] Add integration tests for key user flows
- [ ] Verify accessibility (keyboard nav, ARIA, contrast)
- [ ] Performance profile (React DevTools Profiler)

### Phase 4: Advanced Improvements (Week 5-6)
**Goal**: Polish, performance, developer experience

#### Tasks
1. **Performance Optimization**
   - Virtualize large tables (react-window already in deps)
   - Code-split by route (Next.js does this) and heavy components
   - Memoize expensive computations (useMemo, useCallback)
   - Optimize TanStack Query cache times

2. **Accessibility Audit**
   - Run axe-core in CI
   - Fix all violations
   - Add focus management for modals/drawers

3. **Developer Experience**
   - Add ESLint rules for Tailwind (tailwindcss/eslint-plugin)
   - Add Prettier with Tailwind plugin
   - Add commitlint + husky
   - Document component APIs with TypeDoc

4. **Bundle Analysis**
   - Add @next/bundle-analyzer
   - Identify and remove unused dependencies
   - Optimize icon imports (lucide-react tree-shaking)

---

## Component Breakdown: Batch Detail Drawer (Example)

**Current**: 2000+ lines, 15+ modals, all in one component

**Target Structure**:
```
features/batches/components/BatchDetailDrawer/
├── BatchDetailDrawer.tsx           # Main orchestrator (~100 lines)
├── tabs/
│   ├── OverviewTab.tsx
│   ├── SessionsTab.tsx
│   └── QualityGatesTab.tsx
├── modals/
│   ├── EditBatchModal.tsx
│   ├── LifecycleStatusModal.tsx
│   ├── LogUtilizationModal.tsx
│   ├── AddSessionModal.tsx
│   ├── Gate1FeedbackModal.tsx
│   ├── Gate2ClosureModal.tsx
│   ├── ImportFeedbackModal.tsx
│   └── IngestTimetableModal.tsx
├── hooks/
│   useBatchDetail.ts               # Data fetching
│   useBatchActions.ts              # Mutations
│   useSessions.ts
│   useQualityGates.ts
│   useTimetableIngestion.ts
└── components/
    ├── BatchHeader.tsx
    ├── CommercialInfo.tsx
    ├── DeliveryLogistics.tsx
    ├── HeadcountFaculty.tsx
    ├── SessionRow.tsx
    ├── ScheduledSessionRow.tsx
    └── TimelineChart.tsx
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regression during migration | High | High | Feature flags, parallel deployment, comprehensive tests |
| Design system adoption resistance | Medium | Medium | Document benefits, provide migration guide, pair programming |
| Performance regression | Medium | High | Benchmark before/after, bundle analysis in CI |
| Tailwind v4 migration issues | Low | Medium | Test in isolation first, use `@tailwindcss/postcss` |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Largest component size | 2000+ lines | <300 lines | ESLint max-lines rule |
| Inline style usage | ~200 instances | 0 (except dynamic) | Custom ESLint rule |
| Test coverage | 0% | 70% overall | Vitest coverage report |
| Bundle size (gzipped) | Unknown | <200KB | @next/bundle-analyzer |
| Lighthouse Performance | Unknown | >90 | CI Lighthouse CI |
| Accessibility violations | Unknown | 0 critical/serious | axe-core in CI |

---

## Out of Scope
- Backend API changes
- Database schema changes
- Authentication system redesign
- New feature development (only refactoring existing)
- Mobile app / native

---

## Next Steps
1. Review this plan with stakeholders
2. Set up feature branch `refactor/frontend-foundation`
3. Begin Phase 1: Design System + Testing Infrastructure
4. Weekly sync to review progress and adjust

---

*Plan created: 2026-09-29*
*Estimated duration: 6 weeks (2 developers)*