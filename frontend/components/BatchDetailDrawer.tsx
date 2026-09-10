"use client";

import React from "react";
import { Batch } from "@/lib/api";
import { X, Calendar, Users, MapPin, Monitor, Clock, FileText, CheckCircle2, Lock, Star, Building2, User } from "lucide-react";

interface BatchDetailDrawerProps {
  batch: Batch | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenApprove?: (batch: Batch) => void;
  canApprove?: boolean;
}

export const BatchDetailDrawer: React.FC<BatchDetailDrawerProps> = ({
  batch,
  isOpen,
  onClose,
  onOpenApprove,
  canApprove = false,
}) => {
  if (!isOpen || !batch) return null;

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return "Not set";
    return new Date(dStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "requested") return <span className="badge badge-requested">Requested</span>;
    if (s === "approved") return <span className="badge badge-approved">Approved</span>;
    if (s === "ongoing") return <span className="badge badge-ongoing">Ongoing</span>;
    if (s === "completed") return <span className="badge badge-completed">Completed</span>;
    return <span className="badge badge-cancelled">{status}</span>;
  };

  return (
    <div className="modal-overlay" style={{ justifyContent: "flex-end", padding: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          height: "100vh",
          background: "#0b1329",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(15, 23, 42, 0.8)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Batch Details
              </span>
              {getStatusBadge(batch.status)}
            </div>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "#38bdf8",
              marginTop: 4
            }}>
              {batch.batch_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Program Title & Client */}
          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
              Curriculum Title
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
              {batch.program_name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--text-muted)", fontSize: "0.875rem" }}>
              <Building2 size={16} color="#38bdf8" />
              <span>{batch.client_name || "Enterprise Client"}</span>
              <span>•</span>
              <span style={{ color: "#a855f7", fontWeight: 600 }}>{batch.domain || "IT/ITES"}</span>
            </div>
          </div>

          {/* Governance & Approval ID */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12
          }}>
            <div className="glass-panel" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                SOW Approval ID
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: batch.approval_id ? "#38bdf8" : "#fbbf24", marginTop: 4 }}>
                {batch.approval_id || "Pending Approval"}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Schema Lock
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: batch.is_schema_locked ? "#34d399" : "#fbbf24", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                {batch.is_schema_locked ? <Lock size={15} /> : null}
                <span>{batch.is_schema_locked ? "Locked" : "Unlocked"}</span>
              </div>
            </div>
          </div>

          {/* Delivery Logistics */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12 }}>
              Delivery Logistics & Timeline
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: "0.875rem" }}>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Delivery Mode:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.delivery_mode}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Location / City:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.location_city || "Remote"}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Start Date:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{formatDate(batch.start_date)}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>End Date:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{formatDate(batch.end_date)}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Training Days:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.training_days} days ({batch.total_hours} hrs)</div>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)" }}>Category:</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.category}</div>
              </div>
            </div>
          </div>

          {/* Headcount Breakdown */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12 }}>
              Enrollment Headcount
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                flex: 1,
                background: "rgba(30, 41, 59, 0.5)",
                padding: "12px",
                borderRadius: 10,
                textAlign: "center"
              }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Total</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38bdf8" }}>{batch.total_enrollments}</div>
              </div>
              <div style={{
                flex: 1,
                background: "rgba(30, 41, 59, 0.5)",
                padding: "12px",
                borderRadius: 10,
                textAlign: "center"
              }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Residential</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#818cf8" }}>{batch.residential_enrollments}</div>
              </div>
              <div style={{
                flex: 1,
                background: "rgba(30, 41, 59, 0.5)",
                padding: "12px",
                borderRadius: 10,
                textAlign: "center"
              }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Non-Residential</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#34d399" }}>{batch.non_residential_enrollments}</div>
              </div>
            </div>
          </div>

          {/* Tech Stack & Faculty */}
          <div className="glass-panel" style={{ padding: "18px 20px" }}>
            <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 8 }}>
              Technical Stack & Faculty
            </h4>
            <div style={{ fontSize: "0.875rem", color: "var(--text-main)", marginBottom: 10 }}>
              <strong>Stack:</strong> {batch.technology || "Not specified"}
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>
              <strong>Instructors:</strong> {batch.faculty_assigned_text || "Unassigned"}
            </div>
          </div>

          {/* Quality Scores */}
          {(batch.batch_avg_feedback || batch.batch_nps) && (
            <div className="glass-panel" style={{ padding: "18px 20px" }}>
              <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12 }}>
                Quality Checkpoint Metrics
              </h4>
              <div style={{ display: "flex", gap: 16 }}>
                {batch.batch_avg_feedback && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Star size={18} color="#f59e0b" fill="#f59e0b" />
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Gate 1 Rating</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fbbf24" }}>{batch.batch_avg_feedback} / 5.0</div>
                    </div>
                  </div>
                )}
                {batch.batch_nps && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Gate 2 NPS</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34d399" }}>{batch.batch_nps} / 10</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {batch.remarks && (
            <div className="glass-panel" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                Operational Remarks
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                {batch.remarks}
              </p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          background: "rgba(15, 23, 42, 0.9)"
        }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          {canApprove && batch.status === "Requested" && onOpenApprove && (
            <button
              onClick={() => {
                onClose();
                onOpenApprove(batch);
              }}
              className="btn btn-primary"
            >
              <CheckCircle2 size={16} />
              <span>Approve Batch</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
