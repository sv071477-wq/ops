"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  api, Batch, ManagerDashboardSummary, FacultyMember, FacultyUtilizationSummary, TrainingSession, User
} from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { CreateBatchModal } from "@/components/CreateBatchModal";
import { ApproveBatchModal } from "@/components/ApproveBatchModal";
import { BatchDetailDrawer } from "@/components/BatchDetailDrawer";
import { ManagerBoard } from "@/components/ManagerBoard";
import { Sidebar } from "@/components/Sidebar";
import { EnterpriseDashboard } from "@/components/EnterpriseDashboard";
import {
  Layers, Search, Filter, Plus, CheckCircle2, Clock, PlayCircle,
  Archive, Eye, Lock, Building2, MapPin, Sparkles, RefreshCw,
  AlertTriangle, BarChart3, Download, Users, Briefcase, TrendingUp, Check,
  PlusCircle, Calendar, ShieldCheck, Maximize2, Minimize2, FileSpreadsheet,
  Kanban
} from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Top-level Navigation View
  const [activeView, setActiveView] = useState<"batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty">("batches");

  // Direct reports state for managerial dashboard
  const [myReports, setMyReports] = useState<User[]>([]);

  // All users for enterprise dashboard
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [financeDrafts, setFinanceDrafts] = useState<Record<string, {
    finance_status: string;
    finance_status_check_date: string;
    finance_check: number | null;
  }>>({});
  const [savingFinanceBatchId, setSavingFinanceBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Finance review sheet state
  const [isFinanceFullScreen, setIsFinanceFullScreen] = useState(false);
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeStatusFilter, setFinanceStatusFilter] = useState("ACTIVE"); // default: exclude draft/pending
  const [financeCheckStatusFilter, setFinanceCheckStatusFilter] = useState("ALL");
  const [financeDomainFilter, setFinanceDomainFilter] = useState("ALL");
  const [financeModeFilter, setFinanceModeFilter] = useState("ALL");
  const [financeStartDate, setFinanceStartDate] = useState("");
  const [financeEndDate, setFinanceEndDate] = useState("");
  const [isSavingAllFinance, setIsSavingAllFinance] = useState(false);

  // Analytics state
  const [dashboardSummary, setDashboardSummary] = useState<ManagerDashboardSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isExportingMbr, setIsExportingMbr] = useState(false);

  // Faculty state
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [facultyUtilization, setFacultyUtilization] = useState<FacultyUtilizationSummary | null>(null);
  const [facultyUtilizationLedger, setFacultyUtilizationLedger] = useState<TrainingSession[]>([]);
  const [facultyDomainFilter, setFacultyDomainFilter] = useState("ALL");
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBatchForApproval, setSelectedBatchForApproval] = useState<Batch | null>(null);
  const [selectedBatchForDetail, setSelectedBatchForDetail] = useState<Batch | null>(null);

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
        search: forApprovals ? undefined : searchQuery.trim() || undefined,
      });
      setBatches(data);
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setFinanceDrafts((prev) => {
      const next: Record<string, { finance_status: string; finance_status_check_date: string; finance_check: number | null }> = {};
      batches.forEach((batch) => {
        const previous = prev[batch.id];
        next[batch.id] = {
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
    field: "finance_status" | "finance_status_check_date" | "finance_check",
    value: string | number | null,
  ) => {
    setFinanceDrafts((prev) => ({
      ...prev,
      [batchId]: {
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
        finance_status: draft.finance_status || "Pending",
        finance_status_check_date: draft.finance_status_check_date || null,
        finance_check: draft.finance_check ?? null,
      });
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || "Failed to save finance details");
    } finally {
      setSavingFinanceBatchId(null);
    }
  };

  const saveAllDirtyFinanceBatches = async () => {
    const dirtyBatches = filteredFinanceBatches.filter((b) => {
      const draft = financeDrafts[b.id];
      if (!draft) return false;
      return (
        draft.finance_status !== (b.finance_status || "Pending") ||
        draft.finance_status_check_date !== (b.finance_status_check_date || "") ||
        (draft.finance_check ?? null) !== (b.finance_check ?? null)
      );
    });
    if (dirtyBatches.length === 0) return;
    setIsSavingAllFinance(true);
    try {
      await Promise.all(
        dirtyBatches.map((b) => {
          const draft = financeDrafts[b.id];
          return api.updateBatch(b.id, {
            finance_status: draft.finance_status || "Pending",
            finance_status_check_date: draft.finance_status_check_date || null,
            finance_check: draft.finance_check ?? null,
          });
        })
      );
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || "Failed to save some finance records");
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

  // Fetch Faculty
  const fetchFaculty = async () => {
    setIsLoadingFaculty(true);
    try {
      const [facList, util, ledger] = await Promise.all([
        api.getFacultyList({ domain: facultyDomainFilter !== "ALL" ? facultyDomainFilter : undefined }).catch(() => []),
        api.getFacultyUtilization().catch(() => null),
        api.getSessions().catch(() => []),
      ]);
      setFacultyList(facList);
      setFacultyUtilization(util);
      setFacultyUtilizationLedger(
        [...ledger].sort((a, b) => new Date(b.date_of_training).getTime() - new Date(a.date_of_training).getTime())
      );
    } catch (err) {
      console.error("Failed to load faculty data:", err);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (activeView === "batches") {
        fetchBatches();
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
  }, [user, activeView, statusFilter, domainFilter, categoryFilter, facultyDomainFilter]);

  // Auto-switch to manager_board on initial login for managers
  useEffect(() => {
    const teamName = user?.team_name?.trim().toLowerCase();
    if (user && teamName === "finance" && activeView === "batches") {
      setActiveView("finance");
    } else if (user && user.role?.toLowerCase() === "manager" && activeView === "batches") {
      setActiveView("manager_board");
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
      setActiveView("batches");
    }
  }, [hasReportingStaff, activeView, user?.team_name]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches();
  };

  // Export MBR Excel Handler
  const handleExportMbr = async () => {
    setIsExportingMbr(true);
    try {
      await api.exportMbrReport();
    } catch (err: any) {
      alert(err.message || "Failed to download MBR report");
    } finally {
      setIsExportingMbr(false);
    }
  };

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = batches.length;
    const requested = batches.filter((b) => b.status === "Requested" || b.status.includes("Pending")).length;
    const approved = batches.filter((b) => b.status === "Approved").length;
    const ongoing = batches.filter((b) => b.status === "Ongoing").length;
    const completed = batches.filter((b) => b.status === "Completed").length;

    return { total, requested, approved, ongoing, completed };
  }, [batches]);

  const approvalQueue = useMemo(
    () => batches.filter((b) => (
      user?.id && (
        (b.status === "Approval 1 Pending" && b.approver_1_id?.toLowerCase() === user.id.toLowerCase())
        || (b.status === "Approval 2 Pending" && b.approver_2_id?.toLowerCase() === user.id.toLowerCase())
      )
    )),
    [batches, user?.id]
  );

  const activeBatches = useMemo(
    () => user?.is_configured_approver === true
      ? batches.filter((b) => ["Approved", "Upcoming", "Ongoing"].includes(b.status))
      : batches,
    [batches, user?.is_configured_approver]
  );

  const FINANCE_ACTIVE_STATUSES = new Set(["Approved", "Upcoming", "Ongoing", "Completed"]);

  const filteredFinanceBatches = useMemo(() => {
    const search = financeSearch.trim().toLowerCase();
    return batches.filter((batch) => {
      const draft = financeDrafts[batch.id];
      const financeStatus = draft?.finance_status || batch.finance_status || "Pending";
      const searchable = [
        batch.batch_id,
        batch.client_name,
        batch.program_name,
        batch.domain,
        batch.delivery_mode,
        batch.location_city,
        batch.approval_id,
        batch.sow_number,
      ].join(" ").toLowerCase();
      const startDate = batch.start_date ? batch.start_date.slice(0, 10) : "";

      // "ACTIVE" is a synthetic filter: show only finance-relevant statuses
      const passesStatusFilter =
        financeStatusFilter === "ALL"
          ? true
          : financeStatusFilter === "ACTIVE"
          ? FINANCE_ACTIVE_STATUSES.has(batch.status)
          : batch.status === financeStatusFilter;

      return (!search || searchable.includes(search))
        && passesStatusFilter
        && (financeCheckStatusFilter === "ALL" || financeStatus === financeCheckStatusFilter)
        && (financeDomainFilter === "ALL" || batch.domain === financeDomainFilter)
        && (financeModeFilter === "ALL" || batch.delivery_mode === financeModeFilter)
        && (!financeStartDate || (startDate && startDate >= financeStartDate))
        && (!financeEndDate || (startDate && startDate <= financeEndDate));
    });
  }, [
    batches,
    financeDrafts,
    financeSearch,
    financeStatusFilter,
    financeCheckStatusFilter,
    financeDomainFilter,
    financeModeFilter,
    financeStartDate,
    financeEndDate,
  ]);

  // Track which finance rows have unsaved changes
  const dirtyFinanceIds = useMemo(() => {
    const dirty = new Set<string>();
    for (const b of batches) {
      const draft = financeDrafts[b.id];
      if (!draft) continue;
      if (
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

  const exportFinanceSheet = () => {
    const headers = ["Batch ID", "Client", "Program", "Domain", "Mode", "Location", "Enrollments", "Training Days", "Total Hours", "SOW Ref", "Finance Status", "Check Date", "Finance Check", "Status"];
    const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filteredFinanceBatches.map((batch) => {
      const draft = financeDrafts[batch.id] || {};
      return [
        batch.batch_id,
        batch.client_name || "",
        batch.program_name,
        batch.domain || "",
        batch.delivery_mode,
        batch.location_city || "",
        batch.total_enrollments,
        batch.training_days,
        batch.total_hours,
        batch.approval_id || batch.sow_number || "",
        draft.finance_status || batch.finance_status || "Pending",
        draft.finance_status_check_date || batch.finance_status_check_date || "",
        draft.finance_check ?? batch.finance_check ?? "",
        batch.status,
      ].map(escapeCell).join(",");
    });
    const csv = `\uFEFF${headers.map(escapeCell).join(",")}\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-review-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isApprover = user?.is_configured_approver === true;
  const isFinanceViewAvailable = user?.team_name?.trim().toLowerCase() === "finance";
  const canCreateBatch = user?.role?.toLowerCase() !== "admin" && user?.team_name?.trim().toLowerCase() === "delivery";

  useEffect(() => {
    if (!isFinanceViewAvailable && activeView === "finance") {
      setActiveView("batches");
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
      alert(err.message || "Failed to submit batch for approval");
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

  return (
    <div className="dashboard-shell" style={{
      minHeight: "100vh",
      display: "flex",
      padding: "16px 20px",
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
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCreateBatch={() => setIsCreateOpen(true)}
        pendingApprovalsCount={approvalQueue.length}
        onFilterCategory={(cat) => setCategoryFilter(cat)}
        activeCategoryFilter={categoryFilter}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignSelf: "stretch" }}>

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
            onOpenBatchDetail={(batch) => setSelectedBatchForDetail(batch)}
            onOpenApproval={(batch) => setSelectedBatchForApproval(batch)}
            currentUser={user}
            onExportMbr={handleExportMbr}
            isExportingMbr={isExportingMbr}
          />
        )}

        {/* VIEW 1: BATCH OPERATIONS HUB */}
        {activeView === "batches" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Metric Cards Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 28
            }}>
              <div className="glass-panel" style={{ padding: "18px 20px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,246,255,0.9))", borderColor: "rgba(137, 176, 218, 0.9)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Total Batches
                  </span>
                  <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(11, 92, 171, 0.1)" }}>
                    <Layers size={18} color="#0b5cab" />
                  </div>
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-main)", marginTop: 8, fontFamily: "var(--font-display)" }}>
                  {metrics.total}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Across all programs & verticals
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,249,235,0.9))", borderColor: "rgba(225, 177, 85, 0.8)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    In Review / Pending
                  </span>
                  <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(217, 119, 6, 0.10)" }}>
                    <Clock size={18} color="#d97706" />
                  </div>
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#d97706", marginTop: 8, fontFamily: "var(--font-display)" }}>
                  {metrics.requested}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Awaiting SOW Approval
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,249,255,0.9))", borderColor: "rgba(134, 167, 214, 0.75)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Approved Batches
                  </span>
                  <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(11, 92, 171, 0.10)" }}>
                    <CheckCircle2 size={18} color="#0b5cab" />
                  </div>
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0b5cab", marginTop: 8, fontFamily: "var(--font-display)" }}>
                  {metrics.approved}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Schema locked & ready
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px", background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,253,250,0.9))", borderColor: "rgba(128, 201, 167, 0.8)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Live Delivery
                  </span>
                  <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "rgba(22, 163, 74, 0.10)" }}>
                    <PlayCircle size={18} color="#16a34a" />
                  </div>
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#16a34a", marginTop: 8, fontFamily: "var(--font-display)" }}>
                  {metrics.ongoing}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Active training sessions
                </div>
              </div>

            </div>

            {/* Filter & Search Bar */}
            <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 300px" }}>
                  <div style={{ position: "relative", width: "100%" }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                    <input
                      type="text"
                      placeholder="Search by Program, Client, Technology, or Batch ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input"
                      style={{ paddingLeft: 38, width: "100%" }}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ padding: "8px 16px" }}>
                    Search
                  </button>
                </form>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Filter size={15} color="var(--text-dim)" />
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 600 }}>Status:</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input" style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
                      <option value="ALL">All Statuses</option>
                      <option value="Requested">Requested</option>
                      <option value="Approved">Approved</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 600 }}>Vertical:</span>
                    <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className="glass-input" style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
                      <option value="ALL">All Verticals</option>
                      <option value="IT/ITES">IT/ITES</option>
                      <option value="DS/ITES">DS/ITES</option>
                      <option value="BFSI">BFSI</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Batches Table */}
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Active Batch Roster ({activeBatches.length})
                </h3>
              </div>

              <div style={{ overflowX: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
                <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      <th style={{ padding: "12px 16px" }}>Batch & Curriculum</th>
                      <th style={{ padding: "12px 16px" }}>Client & Vertical</th>
                      <th style={{ padding: "12px 16px" }}>Delivery Mode & Venue</th>
                      <th style={{ padding: "12px 16px" }}>Schedule & Hours</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px 0" }}>
                          <RefreshCw className="animate-spin" size={24} color="#0b5cab" style={{ margin: "0 auto 8px auto" }} />
                          <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading batch records...</div>
                        </td>
                      </tr>
                    ) : activeBatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "48px 0" }}>
                          <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", fontWeight: 600 }}>No matching batches found</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>
                            Try clearing your search or filter parameters.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      activeBatches.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{b.batch_id}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>{b.program_name}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{b.client_name || "Enterprise Client"}</div>
                            <div style={{ fontSize: "0.75rem", color: "#7c3aed", fontWeight: 600, marginTop: 2 }}>{b.domain || "IT/ITES"}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ color: "var(--text-main)" }}>{b.delivery_mode || "Online"}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{b.location_city || "Remote"}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{b.training_days} days ({b.total_hours} hrs)</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                              {b.start_date ? formatDate(b.start_date) : "TBD"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            {getStatusBadge(b.status)}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              <button
                                onClick={() => setSelectedBatchForDetail(b)}
                                className="btn btn-secondary"
                                style={{ padding: "5px 10px", fontSize: "0.775rem" }}
                              >
                                View Full Batch Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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

            <div className="glass-panel" style={{ padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Pending Approvals
                </h3>
              </div>

              <div style={{ overflowX: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
                <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      <th style={{ padding: "12px 16px" }}>Batch</th>
                      <th style={{ padding: "12px 16px" }}>Client</th>
                      <th style={{ padding: "12px 16px" }}>Mode</th>
                      <th style={{ padding: "12px 16px" }}>Submitted On</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                          No batches are currently waiting for approval.
                        </td>
                      </tr>
                    ) : (
                      approvalQueue.map((b) => {
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
                                onClick={() => setSelectedBatchForDetail(b)}
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
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: FINANCE REVIEW SHEET */}
        {activeView === "finance" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
            ...(isFinanceFullScreen ? {
              position: "fixed",
              inset: 0,
              zIndex: 100,
              overflow: "auto",
              padding: "24px",
              background: "#f8fbff",
            } : {})
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Pending", count: pendingCount, bg: "#fef9ec", border: "#fcd34d", color: "#d97706" },
                    { label: "Cleared", count: clearedCount, bg: "#f0fdf4", border: "#86efac", color: "#16a34a" },
                  ].map(({ label, count, bg, border, color }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color, fontFamily: "var(--font-display)" }}>{count}</div>
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${border}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "1.1rem" }}>{label === "Pending" ? "⏳" : "✅"}</span>
                      </div>
                    </div>
                  ))}
                  {dirtyFinanceCount > 0 && (
                    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.05em" }}>Unsaved</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ea580c", fontFamily: "var(--font-display)" }}>{dirtyFinanceCount}</div>
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fed7aa55", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "1.1rem" }}>✏️</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="glass-panel" style={{ padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                  <input
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    placeholder="Search batch, client, program, SOW..."
                    className="glass-input"
                    style={{ width: 250, padding: "8px 10px", fontSize: "0.8rem" }}
                  />
                  <select value={financeStatusFilter} onChange={(e) => setFinanceStatusFilter(e.target.value)} className="glass-input" style={{ width: 155, padding: "8px 10px", fontSize: "0.8rem" }}>
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
                  <select value={financeCheckStatusFilter} onChange={(e) => setFinanceCheckStatusFilter(e.target.value)} className="glass-input" style={{ width: 140, padding: "8px 10px", fontSize: "0.8rem" }}>
                    <option value="ALL">All finance status</option>
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                  </select>
                  <select value={financeDomainFilter} onChange={(e) => setFinanceDomainFilter(e.target.value)} className="glass-input" style={{ width: 120, padding: "8px 10px", fontSize: "0.8rem" }}>
                    <option value="ALL">All domains</option>
                    {[...new Set(batches.map((b) => b.domain).filter(Boolean))].map((domain) => <option key={domain} value={domain || ""}>{domain}</option>)}
                  </select>
                  <select value={financeModeFilter} onChange={(e) => setFinanceModeFilter(e.target.value)} className="glass-input" style={{ width: 125, padding: "8px 10px", fontSize: "0.8rem" }}>
                    <option value="ALL">All modes</option>
                    {[...new Set(batches.map((b) => b.delivery_mode || "Online").filter(Boolean))].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                  <input type="date" value={financeStartDate} onChange={(e) => setFinanceStartDate(e.target.value)} className="glass-input" title="Start date from" style={{ width: 135, padding: "8px 10px", fontSize: "0.8rem" }} />
                  <input type="date" value={financeEndDate} onChange={(e) => setFinanceEndDate(e.target.value)} className="glass-input" title="Start date to" style={{ width: 135, padding: "8px 10px", fontSize: "0.8rem" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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
                  <button onClick={() => setIsFinanceFullScreen((value) => !value)} className="btn btn-primary" style={{ padding: "8px 11px", fontSize: "0.8rem" }} title={isFinanceFullScreen ? "Exit full screen" : "Open full screen"}>
                    {isFinanceFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    <span>{isFinanceFullScreen ? "Exit Full Screen" : "Full Screen"}</span>
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
                <table className="glass-table" style={{ width: "100%", minWidth: "2200px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Batch ID</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Client</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Program</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Category</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Technology</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Domain</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Mode</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Location</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Start Date</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>End Date</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Enrollments</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Training Days</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Total Hours</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>SOW Ref</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Faculty</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Finance Status</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Check Date</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Remarks</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Status</th>
                      <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinanceBatches.length === 0 ? (
                      <tr>
                        <td colSpan={20} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                          No batch data available for finance review.
                        </td>
                      </tr>
                    ) : (
                      filteredFinanceBatches.map((b) => {
                        const draft = financeDrafts[b.id] || {
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
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", whiteSpace: "nowrap" }}>{b.approval_id || b.sow_number || "—"}</td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.faculty_assigned_text || ""}>{b.faculty_assigned_text || "—"}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <select
                                value={draft.finance_status}
                                onChange={(e) => updateFinanceDraft(b.id, "finance_status", e.target.value)}
                                style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid #dbe7f3", background: "#fff" }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Cleared">Cleared</option>
                              </select>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <input
                                type="date"
                                value={draft.finance_status_check_date}
                                onChange={(e) => updateFinanceDraft(b.id, "finance_status_check_date", e.target.value)}
                                style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid #dbe7f3", background: "#fff" }}
                              />
                            </td>
                            <td style={{ padding: "12px 14px", userSelect: "text", cursor: "text", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.remarks || ""}>{b.remarks || "—"}</td>
                            <td style={{ padding: "12px 14px" }}>{getStatusBadge(b.status)}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <button
                                onClick={() => saveFinanceBatch(b)}
                                disabled={savingFinanceBatchId === b.id}
                                className="btn btn-primary"
                                style={{ padding: "5px 10px", fontSize: "0.75rem", opacity: savingFinanceBatchId === b.id ? 0.7 : 1 }}
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
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: ENTERPRISE DASHBOARD */}
        {activeView === "analytics" && (
          <EnterpriseDashboard
            batches={batches}
            users={allUsers}
            dashboardSummary={dashboardSummary}
            isLoading={isLoadingAnalytics}
          />
        )}

        {/* VIEW 3: FACULTY DIRECTORY & UTILIZATION */}
        {activeView === "faculty" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  Faculty Roster & Utilization Index
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Trainer capacity, domain assignments, and real-time scheduling workload.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 600 }}>Filter Domain:</span>
                <select
                  value={facultyDomainFilter}
                  onChange={(e) => setFacultyDomainFilter(e.target.value)}
                  className="glass-input"
                  style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                >
                  <option value="ALL">All Domains</option>
                  <option value="IT/ITES">IT/ITES</option>
                  <option value="DS/ITES">DS/ITES</option>
                  <option value="BFSI">BFSI</option>
                </select>
              </div>
            </div>

            {/* Utilization stats cards */}
            {facultyUtilization && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div className="glass-panel" style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Total Faculty Pool
                  </div>
                  <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0b5cab", marginTop: 4 }}>
                    {facultyUtilization.total_faculty_count}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Registered instructors
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Active Deployed
                  </div>
                  <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
                    {facultyUtilization.active_deployed_faculty}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    With active batch sessions
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Utilization Ratio
                  </div>
                  <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
                    {facultyUtilization.overall_utilization_percentage}%
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Deployment efficiency
                  </div>
                </div>
              </div>
            )}

            {/* Faculty Table */}
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <th style={{ padding: "12px 16px" }}>Faculty Member</th>
                    <th style={{ padding: "12px 16px" }}>Corporate Email</th>
                    <th style={{ padding: "12px 16px" }}>Specialization Domain</th>
                    <th style={{ padding: "12px 16px" }}>Type</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingFaculty ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "36px 0" }}>
                        <RefreshCw className="animate-spin" size={24} color="#0b5cab" style={{ margin: "0 auto 8px" }} />
                        <div style={{ color: "var(--text-muted)" }}>Loading faculty roster...</div>
                      </td>
                    </tr>
                  ) : facultyList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                        No faculty members found in this vertical.
                      </td>
                    </tr>
                  ) : (
                    facultyList.map((f) => (
                      <tr key={f.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                          {f.full_name}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)" }}>
                          {f.email}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: "#e8f2fb",
                            color: "#0b5cab"
                          }}>
                            {f.domain || "IT/ITES"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: "0.825rem" }}>
                          {f.faculty_type || "Internal Core"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: f.is_active ? "#16a34a" : "#94a3b8",
                            fontSize: "0.8rem",
                            fontWeight: 600
                          }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.is_active ? "#16a34a" : "#94a3b8" }} />
                            {f.is_active ? "Available" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", background: "#f8fafc" }}>
                <div style={{ fontWeight: 800, color: "var(--text-main)", letterSpacing: "0.02em", textTransform: "uppercase", fontSize: "0.8rem" }}>
                  Live Utilization Ledger
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {facultyUtilizationLedger.length} DB-backed records
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="glass-table" style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.77rem", color: "var(--text-dim)" }}>
                      <th style={{ padding: "12px 14px" }}>Date</th>
                      <th style={{ padding: "12px 14px" }}>Faculty</th>
                      <th style={{ padding: "12px 14px" }}>Topic</th>
                      <th style={{ padding: "12px 14px" }}>Hours</th>
                      <th style={{ padding: "12px 14px" }}>City</th>
                      <th style={{ padding: "12px 14px" }}>Venue</th>
                      <th style={{ padding: "12px 14px" }}>Mode</th>
                      <th style={{ padding: "12px 14px" }}>Status</th>
                      <th style={{ padding: "12px 14px" }}>Feedback</th>
                      <th style={{ padding: "12px 14px" }}>Notes</th>
                      <th style={{ padding: "12px 14px" }}>Outcome</th>
                      <th style={{ padding: "12px 14px" }}>Replacement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingFaculty ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
                          Loading utilization ledger...
                        </td>
                      </tr>
                    ) : facultyUtilizationLedger.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
                          No logged delivery records yet.
                        </td>
                      </tr>
                    ) : (
                      facultyUtilizationLedger.slice(0, 25).map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.825rem", verticalAlign: "top" }}>
                          <td style={{ padding: "12px 14px", color: "var(--text-main)", fontWeight: 600 }}>
                            {formatDate(row.date_of_training)}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-main)" }}>
                            {row.faculty_name || "—"}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-main)", maxWidth: 240 }}>
                            <div style={{ whiteSpace: "normal" }}>{row.topic || "—"}</div>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                            {row.no_of_hours ?? "—"}h
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                            {row.location_city || "—"}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                            {row.venue || "—"}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#e8f2fb",
                              color: "#0b5cab",
                              fontWeight: 700,
                              fontSize: "0.72rem"
                            }}>
                              {row.mode_of_delivery || "Online"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: row.status === "Completed" ? "#f0fdf4" : row.status === "Cancelled" ? "#fef2f2" : row.status === "InProgress" ? "#fff7ed" : "#e8f2fb",
                              color: row.status === "Completed" ? "#166534" : row.status === "Cancelled" ? "#b91c1c" : row.status === "InProgress" ? "#b45309" : "#0b5cab",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontWeight: 700,
                              fontSize: "0.72rem"
                            }}>
                              {row.status || "Scheduled"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                            {row.feedback_rating ?? row.rating ?? "—"}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)", maxWidth: 200 }}>
                            <div style={{ whiteSpace: "normal" }}>{row.feedback_notes || "—"}</div>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)", maxWidth: 200 }}>
                            <div style={{ whiteSpace: "normal" }}>{row.outcome_reason || "—"}</div>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)", maxWidth: 160 }}>
                            {row.replacement_session_id || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </main>

      {/* Modals & Drawers */}
      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onBatchCreated={() => fetchBatches()}
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
        onBatchUpdated={() => fetchBatches()}
      />
    </div>
  );
}
