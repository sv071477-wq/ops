"use client";

import React, { useState, useMemo } from "react";
import {
  Batch,
  ManagerDashboardSummary,
  User,
} from "@/lib/api";
import {
  Kanban,
  BarChart3,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Clock,
  PlayCircle,
  CheckCircle2,
  Users,
  Building2,
  Calendar,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Flame,
} from "lucide-react";

interface ManagerBoardProps {
  batches: Batch[];
  summary: ManagerDashboardSummary | null;
  reports: User[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenBatchDetail: (batch: Batch) => void;
  onOpenApproval: (batch: Batch) => void;
  currentUser: User | null;
  onExportMbr: () => void;
  isExportingMbr: boolean;
}

type BoardViewMode = "kanban" | "executive";

interface KanbanStage {
  id: string;
  title: string;
  subtitle: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
  icon: React.ElementType;
  filterFn: (batch: Batch) => boolean;
}

export const ManagerBoard: React.FC<ManagerBoardProps> = ({
  batches,
  summary,
  reports,
  isLoading,
  onRefresh,
  onOpenBatchDetail,
  onOpenApproval,
  currentUser,
  onExportMbr,
  isExportingMbr,
}) => {
  const [viewMode, setViewMode] = useState<BoardViewMode>("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);

  // Extract distinct domains for filter dropdown
  const domainList = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => {
      if (b.domain) set.add(b.domain);
    });
    return Array.from(set).sort();
  }, [batches]);

  // Kanban Stage Definitions
  const stages: KanbanStage[] = useMemo(() => [
    {
      id: "draft",
      title: "Draft & Requested",
      subtitle: "New intake awaiting setup",
      badgeBg: "#f1f5f9",
      badgeColor: "#475569",
      borderColor: "#cbd5e1",
      icon: Clock,
      filterFn: (b) => b.status === "Requested",
    },
    {
      id: "l1_pending",
      title: "Level 1 Review",
      subtitle: "Coordinator verification",
      badgeBg: "#fef3c7",
      badgeColor: "#d97706",
      borderColor: "#fcd34d",
      icon: ShieldCheck,
      filterFn: (b) => b.status === "Approval 1 Pending",
    },
    {
      id: "l2_pending",
      title: "Level 2 Manager Action",
      subtitle: "Requires your sign-off",
      badgeBg: "#f3e8ff",
      badgeColor: "#7c3aed",
      borderColor: "#d8b4fe",
      icon: AlertTriangle,
      filterFn: (b) => b.status === "Approval 2 Pending",
    },
    {
      id: "inflight",
      title: "In-Flight Delivery",
      subtitle: "Active training sessions",
      badgeBg: "#eff6ff",
      badgeColor: "#0284c7",
      borderColor: "#93c5fd",
      icon: PlayCircle,
      filterFn: (b) => b.status === "Approved" || b.status === "Upcoming" || (b.status === "Ongoing" && (!b.batch_nps)),
    },
    {
      id: "gate2_closure",
      title: "Gate 2 NPS Closure",
      subtitle: "Delivery done • Needs NPS",
      badgeBg: "#fff1f2",
      badgeColor: "#e11d48",
      borderColor: "#fda4af",
      icon: Award,
      filterFn: (b) => {
        if (b.status === "Completed") return false;
        const isPastEnd = b.end_date ? new Date(b.end_date).getTime() < Date.now() : false;
        return (b.status === "Ongoing" || b.status === "Approved" || isPastEnd) && b.batch_nps === null;
      },
    },
    {
      id: "completed",
      title: "Completed & Locked",
      subtitle: "NPS logged & archived",
      badgeBg: "#ecfdf5",
      badgeColor: "#059669",
      borderColor: "#a7f3d0",
      icon: CheckCircle2,
      filterFn: (b) => b.status === "Completed",
    },
  ], []);

  // Filtered Batches based on Search, Domain, and Urgency
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          b.batch_id.toLowerCase().includes(q) ||
          b.program_name.toLowerCase().includes(q) ||
          (b.client_name && b.client_name.toLowerCase().includes(q)) ||
          (b.sow_number && b.sow_number.toLowerCase().includes(q)) ||
          (b.domain && b.domain.toLowerCase().includes(q)) ||
          (b.faculty_assigned_text && b.faculty_assigned_text.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Domain matching
      if (selectedDomain !== "ALL" && b.domain !== selectedDomain) {
        return false;
      }

      // Urgency matching: > 3 days pending approval or pending closure past end date
      if (showUrgentOnly) {
        const daysPending = b.batch_request_date
          ? Math.floor((Date.now() - new Date(b.batch_request_date).getTime()) / 86400000)
          : 0;
        const isOverdueApproval = b.status.includes("Pending") && daysPending >= 3;
        const isOverdueClosure = b.end_date && new Date(b.end_date).getTime() < Date.now() && !b.batch_nps;
        return isOverdueApproval || isOverdueClosure;
      }

      return true;
    });
  }, [batches, searchQuery, selectedDomain, showUrgentOnly]);

  // Quick statistics calculated on the fly
  const quickStats = useMemo(() => {
    const l2Count = batches.filter((b) => b.status === "Approval 2 Pending").length;
    const activeCount = batches.filter((b) => ["Approved", "Upcoming", "Ongoing"].includes(b.status)).length;
    const overdueCount = batches.filter((b) => {
      const days = b.batch_request_date
        ? Math.floor((Date.now() - new Date(b.batch_request_date).getTime()) / 86400000)
        : 0;
      return b.status.includes("Pending") && days >= 3;
    }).length;
    return { l2Count, activeCount, overdueCount };
  }, [batches]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header & View Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: 0, letterSpacing: "-0.02em" }}>
              Manager Control Board
            </h2>
            <span style={{
              background: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #bae6fd",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}>
              Operational Pipeline
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Real-time managerial board across intake, approvals, session delivery, and quality checkpoints.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* View Mode Toggle Button Group */}
          <div style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 3,
            border: "1px solid var(--border-subtle)",
          }}>
            <button
              onClick={() => setViewMode("kanban")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: "0.825rem",
                fontWeight: 700,
                cursor: "pointer",
                background: viewMode === "kanban" ? "#ffffff" : "transparent",
                color: viewMode === "kanban" ? "#0b5cab" : "var(--text-muted)",
                boxShadow: viewMode === "kanban" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Kanban size={15} />
              <span>Pipeline Stages</span>
            </button>
            <button
              onClick={() => setViewMode("executive")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: "0.825rem",
                fontWeight: 700,
                cursor: "pointer",
                background: viewMode === "executive" ? "#ffffff" : "transparent",
                color: viewMode === "executive" ? "#0b5cab" : "var(--text-muted)",
                boxShadow: viewMode === "executive" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              <BarChart3 size={15} />
              <span>Executive Oversight</span>
            </button>
          </div>

          <button
            onClick={onExportMbr}
            disabled={isExportingMbr}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", fontSize: "0.825rem" }}
          >
            <Download size={15} />
            <span>{isExportingMbr ? "Generating..." : "Export MBR (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="glass-panel" style={{ padding: "16px 18px", borderLeft: "4px solid #0b5cab" }}>
          <div style={{ fontSize: "0.725rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Active Operating Batches
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0b5cab", marginTop: 4 }}>
            {summary?.total_active_batches ?? quickStats.activeCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Approved, Upcoming & Ongoing
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 18px", borderLeft: "4px solid #7c3aed" }}>
          <div style={{ fontSize: "0.725rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Delivered Training Hours
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
            {summary?.total_hours_delivered ? `${summary.total_hours_delivered}h` : "0.0h"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Completed session curriculum
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 18px", borderLeft: "4px solid #16a34a" }}>
          <div style={{ fontSize: "0.725rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Gate 2 NPS Rating
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
            {summary?.overall_avg_nps !== null && summary?.overall_avg_nps !== undefined ? `${summary.overall_avg_nps} / 10` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Executive Net Promoter Score
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 18px", borderLeft: "4px solid #d97706" }}>
          <div style={{ fontSize: "0.725rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Gate 1 Session Quality
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#d97706", marginTop: 4 }}>
            {summary?.overall_avg_feedback !== null && summary?.overall_avg_feedback !== undefined ? `⭐ ${summary.overall_avg_feedback} / 5` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Cumulative trainer ratings
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 18px", borderLeft: "4px solid #dc2626" }}>
          <div style={{ fontSize: "0.725rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Urgent Manager Action
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#dc2626", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            {quickStats.l2Count + quickStats.overdueCount}
            {(quickStats.l2Count + quickStats.overdueCount > 0) && (
              <Flame size={20} color="#dc2626" />
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            {quickStats.l2Count} L2 Sign-offs • {quickStats.overdueCount} Overdue
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              type="text"
              placeholder="Search by ID, client, program, trainer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
              style={{ paddingLeft: 32, fontSize: "0.825rem", width: "100%" }}
            />
          </div>

          {/* Domain Dropdown */}
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="glass-input"
            style={{ fontSize: "0.825rem", minWidth: 160 }}
          >
            <option value="ALL">All Domains ({domainList.length})</option>
            {domainList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Overdue / Urgent Only Filter Toggle */}
          <button
            onClick={() => setShowUrgentOnly(!showUrgentOnly)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              border: showUrgentOnly ? "1px solid #f87171" : "1px solid var(--border-subtle)",
              background: showUrgentOnly ? "#fef2f2" : "#ffffff",
              color: showUrgentOnly ? "#dc2626" : "var(--text-muted)",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <Flame size={14} color={showUrgentOnly ? "#dc2626" : "#94a3b8"} />
            <span>Urgent Attention Only</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.8rem" }}
            title="Refresh Board"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: PIPELINE KANBAN BOARD */}
      {viewMode === "kanban" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(280px, 1fr))",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 16,
        }}>
          {stages.map((stage) => {
            const stageBatches = filteredBatches.filter(stage.filterFn);
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                style={{
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: `1px solid ${stage.borderColor}`,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 520,
                  maxHeight: "calc(100vh - 280px)",
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: "12px 14px",
                  borderBottom: `1px solid ${stage.borderColor}`,
                  background: "#ffffff",
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={16} color={stage.badgeColor} />
                      <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "var(--text-main)" }}>
                        {stage.title}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {stage.subtitle}
                    </div>
                  </div>

                  <span style={{
                    background: stage.badgeBg,
                    color: stage.badgeColor,
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}>
                    {stageBatches.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div style={{
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  overflowY: "auto",
                  flex: 1,
                }}>
                  {stageBatches.length === 0 ? (
                    <div style={{
                      textAlign: "center",
                      padding: "36px 12px",
                      color: "var(--text-dim)",
                      fontSize: "0.8rem",
                    }}>
                      No batches in this stage
                    </div>
                  ) : (
                    stageBatches.map((batch) => {
                      const daysPending = batch.batch_request_date
                        ? Math.floor((Date.now() - new Date(batch.batch_request_date).getTime()) / 86400000)
                        : null;
                      const isOverdue = daysPending !== null && daysPending >= 3 && batch.status.includes("Pending");

                      return (
                        <div
                          key={batch.id}
                          className="glass-panel"
                          style={{
                            padding: "12px 14px",
                            background: isOverdue ? "#fffbfb" : "#ffffff",
                            border: isOverdue ? "1px solid #fca5a5" : "1px solid var(--border-subtle)",
                            borderRadius: 10,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                            cursor: "pointer",
                            transition: "all 0.15s ease-in-out",
                          }}
                          onClick={() => onOpenBatchDetail(batch)}
                        >
                          {/* Card Top: Batch ID & Urgency */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: "0.8rem",
                              color: "#0b5cab",
                              fontFamily: "monospace",
                            }}>
                              {batch.batch_id}
                            </span>
                            {isOverdue && (
                              <span style={{
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                borderRadius: 4,
                                padding: "1px 5px",
                              }}>
                                {daysPending}d OVERDUE
                              </span>
                            )}
                          </div>

                          {/* Program Name */}
                          <div style={{
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--text-main)",
                            margin: "4px 0 6px 0",
                            lineHeight: 1.3,
                          }}>
                            {batch.program_name}
                          </div>

                          {/* Client & Domain Chips */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {batch.client_name && (
                              <span style={{
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color: "#334155",
                                background: "#f1f5f9",
                                borderRadius: 4,
                                padding: "2px 6px",
                              }}>
                                {batch.client_name}
                              </span>
                            )}
                            {batch.domain && (
                              <span style={{
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color: "#7c3aed",
                                background: "#f3e8ff",
                                borderRadius: 4,
                                padding: "2px 6px",
                              }}>
                                {batch.domain}
                              </span>
                            )}
                            <span style={{
                              fontSize: "0.7rem",
                              color: "var(--text-dim)",
                            }}>
                              {batch.delivery_mode} {batch.location_city ? `• ${batch.location_city}` : ""}
                            </span>
                          </div>

                          {/* Trainer / Headcount Info */}
                          <div style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderTop: "1px dashed var(--border-subtle)",
                            paddingTop: 6,
                            marginTop: 6,
                          }}>
                            <div>
                              <span>Faculty: </span>
                              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                {batch.faculty_assigned_text || "Unassigned"}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontWeight: 700, color: "#0b5cab" }}>
                                {batch.total_enrollments}
                              </span>
                              <span style={{ fontSize: "0.7rem" }}> pax</span>
                            </div>
                          </div>

                          {/* Action Button Strip */}
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: "1px solid var(--border-subtle)",
                          }}>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                              {batch.start_date ? new Date(batch.start_date).toLocaleDateString() : "No date"}
                            </span>

                            {batch.status === "Approval 2 Pending"
                              && currentUser?.id?.toLowerCase() === batch.approver_2_id?.toLowerCase() ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenApproval(batch);
                                }}
                                className="btn btn-primary"
                                style={{ padding: "3px 8px", fontSize: "0.72rem", background: "#7c3aed" }}
                              >
                                Sign Off
                              </button>
                            ) : batch.status === "Ongoing" && !batch.batch_nps ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenBatchDetail(batch);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: "3px 8px", fontSize: "0.72rem", color: "#e11d48", borderColor: "#fecdd3" }}
                              >
                                Log Gate 2
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.72rem", color: "#0b5cab", fontWeight: 700, display: "flex", alignItems: "center" }}>
                                View <ChevronRight size={12} />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: EXECUTIVE OVERVIEW */}
      {viewMode === "executive" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Vertical Distribution Breakdown */}
          <div className="glass-panel" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  Vertical & Domain Performance
                </h3>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Active batch distribution, committed curriculum hours, and customer quality indices across verticals.
                </p>
              </div>
            </div>

            {summary?.vertical_distribution && summary.vertical_distribution.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {summary.vertical_distribution.map((v) => (
                  <div
                    key={v.vertical}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: "16px 18px",
                      background: "#ffffff",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#0b5cab" }}>
                        {v.vertical}
                      </span>
                      <span style={{
                        background: "#e8f2fb",
                        color: "#0b5cab",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}>
                        {v.active_batches} Active Batch(es)
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Total Hours</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                          {v.total_hours}h
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Quality Rating</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#d97706", marginTop: 2 }}>
                          {v.average_feedback > 0 ? `⭐ ${v.average_feedback} / 5` : "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No domain analytics data available.
              </div>
            )}
          </div>

          {/* Supervised Personnel & Reporting Team */}
          <div className="glass-panel" style={{ padding: 22, background: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                    Supervised Personnel & Reporting Team
                  </h3>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "#e8f2fb",
                    color: "#0b5cab",
                    border: "1px solid #bae6fd",
                  }}>
                    {reports.length} Direct Report(s)
                  </span>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Operational team members reporting to you for scheduling, attendance, and batch management.
                </p>
              </div>
            </div>

            {reports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                <Users size={32} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 600, color: "var(--text-main)" }}>No Direct Reports Assigned</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 4 }}>
                  Assigned coordinators and team members reporting to your leadership line will appear here.
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
                      <th style={{ padding: "10px 14px" }}>Ops Team</th>
                      <th style={{ padding: "10px 14px" }}>Batches Handled</th>
                      <th style={{ padding: "10px 14px" }}>Account Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const assignedBatchesCount = batches.filter((b) => b.coordinator_id === r.id).length;
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.85rem" }}>
                          <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-main)" }}>
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
                          <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0b5cab" }}>
                            {assignedBatchesCount} Batch(es)
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              color: r.is_active ? "#16a34a" : "#94a3b8",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.is_active ? "#16a34a" : "#94a3b8" }} />
                              {r.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
