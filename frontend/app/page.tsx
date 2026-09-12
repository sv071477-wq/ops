"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api, Batch } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { CreateBatchModal } from "@/components/CreateBatchModal";
import { ApproveBatchModal } from "@/components/ApproveBatchModal";
import { BatchDetailDrawer } from "@/components/BatchDetailDrawer";
import {
  Layers, Search, Filter, Plus, CheckCircle2, Clock, PlayCircle,
  Archive, Star, Eye, Lock, Building2, MapPin, Sparkles, RefreshCw, AlertTriangle
} from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

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

  useEffect(() => {
    if (user) {
      fetchBatches();
    }
  }, [user, statusFilter, domainFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches();
  };

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = batches.length;
    const requested = batches.filter((b) => b.status === "Requested").length;
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
          <RefreshCw className="animate-spin" size={32} color="#38bdf8" />
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Initializing Operations Hub...</span>
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar onOpenCreateModal={() => setIsCreateOpen(true)} />

      <main style={{ maxWidth: 1400, margin: "0 auto", width: "100%", padding: "28px 24px", flex: 1 }}>
        {/* Metric Cards Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          marginBottom: 28
        }}>
          {/* Total Batches */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Total Batches
              </span>
              <Layers size={18} color="#38bdf8" />
            </div>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-main)", marginTop: 6, fontFamily: "var(--font-display)" }}>
              {metrics.total}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Across all programs & clients
            </div>
          </div>

          {/* In Review (Requested) */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                In Review
              </span>
              <Clock size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#fbbf24", marginTop: 6, fontFamily: "var(--font-display)" }}>
              {metrics.requested}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Awaiting Manager SOW Approval
            </div>
          </div>

          {/* Approved */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Approved
              </span>
              <CheckCircle2 size={18} color="#38bdf8" />
            </div>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#38bdf8", marginTop: 6, fontFamily: "var(--font-display)" }}>
              {metrics.approved}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Schema locked & scheduled
            </div>
          </div>

          {/* Ongoing */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Live Delivery
              </span>
              <PlayCircle size={18} color="#818cf8" />
            </div>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#818cf8", marginTop: 6, fontFamily: "var(--font-display)" }}>
              {metrics.ongoing}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Active in-flight classrooms
            </div>
          </div>

          {/* Quality Average */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Avg Quality Rating
              </span>
              <Star size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#34d399", marginTop: 6, fontFamily: "var(--font-display)" }}>
              {metrics.avgFeedback} <span style={{ fontSize: "1rem", color: "var(--text-dim)" }}>/ 5.0</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Gate 1 & Gate 2 Feedback
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Actions */}
        <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} style={{ flex: "1 1 280px", maxWidth: 420, display: "flex", gap: 8 }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={17} color="var(--text-dim)" style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Batch ID, Program, Client, Tech..."
                  className="glass-input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ padding: "0 16px" }}>
                Search
              </button>
            </form>

            {/* Dropdown Filters */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {/* Domain Filter */}
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="glass-input"
                style={{ width: "auto", fontSize: "0.825rem", padding: "8px 12px" }}
              >
                <option value="ALL">All Domains</option>
                <option value="IT/ITES">IT/ITES</option>
                <option value="Cloud">Cloud & DevOps</option>
                <option value="DS/ML">Data Science & AI</option>
                <option value="CyberSecurity">CyberSecurity</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="glass-input"
                style={{ width: "auto", fontSize: "0.825rem", padding: "8px 12px" }}
              >
                <option value="ALL">All Categories</option>
                <option value="Bootcamp">Bootcamp</option>
                <option value="RBT">RBT</option>
                <option value="PJP">PJP</option>
                <option value="Workshop">Workshop</option>
              </select>

              <button
                onClick={fetchBatches}
                title="Refresh Table"
                className="btn btn-secondary"
                style={{ padding: "8px 12px" }}
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Status Pills */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--border-subtle)",
            overflowX: "auto"
          }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700, marginRight: 4 }}>
              Status:
            </span>
            {["ALL", "Requested", "Approved", "Ongoing", "Completed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: statusFilter === st ? 700 : 500,
                  background: statusFilter === st ? "rgba(56, 189, 248, 0.2)" : "rgba(30, 41, 59, 0.5)",
                  border: `1px solid ${statusFilter === st ? "#38bdf8" : "var(--border-subtle)"}`,
                  color: statusFilter === st ? "#38bdf8" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Batches Table Container */}
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
              <RefreshCw className="animate-spin" size={28} color="#38bdf8" style={{ margin: "0 auto 12px" }} />
              <div>Loading operational batches...</div>
            </div>
          ) : batches.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <Layers size={40} color="var(--text-dim)" style={{ margin: "0 auto 16px", opacity: 0.5 }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)" }}>No Batches Found</h3>
              <p style={{ fontSize: "0.85rem", marginTop: 4 }}>
                No batch matches the selected filter criteria or search query.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="btn btn-primary"
                style={{ marginTop: 18 }}
              >
                <Plus size={16} />
                <span>Create New Batch Request</span>
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#f7f9fb", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Batch ID & Client
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Program Curriculum
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Category & Mode
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Headcount
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Status
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Quality Rating
                    </th>
                    <th style={{ padding: "14px 18px", color: "var(--text-dim)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.15s ease",
                      }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#f7f9fb")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Batch ID & Client */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ fontWeight: 700, color: "#38bdf8", fontSize: "0.925rem" }}>
                          {batch.batch_id}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 3 }}>
                          <Building2 size={13} />
                          <span>{batch.client_name || "Enterprise"}</span>
                        </div>
                      </td>

                      {/* Program Title */}
                      <td style={{ padding: "16px 18px", maxWidth: 280 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {batch.program_name}
                        </div>
                        <div style={{ fontSize: "0.775rem", color: "var(--text-dim)", marginTop: 2 }}>
                          {batch.technology || batch.domain || "Technical Curriculum"}
                        </div>
                      </td>

                      {/* Category & Mode */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#eef1f5",
                            color: "#425a73",
                            fontSize: "0.75rem",
                            fontWeight: 600
                          }}>
                            {batch.category}
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {batch.delivery_mode}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 3 }}>
                          {batch.location_city || "Remote"}
                        </div>
                      </td>

                      {/* Headcount */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                          {batch.total_enrollments} students
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                          {batch.residential_enrollments > 0 ? `${batch.residential_enrollments} Resi • ` : ""}
                          {batch.non_residential_enrollments} Non-Resi
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px 18px" }}>
                        <div>{getStatusBadge(batch.status)}</div>
                        {batch.approval_id && (
                          <div style={{ fontSize: "0.725rem", color: "#38bdf8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                            <Lock size={11} />
                            <span>{batch.approval_id}</span>
                          </div>
                        )}
                      </td>

                      {/* Quality Score */}
                      <td style={{ padding: "16px 18px" }}>
                        {batch.batch_avg_feedback ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Star size={14} color="#f59e0b" fill="#f59e0b" />
                            <span style={{ fontWeight: 700, color: "#fbbf24" }}>
                              {batch.batch_avg_feedback}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>/ 5.0</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          {batch.status === "Requested" && (
                            <button
                              onClick={() => handleSubmitBatch(batch)}
                              className="btn btn-primary"
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              <CheckCircle2 size={14} />
                              <span>Submit for Approval</span>
                            </button>
                          )}
                          {canApprove && (batch.status === "Approval 1 Pending" || batch.status === "Approval 2 Pending") && (
                            <button
                              onClick={() => setSelectedBatchForApproval(batch)}
                              className="btn btn-primary"
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              <CheckCircle2 size={14} />
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedBatchForDetail(batch)}
                            className="btn btn-secondary"
                            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                            title="View Full Batch Record"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onBatchCreated={fetchBatches}
      />

      <ApproveBatchModal
        batch={selectedBatchForApproval}
        isOpen={!!selectedBatchForApproval}
        onClose={() => setSelectedBatchForApproval(null)}
        onBatchApproved={fetchBatches}
      />

      <BatchDetailDrawer
        batch={selectedBatchForDetail}
        isOpen={!!selectedBatchForDetail}
        onClose={() => setSelectedBatchForDetail(null)}
        canApprove={canApprove}
        onOpenApprove={(b) => setSelectedBatchForApproval(b)}
      />
    </div>
  );
}
