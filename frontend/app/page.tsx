"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  api, ActiveBatchesResponse, Batch, ManagerDashboardSummary, TrainingSession, User
} from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ActiveBatchesView } from "./dashboard/components/ActiveBatchesView";
import { MyBatchesView } from "./dashboard/components/MyBatchesView";
import { FacultyUtilizationView } from "./dashboard/components/FacultyUtilizationView";
import { CreateBatchModal } from "@/components/CreateBatchModal";
import { ApproveBatchModal } from "@/components/ApproveBatchModal";
import { BatchDetailDrawer, BatchDetailTab } from "@/components/BatchDetailDrawer";
import { ManagerBoard } from "@/components/ManagerBoard";
import { Sidebar, DashboardView } from "@/components/Sidebar";
import { EnterpriseDashboard } from "@/components/EnterpriseDashboard";
import { PaginationControls } from "@/components/PaginationControls";
import { FullscreenTable, PlainHeaderCell, SortableHeaderCell, TableFilters } from "@/components/table";
import { useTableFilters } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { buildSearchHaystack, SortAccessors, TableAccessor } from "@/lib/tableUtils";
import {
  Layers, Search, Filter, Plus, CheckCircle2, Clock, PlayCircle,
  Archive, Eye, Lock, Building2, MapPin, Sparkles, RefreshCw,
  AlertTriangle, BarChart3, Download, Users, Briefcase, TrendingUp, Check,
  PlusCircle, Calendar, ShieldCheck, FileSpreadsheet,
  Kanban
} from "lucide-react";

function toTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Shared column metadata for the two hand-rolled tables on this page. The
// accessors are module-level constants so `useTableSort` / `useTableFilters`
// keep a stable `accessors` identity and their memos do not churn per render.
const FINANCE_ACTIVE_STATUSES = new Set(["Approved", "Upcoming", "Ongoing", "Completed"]);

const APPROVAL_SORT_ACCESSORS: SortAccessors<Batch> = {
  batchId: (b) => b.batch_id,
  program: (b) => b.program_name,
  client: (b) => b.client_name,
  domain: (b) => b.domain,
  mode: (b) => b.delivery_mode,
  city: (b) => b.location_city,
  submittedOn: (b) => b.batch_request_date,
  status: (b) => b.status,
};

const APPROVAL_SORT_OPTIONS = [
  { key: "batchId", label: "Batch" },
  { key: "program", label: "Program" },
  { key: "client", label: "Client" },
  { key: "domain", label: "Domain" },
  { key: "mode", label: "Mode" },
  { key: "city", label: "City" },
  { key: "submittedOn", label: "Submitted On" },
  { key: "status", label: "Status" },
];

const APPROVAL_DESC_FIRST_KEYS = ["submittedOn"];

const APPROVAL_FILTER_FIELDS = [
  { key: "status", accessor: APPROVAL_SORT_ACCESSORS.status },
  { key: "domain", accessor: APPROVAL_SORT_ACCESSORS.domain },
];

const APPROVAL_SEARCH_ACCESSOR: TableAccessor<Batch> = (b) => buildSearchHaystack(b, [
  APPROVAL_SORT_ACCESSORS.batchId,
  APPROVAL_SORT_ACCESSORS.program,
  APPROVAL_SORT_ACCESSORS.client,
  APPROVAL_SORT_ACCESSORS.domain,
]);

const FINANCE_STATUS_OPTIONS = ["Pending", "Cleared"];

const FINANCE_SEARCH_ACCESSOR: TableAccessor<Batch> = (b) => buildSearchHaystack(b, [
  (batch) => batch.batch_id,
  (batch) => batch.client_name,
  (batch) => batch.program_name,
  (batch) => batch.domain,
  (batch) => batch.delivery_mode,
  (batch) => batch.location_city,
  (batch) => batch.approval_id,
  (batch) => batch.sow_number,
]);

const FINANCE_SORT_OPTIONS = [
  { key: "batchId", label: "Batch ID" },
  { key: "client", label: "Client" },
  { key: "program", label: "Program" },
  { key: "category", label: "Category" },
  { key: "technology", label: "Technology" },
  { key: "domain", label: "Domain" },
  { key: "mode", label: "Mode" },
  { key: "location", label: "Location" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "enrollments", label: "Enrollments" },
  { key: "trainingDays", label: "Training Days" },
  { key: "totalHours", label: "Total Hours" },
  { key: "sowNumber", label: "SOW Number" },
  { key: "approvalId", label: "Approval ID" },
  { key: "faculty", label: "Faculty" },
  { key: "financeStatus", label: "Finance Status" },
  { key: "checkDate", label: "Check Date" },
  { key: "status", label: "Status" },
];

const FINANCE_TH_STYLE: React.CSSProperties = { padding: "12px 14px" };

// The approval queue's body cells use 14px vertical padding, so its headings must too.
const APPROVAL_TH_STYLE: React.CSSProperties = { padding: "14px 16px" };

// Bespoke toolbar controls must match the shared controls' box exactly, or the
// toolbar grid breaks alignment.
const FINANCE_FILTER_STYLE: React.CSSProperties = {
  width: "100%",
  height: 34,
  boxSizing: "border-box",
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--border-subtle)",
  background: "#fff",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-main)",
};

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Top-level Navigation View
  const [activeView, setActiveView] = useState<DashboardView>("active_batches");

  // Active Batches state
  const [activeFilterDate, setActiveFilterDate] = useState<string>(toTodayIso());
  const [activeBatchesData, setActiveBatchesData] = useState<ActiveBatchesResponse | null>(null);
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeBatchPage, setActiveBatchPage] = useState(1);
  const [activeBatchPageSize, setActiveBatchPageSize] = useState(10);
  const [activeSessionPage, setActiveSessionPage] = useState(1);
  const [activeSessionPageSize, setActiveSessionPageSize] = useState(15);

  // My Batches state. Kept separate from `batches`, which is manager scope and
  // already loaded for other views.
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [isLoadingMyBatches, setIsLoadingMyBatches] = useState(false);
  const [myBatchesError, setMyBatchesError] = useState<string | null>(null);
  const [myBatchesPage, setMyBatchesPage] = useState(1);
  const [myBatchesPageSize, setMyBatchesPageSize] = useState(10);

  // Direct reports state for managerial dashboard
  const [myReports, setMyReports] = useState<User[]>([]);

  // All users for enterprise dashboard
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [financeDrafts, setFinanceDrafts] = useState<Record<string, {
    approval_id: string;
    finance_status: string;
    finance_status_check_date: string;
    finance_check: number | null;
  }>>({});
  const [savingFinanceBatchId, setSavingFinanceBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Finance review sheet state. Free-text search plus the plain value-match
  // dropdowns are owned by `useTableFilters`; the synthetic workflow bucket and
  // the date range are bespoke predicates, so they stay in local state.
  const [financeStatusFilter, setFinanceStatusFilter] = useState("ACTIVE"); // default: exclude draft/pending
  const [financeStartDate, setFinanceStartDate] = useState("");
  const [financeEndDate, setFinanceEndDate] = useState("");
  const [isSavingAllFinance, setIsSavingAllFinance] = useState(false);

  // Analytics state
  const [dashboardSummary, setDashboardSummary] = useState<ManagerDashboardSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isExportingMbr, setIsExportingMbr] = useState(false);

  // Faculty state
  const [facultyUtilizationLedger, setFacultyUtilizationLedger] = useState<TrainingSession[]>([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [facultyError, setFacultyError] = useState<string | null>(null);

  // Pagination states for all platform lists/tables
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalPageSize, setApprovalPageSize] = useState(10);

  const [financePage, setFinancePage] = useState(1);
  const [financePageSize, setFinancePageSize] = useState(10);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBatchForApproval, setSelectedBatchForApproval] = useState<Batch | null>(null);
  const [selectedBatchForDetail, setSelectedBatchForDetail] = useState<Batch | null>(null);
  // The My Batches "Manage Schedule" path lands the coordinator straight on the
  // timetable; every other entry point keeps the default Overview tab.
  const [detailDrawerTab, setDetailDrawerTab] = useState<BatchDetailTab>("overview");

  const openBatchDetail = (batch: Batch, tab: BatchDetailTab = "overview") => {
    setDetailDrawerTab(tab);
    setSelectedBatchForDetail(batch);
  };

  // Redirect if unauthenticated
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/login");
    } else if (!isAuthLoading && user?.role?.toLowerCase() === "admin") {
      router.replace("/admin");
    }
  }, [user, isAuthLoading, router]);

  // Fetch batches
  const fetchBatches = async (forApprovals = false) => {
    setIsLoading(true);
    try {
      const data = await api.getBatches({
        status: forApprovals ? undefined : statusFilter !== "ALL" ? statusFilter : undefined,
        domain: forApprovals ? undefined : domainFilter !== "ALL" ? domainFilter : undefined,
        category: forApprovals ? undefined : categoryFilter !== "ALL" ? categoryFilter : undefined,
      });
      setBatches(data);
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch batches owned by the caller
  const fetchMyBatches = async () => {
    setIsLoadingMyBatches(true);
    setMyBatchesError(null);
    try {
      const data = await api.getBatches({ mine: true });
      setMyBatches(data);
    } catch (err: any) {
      console.error("Failed to load my batches:", err);
      setMyBatchesError(err?.message || "Failed to load your batches");
    } finally {
      setIsLoadingMyBatches(false);
    }
  };

  // Fetch active batches & sessions for the selected date
  const fetchActiveBatches = async (filterDate: string) => {
    setIsLoadingActive(true);
    setActiveError(null);
    try {
      const data = await api.getActiveBatches({ filterDate, limit: 100 });
      setActiveBatchesData(data);
    } catch (err: any) {
      console.error("Failed to load active batches:", err);
      setActiveError(err?.message || "Failed to load active batches");
    } finally {
      setIsLoadingActive(false);
    }
  };

  useEffect(() => {
    setFinanceDrafts((prev) => {
      const next: Record<string, { approval_id: string; finance_status: string; finance_status_check_date: string; finance_check: number | null }> = {};
      batches.forEach((batch) => {
        const previous = prev[batch.id];
        next[batch.id] = {
          approval_id: previous?.approval_id !== undefined ? previous.approval_id : (batch.approval_id || ""),
          finance_status: previous?.finance_status || batch.finance_status || "Pending",
          finance_status_check_date: previous?.finance_status_check_date || batch.finance_status_check_date || "",
          finance_check: previous?.finance_check ?? batch.finance_check ?? null,
        };
      });
      return next;
    });
  }, [batches]);

  const updateFinanceDraft = (
    batchId: string,
    field: "approval_id" | "finance_status" | "finance_status_check_date" | "finance_check",
    value: string | number | null,
  ) => {
    setFinanceDrafts((prev) => ({
      ...prev,
      [batchId]: {
        approval_id: prev[batchId]?.approval_id ?? "",
        finance_status: prev[batchId]?.finance_status || "Pending",
        finance_status_check_date: prev[batchId]?.finance_status_check_date || "",
        finance_check: prev[batchId]?.finance_check ?? null,
        [field]: value,
      },
    }));
  };

  const saveFinanceBatch = async (batch: Batch) => {
    const draft = financeDrafts[batch.id];
    if (!draft) return;

    setSavingFinanceBatchId(batch.id);
    try {
      await api.updateBatch(batch.id, {
        approval_id: draft.approval_id?.trim() || null,
        finance_status: draft.finance_status || "Pending",
        finance_status_check_date: draft.finance_status_check_date || null,
        finance_check: draft.finance_check ?? null,
      });
      await fetchBatches(true);
      notifySuccess("Finance details saved");
    } catch (err: any) {
      notifyError("Failed to save finance details", err);
    } finally {
      setSavingFinanceBatchId(null);
    }
  };

  const saveAllDirtyFinanceBatches = async () => {
    const dirtyBatches = filteredFinanceBatches.filter((b) => {
      const draft = financeDrafts[b.id];
      if (!draft) return false;
      return (
        (draft.approval_id?.trim() || "") !== (b.approval_id || "") ||
        draft.finance_status !== (b.finance_status || "Pending") ||
        draft.finance_status_check_date !== (b.finance_status_check_date || "") ||
        (draft.finance_check ?? null) !== (b.finance_check ?? null)
      );
    });
    if (dirtyBatches.length === 0) return;
    setIsSavingAllFinance(true);
    try {
      // Settle every write so a single failure cannot leave the table in an
      // indeterminate saved/unsaved state.
      const results = await Promise.allSettled(
        dirtyBatches.map((b) => {
          const draft = financeDrafts[b.id];
          return api.updateBatch(b.id, {
            approval_id: draft.approval_id?.trim() || null,
            finance_status: draft.finance_status || "Pending",
            finance_status_check_date: draft.finance_status_check_date || null,
            finance_check: draft.finance_check ?? null,
          });
        })
      );

      const failed = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );

      if (failed.length > 0) {
        notifyError(
          failed.length === dirtyBatches.length
            ? `Failed to save ${failed.length} record${failed.length === 1 ? "" : "s"}`
            : `Saved ${results.length - failed.length} of ${results.length} records — ${failed.length} failed`,
          failed[0].reason
        );
      } else {
        notifySuccess(`Saved ${results.length} record${results.length === 1 ? "" : "s"}`);
      }

      // Always resync, since some rows may have persisted before the failure.
      await fetchBatches(true);
    } finally {
      setIsSavingAllFinance(false);
    }
  };

  // Fetch Analytics
  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const data = await api.getManagerDashboard();
      setDashboardSummary(data);
    } catch (err) {
      console.error("Failed to load manager analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Fetch Faculty utilization ledger
  const fetchFaculty = async () => {
    setIsLoadingFaculty(true);
    setFacultyError(null);
    try {
      const ledger = await api.getSessions();
      setFacultyUtilizationLedger(ledger ?? []);
    } catch (err: any) {
      console.error("Failed to load faculty utilization:", err);
      setFacultyError(err?.message || "Failed to load faculty utilization records");
      setFacultyUtilizationLedger([]);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Reset filters when switching views
      setStatusFilter("ALL");
      setDomainFilter("ALL");
      setCategoryFilter("ALL");

      if (activeView === "my_batches") {
        fetchMyBatches();
      } else if (activeView === "active_batches") {
        fetchActiveBatches(activeFilterDate);
      } else if (activeView === "manager_board") {
        fetchBatches();
        fetchAnalytics();
      } else if (activeView === "approvals") {
        fetchBatches(true);
      } else if (activeView === "finance") {
        fetchBatches(true);
      } else if (activeView === "analytics") {
        fetchAnalytics();
        fetchBatches(true);
        api.getUsers().then(setAllUsers).catch(() => {});
      } else if (activeView === "faculty") {
        fetchFaculty();
      }
    }
  }, [user, activeView]);

  // Re-fetch active batches when the filter date changes
  useEffect(() => {
    if (user && activeView === "active_batches") {
      setActiveBatchPage(1);
      setActiveSessionPage(1);
      fetchActiveBatches(activeFilterDate);
    }
  }, [activeFilterDate]);

  // Re-fetch batches when filter dropdowns change in manager board / analytics views
  useEffect(() => {
    if (user && activeView === "manager_board") {
      fetchBatches();
    }
  }, [statusFilter, domainFilter, categoryFilter]);

  // Auto-switch to the role's landing view on initial login
  useEffect(() => {
    const teamName = user?.team_name?.trim().toLowerCase();
    if (user && teamName === "finance" && activeView === "active_batches") {
      setActiveView("finance");
    } else if (user && user.role?.toLowerCase() === "manager" && activeView === "active_batches") {
      setActiveView("manager_board");
    } else if (
      user &&
      user.role?.toLowerCase() === "coordinator" &&
      teamName !== "finance" &&
      activeView === "active_batches"
    ) {
      // Coordinators create batches, so the schedule path has to be one click
      // away the moment they land.
      setActiveView("my_batches");
    }
  }, [user]);

  // Fetch all coordinators under the manager (includes direct reports + UserManagerMapping assignments)
  useEffect(() => {
    if (user) {
      api.getCoordinators().then((res) => setMyReports(res)).catch(() => setMyReports([]));
    }
  }, [user]);

  const hasReportingStaff = (user?.direct_reports_count ?? 0) > 0 || user?.is_manager || user?.role?.toLowerCase() === "manager" || user?.role?.toLowerCase() === "admin" || myReports.length > 0;

  useEffect(() => {
    const isFinanceTeam = user?.team_name?.trim().toLowerCase() === "finance";
    if (isFinanceTeam && (activeView === "analytics" || activeView === "manager_board")) {
      setActiveView("finance");
    } else if (!hasReportingStaff && (activeView === "analytics" || activeView === "manager_board")) {
      setActiveView("active_batches");
    } else if (isFinanceTeam && activeView === "my_batches") {
      // My Batches is hidden for Finance, so never strand them on an absent view.
      setActiveView("finance");
    }
  }, [hasReportingStaff, activeView, user?.team_name]);

  // Export MBR Excel Handler
  const handleExportMbr = async () => {
    setIsExportingMbr(true);
    try {
      await api.exportMbrReport();
    } catch (err: any) {
      notifyError("Failed to download MBR report", err);
    } finally {
      setIsExportingMbr(false);
    }
  };

  const approvalQueue = useMemo(
    () => batches.filter((b) => (
      user?.id && (
        (b.status === "Approval 1 Pending" && b.approver_1_id?.toLowerCase() === user.id.toLowerCase())
        || (b.status === "Approval 2 Pending" && b.approver_2_id?.toLowerCase() === user.id.toLowerCase())
      )
    )),
    [batches, user?.id]
  );

  const {
    search: approvalSearch,
    setSearch: setApprovalSearch,
    getFilter: getApprovalFilter,
    setFilter: setApprovalFilter,
    optionsFor: approvalFilterOptions,
    clearFilters: clearApprovalFilters,
    hasActiveFilters: hasApprovalFilters,
    activeFilterCount: approvalFilterCount,
    filteredRows: filteredApprovalQueue,
    filtersVersion: approvalFiltersVersion,
  } = useTableFilters<Batch>(approvalQueue, APPROVAL_FILTER_FIELDS, APPROVAL_SEARCH_ACCESSOR);

  const {
    sortKey: approvalSortKey,
    sortDir: approvalSortDir,
    sortedRows: sortedApprovalQueue,
    toggleSort: toggleApprovalSort,
    applySort: applyApprovalSort,
  } = useTableSort<Batch>(filteredApprovalQueue, APPROVAL_SORT_ACCESSORS, {
    descFirstKeys: APPROVAL_DESC_FIRST_KEYS,
  });

  const financeFilterFields = useMemo(
    () => [
      { key: "financeStatus", accessor: (b: Batch) => financeDrafts[b.id]?.finance_status || b.finance_status || "Pending" },
      { key: "domain", accessor: (b: Batch) => b.domain ?? null },
      { key: "mode", accessor: (b: Batch) => b.delivery_mode || "Online" },
      { key: "status", accessor: (b: Batch) => b.status },
    ],
    [financeDrafts]
  );

  const {
    search: financeSearch,
    setSearch: setFinanceSearch,
    getFilter: getFinanceFilter,
    setFilter: setFinanceFilter,
    optionsFor: financeFilterOptions,
    clearFilters: clearFinanceTableFilters,
    hasActiveFilters: hasFinanceTableFilters,
    activeFilterCount: financeTableFilterCount,
    filteredRows: financeControlFilteredBatches,
    filtersVersion: financeFiltersVersion,
  } = useTableFilters<Batch>(batches, financeFilterFields, FINANCE_SEARCH_ACCESSOR);

  // "ACTIVE" is a synthetic filter (the finance-relevant workflow statuses) and
  // the start-date range cannot be expressed as a plain column value match, so
  // both are applied here on top of the hook's output.
  const filteredFinanceBatches = useMemo(() => {
    return financeControlFilteredBatches.filter((batch) => {
      const startDate = batch.start_date ? batch.start_date.slice(0, 10) : "";
      const passesWorkflowFilter =
        financeStatusFilter === "ALL"
          ? true
          : financeStatusFilter === "ACTIVE"
          ? FINANCE_ACTIVE_STATUSES.has(batch.status)
          : batch.status === financeStatusFilter;

      return passesWorkflowFilter
        && (!financeStartDate || (startDate && startDate >= financeStartDate))
        && (!financeEndDate || (startDate && startDate <= financeEndDate));
    });
  }, [financeControlFilteredBatches, financeStatusFilter, financeStartDate, financeEndDate]);

  const financeSortAccessors = useMemo<SortAccessors<Batch>>(() => ({
    batchId: (b) => b.batch_id,
    client: (b) => b.client_name,
    program: (b) => b.program_name,
    category: (b) => b.category,
    technology: (b) => b.technology,
    domain: (b) => b.domain,
    mode: (b) => b.delivery_mode,
    location: (b) => b.location_city,
    startDate: (b) => b.start_date,
    endDate: (b) => b.end_date,
    enrollments: (b) => b.total_enrollments,
    trainingDays: (b) => b.training_days,
    totalHours: (b) => b.total_hours,
    sowNumber: (b) => b.sow_number,
    // Draft-aware columns: sorting must follow what the cell actually shows.
    approvalId: (b) => financeDrafts[b.id]?.approval_id ?? null,
    faculty: (b) => b.faculty_assigned_text,
    financeStatus: (b) => financeDrafts[b.id]?.finance_status ?? null,
    checkDate: (b) => financeDrafts[b.id]?.finance_status_check_date ?? null,
    status: (b) => b.status,
  }), [financeDrafts]);

  const {
    sortKey: financeSortKey,
    sortDir: financeSortDir,
    sortedRows: sortedFinanceBatches,
    toggleSort: toggleFinanceSort,
    applySort: applyFinanceSort,
  } = useTableSort<Batch>(filteredFinanceBatches, financeSortAccessors);

  const hasFinanceFilters = hasFinanceTableFilters
    || financeStatusFilter !== "ACTIVE"
    || !!financeStartDate
    || !!financeEndDate;

  const financeFilterCount = financeTableFilterCount
    + (financeStatusFilter !== "ACTIVE" ? 1 : 0)
    + (financeStartDate ? 1 : 0)
    + (financeEndDate ? 1 : 0);

  const clearFinanceFilters = () => {
    clearFinanceTableFilters();
    setFinanceStatusFilter("ACTIVE");
    setFinanceStartDate("");
    setFinanceEndDate("");
  };

  useEffect(() => {
    setApprovalPage(1);
  }, [approvalQueue.length, approvalFiltersVersion]);

  useEffect(() => {
    setFinancePage(1);
  }, [financeFiltersVersion, financeStatusFilter, financeStartDate, financeEndDate]);

  const paginatedApprovals = useMemo(() => {
    const start = (approvalPage - 1) * approvalPageSize;
    return sortedApprovalQueue.slice(start, start + approvalPageSize);
  }, [sortedApprovalQueue, approvalPage, approvalPageSize]);

  const paginatedFinanceBatches = useMemo(() => {
    const start = (financePage - 1) * financePageSize;
    return sortedFinanceBatches.slice(start, start + financePageSize);
  }, [sortedFinanceBatches, financePage, financePageSize]);

  // Track which finance rows have unsaved changes
  const dirtyFinanceIds = useMemo(() => {
    const dirty = new Set<string>();
    for (const b of batches) {
      const draft = financeDrafts[b.id];
      if (!draft) continue;
      if (
        (draft.approval_id?.trim() || "") !== (b.approval_id || "") ||
        draft.finance_status !== (b.finance_status || "Pending") ||
        draft.finance_status_check_date !== (b.finance_status_check_date || "") ||
        (draft.finance_check ?? null) !== (b.finance_check ?? null)
      ) {
        dirty.add(b.id);
      }
    }
    return dirty;
  }, [batches, financeDrafts]);

  const dirtyFinanceCount = dirtyFinanceIds.size;

  const exportFinanceSheet = async () => {
    try {
      await api.exportFinance({
        status_filter: financeStatusFilter === "ACTIVE" ? undefined : financeStatusFilter,
        finance_status: getFinanceFilter("financeStatus") || undefined,
        domain: getFinanceFilter("domain") || undefined,
        delivery_mode: getFinanceFilter("mode") || undefined,
        start_date: financeStartDate || undefined,
        end_date: financeEndDate || undefined,
      });
    } catch (err: any) {
      notifyError("Failed to export finance data", err);
    }
  };

  const isApprover = user?.is_configured_approver === true;
  // Finance access is granted by team membership. `User.role` is a fixed union
  // that does not include "finance", so testing it here was always false.
  const isFinanceViewAvailable = user?.team_name?.trim().toLowerCase() === "finance";
  const canCreateBatch = user?.role?.toLowerCase() !== "admin" && user?.team_name?.trim().toLowerCase() === "delivery";

  useEffect(() => {
    if (!isFinanceViewAvailable && activeView === "finance") {
      setActiveView("active_batches");
    }
  }, [isFinanceViewAvailable, activeView]);

  if (isAuthLoading || !user || user.role?.toLowerCase() === "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <RefreshCw className="animate-spin" size={32} color="#0b5cab" />
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Initializing Operations Platform...</span>
        </div>
      </div>
    );
  }

  const handleSubmitBatch = async (batch: Batch) => {
    try {
      await api.submitBatch(batch.id);
      await fetchBatches();
    } catch (err: any) {
      notifyError("Failed to submit batch for approval", err);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "requested") return <span className="badge badge-requested">Requested</span>;
    if (s === "approval 1 pending") return <span className="badge badge-requested">Approval 1 Pending</span>;
    if (s === "approval 2 pending") return <span className="badge badge-requested">Approval 2 Pending</span>;
    if (s === "approved") return <span className="badge badge-approved">Approved</span>;
    if (s === "upcoming") return <span className="badge badge-approved">Upcoming</span>;
    if (s === "ongoing") return <span className="badge badge-ongoing">Ongoing</span>;
    if (s === "completed") return <span className="badge badge-completed">Completed</span>;
    if (s === "onhold") return <span className="badge badge-onhold">On Hold</span>;
    if (s === "cancelled") return <span className="badge badge-cancelled">Cancelled</span>;
    return <span className="badge badge-cancelled">{status}</span>;
  };

  const getStatusBadgeColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "requested" || s.includes("pending")) return "#d97706";
    if (s === "approved" || s === "upcoming") return "#0b5cab";
    if (s === "ongoing") return "#06b6d4";
    if (s === "completed") return "#16a34a";
    if (s === "onhold") return "#b45309";
    if (s === "cancelled") return "#e11d48";
    return "#94a3b8";
  };

  return (
    <div className="dashboard-shell" style={{
      minHeight: "100vh",
      display: "flex",
      padding: "24px",
      gap: 24,
      alignItems: "stretch",
      justifyContent: "flex-start",
      background: "#f8fafc",
      boxSizing: "border-box",
    }}>
      {/* Modern Card Sidebar Matching Reference Design */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenCreateBatch={() => setIsCreateOpen(true)}
        pendingApprovalsCount={approvalQueue.length}
        onFilterCategory={(cat) => setCategoryFilter(cat)}
        activeCategoryFilter={categoryFilter}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignSelf: "stretch" }}>

        {/* VIEW 0: MY BATCHES (coordinator-owned, schedule-first) */}
        {activeView === "my_batches" && (
          <MyBatchesView
            data={myBatches}
            isLoading={isLoadingMyBatches}
            error={myBatchesError}
            onRefresh={fetchMyBatches}
            onOpenBatchDetail={(batch) => openBatchDetail(batch, "sessions")}
            canCreateBatch={canCreateBatch}
            onCreateBatch={() => setIsCreateOpen(true)}
            page={myBatchesPage}
            pageSize={myBatchesPageSize}
            onPageChange={setMyBatchesPage}
            onPageSizeChange={(newSize) => {
              setMyBatchesPageSize(newSize);
              setMyBatchesPage(1);
            }}
          />
        )}

        {/* VIEW 0: MANAGER LEVEL CONTROL BOARD */}
        {activeView === "manager_board" && (
          <ManagerBoard
            batches={batches}
            summary={dashboardSummary}
            reports={myReports}
            isLoading={isLoading || isLoadingAnalytics}
            onRefresh={() => {
              fetchBatches();
              fetchAnalytics();
            }}
            onOpenBatchDetail={(batch) => openBatchDetail(batch)}
            onOpenApproval={(batch) => setSelectedBatchForApproval(batch)}
            currentUser={user}
            onExportMbr={handleExportMbr}
            isExportingMbr={isExportingMbr}
          />
        )}

        {/* VIEW 1: ACTIVE BATCHES & SESSIONS */}
        {activeView === "active_batches" && (
          <ActiveBatchesView
            filterDate={activeFilterDate}
            onFilterDateChange={setActiveFilterDate}
            data={activeBatchesData}
            isLoading={isLoadingActive}
            error={activeError}
            batchPage={activeBatchPage}
            batchPageSize={activeBatchPageSize}
            onBatchPageChange={setActiveBatchPage}
            onBatchPageSizeChange={(newSize) => {
              setActiveBatchPageSize(newSize);
              setActiveBatchPage(1);
            }}
            sessionPage={activeSessionPage}
            sessionPageSize={activeSessionPageSize}
            onSessionPageChange={setActiveSessionPage}
            onSessionPageSizeChange={(newSize) => {
              setActiveSessionPageSize(newSize);
              setActiveSessionPage(1);
            }}
            onRefresh={() => fetchActiveBatches(activeFilterDate)}
          />
        )}

        {/* VIEW 2: APPROVAL QUEUE */}
        {activeView === "approvals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  Batch Approval Queue
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Review and approve batches waiting for governance clearance.
                </p>
              </div>
              <div style={{
                background: "#e8f2fb",
                border: "1px solid #bae6fd",
                color: "#0b5cab",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: "0.8rem",
                fontWeight: 700
              }}>
                {approvalQueue.length} pending item(s)
              </div>
            </div>

            <FullscreenTable
              style={{ flex: 1 }}
              title="Pending Approvals"
              contentStyle={{ flex: 1, display: "flex", flexDirection: "column" }}
              toolbar={
                <TableFilters
                  search={{
                    value: approvalSearch,
                    onChange: setApprovalSearch,
                    placeholder: "Search batch, client, program...",
                    width: 250,
                  }}
                  selects={[
                    {
                      key: "status",
                      label: "Status",
                      value: getApprovalFilter("status"),
                      onChange: (value) => setApprovalFilter("status", value),
                      options: approvalFilterOptions("status"),
                      allLabel: "All statuses",
                      width: 175,
                    },
                    {
                      key: "domain",
                      label: "Domain",
                      value: getApprovalFilter("domain"),
                      onChange: (value) => setApprovalFilter("domain", value),
                      options: approvalFilterOptions("domain"),
                      allLabel: "All domains",
                      width: 140,
                    },
                  ]}
                  sort={{
                    options: APPROVAL_SORT_OPTIONS,
                    sortKey: approvalSortKey,
                    sortDir: approvalSortDir,
                    onChange: applyApprovalSort,
                    width: 165,
                  }}
                  onClear={clearApprovalFilters}
                  hasActiveFilters={hasApprovalFilters}
                  activeFilterCount={approvalFilterCount}
                />
              }
              footer={
                <PaginationControls
                  currentPage={approvalPage}
                  totalItems={sortedApprovalQueue.length}
                  pageSize={approvalPageSize}
                  onPageChange={setApprovalPage}
                  onPageSizeChange={(newSize) => {
                    setApprovalPageSize(newSize);
                    setApprovalPage(1);
                  }}
                />
              }
            >
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <SortableHeaderCell columnKey="batchId" label="Batch" style={APPROVAL_TH_STYLE} sortKey={approvalSortKey} sortDir={approvalSortDir} onSort={toggleApprovalSort} />
                    <SortableHeaderCell columnKey="client" label="Client" style={APPROVAL_TH_STYLE} sortKey={approvalSortKey} sortDir={approvalSortDir} onSort={toggleApprovalSort} />
                    <SortableHeaderCell columnKey="mode" label="Mode" style={APPROVAL_TH_STYLE} sortKey={approvalSortKey} sortDir={approvalSortDir} onSort={toggleApprovalSort} />
                    <SortableHeaderCell columnKey="submittedOn" label="Submitted On" style={APPROVAL_TH_STYLE} sortKey={approvalSortKey} sortDir={approvalSortDir} onSort={toggleApprovalSort} />
                    <SortableHeaderCell columnKey="status" label="Status" style={APPROVAL_TH_STYLE} sortKey={approvalSortKey} sortDir={approvalSortDir} onSort={toggleApprovalSort} />
                    <PlainHeaderCell style={{ ...APPROVAL_TH_STYLE, textAlign: "right" }}>Action</PlainHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {sortedApprovalQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                        No batches are currently waiting for approval.
                      </td>
                    </tr>
                  ) : (
                    paginatedApprovals.map((b) => {
                      const submittedDays = b.batch_request_date
                        ? Math.floor((Date.now() - new Date(b.batch_request_date).getTime()) / 86400000)
                        : null;
                      const isUrgent = submittedDays !== null && submittedDays >= 3;
                      return (
                        <tr key={b.id} style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          fontSize: "0.875rem",
                          background: isUrgent ? "rgba(251, 191, 36, 0.08)" : undefined,
                        }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                              {b.batch_id}
                              {isUrgent && (
                                <span style={{ fontSize: "0.65rem", background: "#fef3c7", color: "#d97706", border: "1px solid #fcd34d", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>OVERDUE</span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{b.program_name}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{b.client_name || "Enterprise Client"}</div>
                            <div style={{ fontSize: "0.75rem", color: "#7c3aed", fontWeight: 600, marginTop: 2 }}>{b.domain || "IT/ITES"}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div>{b.delivery_mode || "Online"}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{b.location_city || "Remote"}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            {b.batch_request_date ? (
                              <>
                                <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                  {formatDate(b.batch_request_date)}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: submittedDays !== null && submittedDays >= 3 ? "#d97706" : "var(--text-muted)", marginTop: 2 }}>
                                  {submittedDays === 0 ? "Today" : `${submittedDays}d ago`}
                                </div>
                              </>
                            ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                          </td>
                          <td style={{ padding: "14px 16px" }}>{getStatusBadge(b.status)}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => setSelectedBatchForApproval(b)}
                              className="btn btn-primary"
                              style={{ padding: "5px 10px", fontSize: "0.775rem" }}
                            >
                              View Full Batch Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </FullscreenTable>
          </div>
        )}

        {/* VIEW 3: FINANCE REVIEW SHEET */}
        {activeView === "finance" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  Finance Review Sheet
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Excel-style batch review for finance tracking, approval status, and operational checks.
                </p>
              </div>
              <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", color: "#0f766e", borderRadius: 999, padding: "6px 12px", fontSize: "0.8rem", fontWeight: 700 }}>
                {filteredFinanceBatches.length} of {batches.length} batch rows
              </div>
            </div>

            {/* Finance Summary Stats */}
            {(() => {
              const pendingCount = batches.filter(b => (financeDrafts[b.id]?.finance_status || b.finance_status || "Pending") === "Pending").length;
              const clearedCount = batches.filter(b => (financeDrafts[b.id]?.finance_status || b.finance_status) === "Cleared").length;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending Review</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2, fontFamily: "var(--font-display)" }}>{pendingCount}</div>
                    </div>
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Clock size={17} color="#d97706" />
                    </div>
                  </div>

                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cleared</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2, fontFamily: "var(--font-display)" }}>{clearedCount}</div>
                    </div>
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={17} color="#16a34a" />
                    </div>
                  </div>

                  {dirtyFinanceCount > 0 && (
                    <div style={{ background: "#ffffff", border: "1px solid #fed7aa", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.05em" }}>Unsaved Rows</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ea580c", marginTop: 2, fontFamily: "var(--font-display)" }}>{dirtyFinanceCount}</div>
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: 6, background: "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "0.95rem" }}>✏️</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <FullscreenTable
              style={{ flex: 1 }}
              contentStyle={{ flex: 1, display: "flex", flexDirection: "column" }}
              toolbar={
                <TableFilters
                  search={{
                    value: financeSearch,
                    onChange: setFinanceSearch,
                    placeholder: "Search batch, client, program, SOW...",
                    width: 250,
                  }}
                  selects={[
                    {
                      key: "financeStatus",
                      label: "Finance Status",
                      value: getFinanceFilter("financeStatus"),
                      onChange: (value) => setFinanceFilter("financeStatus", value),
                      options: FINANCE_STATUS_OPTIONS,
                      allLabel: "All finance status",
                      width: 140,
                    },
                    {
                      key: "domain",
                      label: "Domain",
                      value: getFinanceFilter("domain"),
                      onChange: (value) => setFinanceFilter("domain", value),
                      options: financeFilterOptions("domain"),
                      allLabel: "All domains",
                      width: 120,
                    },
                    {
                      key: "mode",
                      label: "Mode",
                      value: getFinanceFilter("mode"),
                      onChange: (value) => setFinanceFilter("mode", value),
                      options: financeFilterOptions("mode"),
                      allLabel: "All modes",
                      width: 125,
                    },
                    {
                      key: "status",
                      label: "Status",
                      value: getFinanceFilter("status"),
                      onChange: (value) => setFinanceFilter("status", value),
                      options: financeFilterOptions("status"),
                      allLabel: "All statuses",
                      width: 165,
                    },
                  ]}
                  sort={{
                    options: FINANCE_SORT_OPTIONS,
                    sortKey: financeSortKey,
                    sortDir: financeSortDir,
                    onChange: applyFinanceSort,
                    width: 200,
                  }}
                  bespoke={[
                    {
                      key: "workflow",
                      label: "Workflow",
                      width: 160,
                      content: (
                        <select
                          value={financeStatusFilter}
                          onChange={(e) => setFinanceStatusFilter(e.target.value)}
                          className="glass-input"
                          style={FINANCE_FILTER_STYLE}
                        >
                          <option value="ACTIVE">Active batches</option>
                          <option value="ALL">All workflow status</option>
                          <option value="Approved">Approved</option>
                          <option value="Upcoming">Upcoming</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Completed">Completed</option>
                          <option value="Requested">Requested (Draft)</option>
                          <option value="Approval 1 Pending">Approval 1 Pending</option>
                          <option value="Approval 2 Pending">Approval 2 Pending</option>
                        </select>
                      ),
                    },
                    {
                      key: "startDate",
                      label: "Start Date",
                      width: 150,
                      content: (
                        <input
                          type="date"
                          value={financeStartDate}
                          onChange={(e) => setFinanceStartDate(e.target.value)}
                          className="glass-input"
                          title="Start date from"
                          aria-label="Start date from"
                          style={FINANCE_FILTER_STYLE}
                        />
                      ),
                    },
                    {
                      key: "endDate",
                      label: "End Date",
                      width: 150,
                      content: (
                        <input
                          type="date"
                          value={financeEndDate}
                          onChange={(e) => setFinanceEndDate(e.target.value)}
                          className="glass-input"
                          title="Start date to"
                          aria-label="Start date to"
                          style={FINANCE_FILTER_STYLE}
                        />
                      ),
                    },
                  ]}
                  onClear={clearFinanceFilters}
                  hasActiveFilters={hasFinanceFilters}
                  activeFilterCount={financeFilterCount}
                />
              }
              actions={
                <>
                  {dirtyFinanceCount > 0 && (
                    <button
                      onClick={saveAllDirtyFinanceBatches}
                      disabled={isSavingAllFinance}
                      className="btn btn-primary"
                      style={{ padding: "8px 11px", fontSize: "0.8rem", background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)", border: "1px solid #ea580c", opacity: isSavingAllFinance ? 0.7 : 1 }}
                      title={`Save all ${dirtyFinanceCount} unsaved row(s)`}
                    >
                      <Check size={15} />
                      <span>{isSavingAllFinance ? "Saving..." : `Save All (${dirtyFinanceCount})`}</span>
                    </button>
                  )}
                  <button onClick={exportFinanceSheet} className="btn btn-secondary" style={{ padding: "8px 11px", fontSize: "0.8rem" }} title="Export filtered finance rows to Excel">
                    <FileSpreadsheet size={16} />
                    <span>Export Excel</span>
                  </button>
                </>
              }
              footer={
                <PaginationControls
                  currentPage={financePage}
                  totalItems={filteredFinanceBatches.length}
                  pageSize={financePageSize}
                  onPageChange={setFinancePage}
                  onPageSizeChange={(newSize) => {
                    setFinancePageSize(newSize);
                    setFinancePage(1);
                  }}
                />
              }
            >
              <table className="glass-table" style={{ width: "100%", minWidth: "2200px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <SortableHeaderCell columnKey="batchId" label="Batch ID" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="client" label="Client" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="program" label="Program" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="category" label="Category" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="technology" label="Technology" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="domain" label="Domain" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="mode" label="Mode" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="location" label="Location" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="startDate" label="Start Date" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="endDate" label="End Date" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="enrollments" label="Enrollments" style={{ ...FINANCE_TH_STYLE, textAlign: "center" }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="trainingDays" label="Training Days" style={{ ...FINANCE_TH_STYLE, textAlign: "center" }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="totalHours" label="Total Hours" style={{ ...FINANCE_TH_STYLE, textAlign: "center" }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="sowNumber" label="SOW Number" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="approvalId" label="Approval ID" style={{ ...FINANCE_TH_STYLE, minWidth: 160 }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="faculty" label="Faculty" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="financeStatus" label="Finance Status" style={{ ...FINANCE_TH_STYLE, minWidth: 130 }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <SortableHeaderCell columnKey="checkDate" label="Check Date" style={{ ...FINANCE_TH_STYLE, minWidth: 150 }} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <PlainHeaderCell style={FINANCE_TH_STYLE}>Remarks</PlainHeaderCell>
                      <SortableHeaderCell columnKey="status" label="Status" style={FINANCE_TH_STYLE} sortKey={financeSortKey} sortDir={financeSortDir} onSort={toggleFinanceSort} />
                      <PlainHeaderCell style={{ ...FINANCE_TH_STYLE, textAlign: "center" }}>Action</PlainHeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinanceBatches.length === 0 ? (
                      <tr>
                        <td colSpan={21} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                          No batch data available for finance review.
                        </td>
                      </tr>
                    ) : (
                      paginatedFinanceBatches.map((b) => {
                        const draft = financeDrafts[b.id] || {
                          approval_id: b.approval_id || "",
                          finance_status: b.finance_status || "Pending",
                          finance_status_check_date: b.finance_status_check_date || "",
                          finance_check: b.finance_check ?? null,
                        };

                        return (
                          <tr key={b.id} style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            fontSize: "0.82rem",
                            background: dirtyFinanceIds.has(b.id) ? "rgba(251, 191, 36, 0.07)" : undefined,
                          }}>
                            <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--accent-primary)", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.batch_id}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.client_name || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", minWidth: 180 }}>{b.program_name}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.category || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.technology || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.domain || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.delivery_mode || "Online"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.location_city || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.start_date ? formatDate(b.start_date) : "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.end_date ? formatDate(b.end_date) : "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", textAlign: "center" }}>{b.total_enrollments}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", textAlign: "center" }}>{b.training_days || 0}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", textAlign: "center" }}>{b.total_hours || 0}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.sow_number || "—"}</td>
                            <td style={{ padding: "12px 14px", minWidth: 160 }}>
                              <input
                                type="text"
                                value={draft.approval_id}
                                onChange={(e) => updateFinanceDraft(b.id, "approval_id", e.target.value)}
                                placeholder="Approval ID..."
                                style={{
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #dbe7f3",
                                  background: "#fff",
                                  fontSize: "0.82rem",
                                  fontWeight: 600,
                                  color: "var(--text-main)",
                                  outline: "none",
                                }}
                              />
                            </td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.faculty_assigned_text || ""}>{b.faculty_assigned_text || "—"}</td>
                            <td style={{ padding: "12px 14px", minWidth: 130 }}>
                              <select
                                value={draft.finance_status}
                                onChange={(e) => updateFinanceDraft(b.id, "finance_status", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "7px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #dbe7f3",
                                  background: "#fff",
                                  fontSize: "0.82rem",
                                  fontWeight: 600,
                                  color: draft.finance_status === "Cleared" ? "#16a34a" : "#d97706",
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Cleared">Cleared</option>
                              </select>
                            </td>
                            <td style={{ padding: "12px 14px", minWidth: 150 }}>
                              <input
                                type="date"
                                value={draft.finance_status_check_date}
                                onChange={(e) => updateFinanceDraft(b.id, "finance_status_check_date", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "7px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #dbe7f3",
                                  background: "#fff",
                                  fontSize: "0.82rem",
                                }}
                              />
                            </td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.remarks || ""}>{b.remarks || "—"}</td>
                            <td style={{ padding: "12px 14px" }}>{getStatusBadge(b.status)}</td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <button
                                onClick={() => saveFinanceBatch(b)}
                                disabled={savingFinanceBatchId === b.id}
                                className="btn btn-primary"
                                style={{ padding: "5px 12px", fontSize: "0.75rem", opacity: savingFinanceBatchId === b.id ? 0.7 : 1 }}
                              >
                                {savingFinanceBatchId === b.id ? "Saving..." : "Save"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
            </FullscreenTable>
          </div>
        )}

        {/* VIEW 4: ENTERPRISE DASHBOARD */}
        {activeView === "analytics" && (
          <EnterpriseDashboard
            batches={batches}
            users={allUsers}
            currentUser={user}
            dashboardSummary={dashboardSummary}
            isLoading={isLoadingAnalytics}
          />
        )}

        {/* VIEW 3: FACULTY UTILIZATION LEDGER */}
        {activeView === "faculty" && (
          <FacultyUtilizationView
            data={facultyUtilizationLedger}
            isLoading={isLoadingFaculty}
            error={facultyError}
            onRefresh={fetchFaculty}
          />
        )}
        </main>

      {/* Modals & Drawers */}
      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onBatchCreated={() => {
          fetchBatches();
          if (activeView === "my_batches") fetchMyBatches();
        }}
      />

      <ApproveBatchModal
        batch={selectedBatchForApproval}
        isOpen={!!selectedBatchForApproval}
        onClose={() => setSelectedBatchForApproval(null)}
        onBatchApproved={() => fetchBatches()}
        canApprove={!!selectedBatchForApproval && approvalQueue.some((batch) => batch.id === selectedBatchForApproval.id)}
      />

      <BatchDetailDrawer
        batch={selectedBatchForDetail}
        isOpen={!!selectedBatchForDetail}
        onClose={() => setSelectedBatchForDetail(null)}
        onOpenApprove={(b) => setSelectedBatchForApproval(b)}
        canApprove={!!selectedBatchForDetail && approvalQueue.some((batch) => batch.id === selectedBatchForDetail.id)}
        onBatchUpdated={() => {
          fetchBatches();
          if (activeView === "my_batches") fetchMyBatches();
        }}
        initialTab={detailDrawerTab}
      />
    </div>
  );
}
