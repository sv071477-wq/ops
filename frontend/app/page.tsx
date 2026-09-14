"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  api, Batch, ManagerDashboardSummary, FacultyMember, FacultyUtilizationSummary, User
} from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { CreateBatchModal } from "@/components/CreateBatchModal";
import { ApproveBatchModal } from "@/components/ApproveBatchModal";
import { BatchDetailDrawer } from "@/components/BatchDetailDrawer";
import {
  Layers, Search, Filter, Plus, CheckCircle2, Clock, PlayCircle,
  Archive, Star, Eye, Lock, Building2, MapPin, Sparkles, RefreshCw,
  AlertTriangle, BarChart3, Download, Users, Briefcase, TrendingUp, Check,
  PlusCircle, Calendar, ShieldCheck
} from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // Top-level Navigation View
  const [activeView, setActiveView] = useState<"batches" | "analytics" | "faculty">("batches");

  // Direct reports state for managerial dashboard
  const [myReports, setMyReports] = useState<User[]>([]);

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Analytics state
  const [dashboardSummary, setDashboardSummary] = useState<ManagerDashboardSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isExportingMbr, setIsExportingMbr] = useState(false);

  // Faculty state
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [facultyUtilization, setFacultyUtilization] = useState<FacultyUtilizationSummary | null>(null);
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
    }
  }, [user, isAuthLoading, router]);

  // Fetch batches
  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const data = await api.getBatches({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        domain: domainFilter !== "ALL" ? domainFilter : undefined,
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setBatches(data);
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setIsLoading(false);
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
      const [facList, util] = await Promise.all([
        api.getFacultyList({ domain: facultyDomainFilter !== "ALL" ? facultyDomainFilter : undefined }).catch(() => []),
        api.getFacultyUtilization().catch(() => null),
      ]);
      setFacultyList(facList);
      setFacultyUtilization(util);
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
      } else if (activeView === "analytics") {
        fetchAnalytics();
      } else if (activeView === "faculty") {
        fetchFaculty();
      }
    }
  }, [user, activeView, statusFilter, domainFilter, categoryFilter, facultyDomainFilter]);

  // Fetch direct reports for logged-in user
  useEffect(() => {
    if (user) {
      api.getMyReports().then((res) => setMyReports(res)).catch(() => setMyReports([]));
    }
  }, [user]);

  const hasReportingStaff = (user?.direct_reports_count ?? 0) > 0 || user?.is_manager || user?.role?.toLowerCase() === "manager" || user?.role?.toLowerCase() === "admin" || myReports.length > 0;

  useEffect(() => {
    if (!hasReportingStaff && activeView === "analytics") {
      setActiveView("batches");
    }
  }, [hasReportingStaff, activeView]);

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

    const feedbackScores = batches.filter((b) => b.batch_avg_feedback).map((b) => Number(b.batch_avg_feedback));
    const avgFeedback = feedbackScores.length > 0 ? (feedbackScores.reduce((a, b) => a + b, 0) / feedbackScores.length).toFixed(2) : "4.85";

    return { total, requested, approved, ongoing, completed, avgFeedback };
  }, [batches]);

  if (isAuthLoading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <RefreshCw className="animate-spin" size={32} color="#0b5cab" />
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Initializing Operations Platform...</span>
        </div>
      </div>
    );
  }

  const canApprove = user.role === "Admin" || user.role === "Manager";

  const handleSubmitBatch = async (batch: Batch) => {
    try {
      await api.submitBatch(batch.id);
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || "Failed to submit batch for approval");
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "requested") return <span className="badge badge-requested">Requested</span>;
    if (s === "approval 1 pending") return <span className="badge badge-requested">Approval 1 Pending</span>;
    if (s === "approval 2 pending") return <span className="badge badge-requested">Approval 2 Pending</span>;
    if (s === "approved") return <span className="badge badge-approved">Approved</span>;
    if (s === "ongoing") return <span className="badge badge-ongoing">Ongoing</span>;
    if (s === "completed") return <span className="badge badge-completed">Completed</span>;
    return <span className="badge badge-cancelled">{status}</span>;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Navbar />

      <div style={{
        maxWidth: 1480,
        margin: "0 auto",
        width: "100%",
        padding: "24px 20px",
        flex: 1,
        display: "flex",
        gap: 24,
        alignItems: "flex-start"
      }}>
        {/* Unified Operational Sidebar */}
        <aside style={{
          width: 260,
          flexShrink: 0,
          position: "sticky",
          top: 84
        }}>
          <div className="glass-panel" style={{
            background: "#ffffff",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Unified Sidebar Actions & Navigation */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Quick Action: New Batch */}
              {user.role?.toLowerCase() !== "admin" && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    borderRadius: 6,
                    background: "#0b5cab",
                    color: "#ffffff",
                    border: "1px solid #0b5cab",
                    boxShadow: "0 2px 4px rgba(11, 92, 171, 0.2)",
                    cursor: "pointer"
                  }}
                >
                  <PlusCircle size={18} />
                  <span>New Batch</span>
                </button>
              )}

              {/* Schedule Ingestion */}
              <button
                onClick={() => setActiveView("batches")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 6,
                  border: activeView === "batches" ? "1px solid #38bdf8" : "1px solid #0b5cab",
                  background: activeView === "batches" ? "#08427b" : "#0b5cab",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: activeView === "batches"
                    ? "0 2px 6px rgba(11, 92, 171, 0.35), 0 0 0 1px #38bdf8"
                    : "0 2px 4px rgba(11, 92, 171, 0.2)",
                  opacity: activeView === "batches" ? 1 : 0.9,
                  transition: "all 0.15s"
                }}
              >
                <Layers size={18} color="#ffffff" />
                <span>Schedule Ingestion</span>
              </button>

              {/* Faculty Utilization */}
              <button
                onClick={() => setActiveView("faculty")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 6,
                  border: activeView === "faculty" ? "1px solid #38bdf8" : "1px solid #0b5cab",
                  background: activeView === "faculty" ? "#08427b" : "#0b5cab",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: activeView === "faculty"
                    ? "0 2px 6px rgba(11, 92, 171, 0.35), 0 0 0 1px #38bdf8"
                    : "0 2px 4px rgba(11, 92, 171, 0.2)",
                  opacity: activeView === "faculty" ? 1 : 0.9,
                  transition: "all 0.15s"
                }}
              >
                <Users size={18} color="#ffffff" />
                <span>Faculty Utilization</span>
              </button>

              {/* Leadership Oversight - Visible if there are people reporting under this person */}
              {hasReportingStaff && (
                <button
                  onClick={() => setActiveView("analytics")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 6,
                    border: activeView === "analytics" ? "1px solid #38bdf8" : "1px solid #0b5cab",
                    background: activeView === "analytics" ? "#08427b" : "#0b5cab",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: activeView === "analytics"
                      ? "0 2px 6px rgba(11, 92, 171, 0.35), 0 0 0 1px #38bdf8"
                      : "0 2px 4px rgba(11, 92, 171, 0.2)",
                    opacity: activeView === "analytics" ? 1 : 0.9,
                    transition: "all 0.15s"
                  }}
                >
                  <BarChart3 size={18} color="#ffffff" />
                  <span>Team Dashboard</span>
                </button>
              )}
            </div>

            {/* Department Assignment Footer */}
            <div style={{
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
              background: "#fafbfd",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: "0.775rem"
            }}>
              <div style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}>
                Department Assignment
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)" }}>Squad:</span>
                <strong style={{ color: "var(--text-main)" }}>{user.team_name || "Delivery"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)" }}>Role:</span>
                <strong style={{ color: "#0b5cab" }}>{user.role_detail?.name || user.role}</strong>
              </div>
              {hasReportingStaff && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>Direct Reports:</span>
                  <strong style={{ color: "#16a34a" }}>{myReports.length || user.direct_reports_count || 0} staff</strong>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, minWidth: 0 }}>

        {/* VIEW 1: BATCH OPERATIONS HUB */}
        {activeView === "batches" && (
          <>
            {/* Metric Cards Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 28
            }}>
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Total Batches
                  </span>
                  <Layers size={18} color="#0b5cab" />
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-main)", marginTop: 6, fontFamily: "var(--font-display)" }}>
                  {metrics.total}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Across all programs & verticals
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    In Review / Pending
                  </span>
                  <Clock size={18} color="#d97706" />
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#d97706", marginTop: 6, fontFamily: "var(--font-display)" }}>
                  {metrics.requested}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Awaiting SOW Approval
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Approved Batches
                  </span>
                  <CheckCircle2 size={18} color="#0b5cab" />
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0b5cab", marginTop: 6, fontFamily: "var(--font-display)" }}>
                  {metrics.approved}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Schema locked & ready
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Live Delivery
                  </span>
                  <PlayCircle size={18} color="#16a34a" />
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#16a34a", marginTop: 6, fontFamily: "var(--font-display)" }}>
                  {metrics.ongoing}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Active training sessions
                </div>
              </div>

              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Gate 1 Quality Avg
                  </span>
                  <Star size={18} color="#d97706" fill="#d97706" />
                </div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#b45309", marginTop: 6, fontFamily: "var(--font-display)" }}>
                  {metrics.avgFeedback} <span style={{ fontSize: "1rem", color: "var(--text-dim)", fontWeight: 500 }}>/ 5.0</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Module feedback score
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
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Active Batch Roster ({batches.length})
                </h3>
              </div>

              <div style={{ overflowX: "auto" }}>
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
                    ) : batches.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "48px 0" }}>
                          <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", fontWeight: 600 }}>No matching batches found</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>
                            Try clearing your search or filter parameters.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      batches.map((b) => (
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
                            <div style={{ color: "var(--text-main)" }}>{b.delivery_mode}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{b.location_city || "Remote"}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{b.training_days} days ({b.total_hours} hrs)</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                              {b.start_date ? new Date(b.start_date).toLocaleDateString() : "TBD"}
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
                                View Details & Sessions
                              </button>

                              {canApprove && (b.status === "Requested" || b.status.includes("Pending")) && (
                                <button
                                  onClick={() => setSelectedBatchForApproval(b)}
                                  className="btn btn-primary"
                                  style={{ padding: "5px 10px", fontSize: "0.775rem" }}
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* VIEW 2: EXECUTIVE ANALYTICS & MBR */}
        {activeView === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  Executive Operations Analytics & MBR Insights
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Real-time visibility across vertical delivery pipelines, quality gates, and faculty utilization.
                </p>
              </div>

              <button
                onClick={handleExportMbr}
                disabled={isExportingMbr}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Download size={16} />
                <span>{isExportingMbr ? "Generating..." : "Download Full MBR Report (.xlsx)"}</span>
              </button>
            </div>

            {isLoadingAnalytics || !dashboardSummary ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <RefreshCw className="animate-spin" size={28} color="#0b5cab" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "var(--text-muted)" }}>Calculating real-time analytics...</div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div className="glass-panel" style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Active Operating Batches
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0b5cab", marginTop: 4 }}>
                      {dashboardSummary.total_active_batches}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Approved, Upcoming & Ongoing
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Overall Net Promoter Score
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
                      {dashboardSummary.overall_avg_nps !== null ? `${dashboardSummary.overall_avg_nps} / 10` : "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Gate 2 Executive NPS Score
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Quality Gate 1 Average
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#b45309", marginTop: 4 }}>
                      {dashboardSummary.overall_avg_feedback !== null ? `${dashboardSummary.overall_avg_feedback} / 5.0` : "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Session feedback index
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Faculty Utilization Ratio
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
                      {dashboardSummary.faculty_utilization_ratio}%
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Deployed trainer capacity
                    </div>
                  </div>
                </div>

                {/* Vertical Distribution Breakdown */}
                <div className="glass-panel" style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 16px 0" }}>
                    Vertical Performance Breakdown
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    {dashboardSummary.vertical_distribution.map((v) => (
                      <div
                        key={v.vertical}
                        style={{
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 8,
                          padding: "16px 18px",
                          background: "#f8fafc"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0b5cab" }}>
                            {v.vertical}
                          </span>
                          <span style={{
                            background: "#e8f2fb",
                            color: "#0b5cab",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontWeight: 700
                          }}>
                            {v.active_batches} Active Batch(es)
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Average Feedback</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                              ⭐ {v.average_feedback > 0 ? `${v.average_feedback} / 5.0` : "Pending"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Pipeline Status</div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#16a34a", marginTop: 4 }}>
                              Operational
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Supervised Personnel & Direct Reports Panel */}
                <div className="glass-panel" style={{ padding: "22px 24px", background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                          Supervised Personnel & Reporting Squad
                        </h3>
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 12,
                          background: "#e8f2fb",
                          color: "#0b5cab",
                          border: "1px solid #bae6fd"
                        }}>
                          {myReports.length} Direct Report(s)
                        </span>
                      </div>
                      <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                        Staff reporting directly to you for batch delivery supervision, attendance, and operational coordination.
                      </p>
                    </div>
                  </div>

                  {myReports.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                      <Users size={32} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>No Direct Reports Assigned</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 4 }}>
                        When administrators assign team members reporting to your leadership line, they will appear here.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                            <th style={{ padding: "10px 14px" }}>Employee Name</th>
                            <th style={{ padding: "10px 14px" }}>Corporate Email</th>
                            <th style={{ padding: "10px 14px" }}>Assigned Role</th>
                            <th style={{ padding: "10px 14px" }}>Ops Squad</th>
                            <th style={{ padding: "10px 14px" }}>Account Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myReports.map((r) => (
                            <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.85rem" }}>
                              <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-main)" }}>
                                {r.full_name}
                              </td>
                              <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                                {r.email}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 4, background: "#e8f2fb", color: "#0b5cab", fontSize: "0.75rem", fontWeight: 600 }}>
                                  {r.role_detail?.name || r.role}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
                                {r.team_name || "Operations"}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: r.is_active ? "#16a34a" : "#94a3b8",
                                  fontSize: "0.8rem",
                                  fontWeight: 600
                                }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.is_active ? "#16a34a" : "#94a3b8" }} />
                                  {r.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
          </div>
        )}
        </main>
      </div>

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
      />

      <BatchDetailDrawer
        batch={selectedBatchForDetail}
        isOpen={!!selectedBatchForDetail}
        onClose={() => setSelectedBatchForDetail(null)}
        onOpenApprove={(b) => setSelectedBatchForApproval(b)}
        canApprove={canApprove}
        onBatchUpdated={() => fetchBatches()}
      />
    </div>
  );
}
