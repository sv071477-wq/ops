"use client";

import React, { useState } from "react";
import { api, Batch } from "@/lib/api";
import { X, Lock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface ApproveBatchModalProps {
  batch: Batch | null;
  isOpen: boolean;
  onClose: () => void;
  onBatchApproved: () => void;
}

export const ApproveBatchModal: React.FC<ApproveBatchModalProps> = ({
  batch,
  isOpen,
  onClose,
  onBatchApproved,
}) => {
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !batch) return null;

  const currentLevel = batch.approver_1_status === "Approved" ? 2 : 1;

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (decision === "reject") {
        await api.decideBatch(batch.id, currentLevel, "reject", rejectReason.trim() || undefined);
      } else {
        // Two-level approval decision
        await api.decideBatch(batch.id, currentLevel, "approve");

        // Optional direct SOW approval id assignment
        if (approvalId.trim()) {
          await api.approveBatch(batch.id, approvalId.trim());
        }
      }

      onBatchApproved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process approval decision");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 540, background: "#ffffff" }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f8fafc"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#e8f2fb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b5cab"
            }}>
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-main)", margin: 0 }}>
                Two-Level Batch Governance Approval
              </h3>
              <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Evaluating Level {currentLevel} authorization checkpoint
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDecisionSubmit} style={{ padding: "24px" }}>
          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#f43f5e",
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Batch Summary Pill */}
          <div style={{
            background: "#f8fafc",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16
          }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Target Batch
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0b5cab", marginTop: 2 }}>
              {batch.batch_id}
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: 2 }}>
              {batch.program_name} • {batch.client_name || "Enterprise Client"} ({batch.domain || "IT/ITES"})
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 18,
            fontSize: "0.825rem",
            color: "var(--text-muted)",
            background: "#ffffff",
            padding: "10px 14px",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6
          }}>
            <div>Approver 1 Status: <strong style={{ color: batch.approver_1_status === "Approved" ? "#16a34a" : "var(--text-main)" }}>{batch.approver_1_status || "Pending"}</strong></div>
            <div>Approver 2 Status: <strong style={{ color: batch.approver_2_status === "Approved" ? "#16a34a" : "var(--text-main)" }}>{batch.approver_2_status || "Pending"}</strong></div>
          </div>

          {/* Decision Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
              Authorization Decision *
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setDecision("approve")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 6,
                  border: decision === "approve" ? "2px solid #16a34a" : "1px solid var(--border-subtle)",
                  background: decision === "approve" ? "#f0fdf4" : "#ffffff",
                  color: decision === "approve" ? "#16a34a" : "var(--text-main)",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <CheckCircle2 size={16} />
                <span>Approve Level {currentLevel}</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("reject")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 6,
                  border: decision === "reject" ? "2px solid #f43f5e" : "1px solid var(--border-subtle)",
                  background: decision === "reject" ? "#fef2f2" : "#ffffff",
                  color: decision === "reject" ? "#f43f5e" : "var(--text-main)",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                <XCircle size={16} />
                <span>Reject Level {currentLevel}</span>
              </button>
            </div>
          </div>

          {decision === "reject" ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Reason for Rejection *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain the reason for rejection..."
                className="glass-input"
                style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                required
              />
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                SOW Financial Approval ID (Optional)
              </label>
              <input
                type="text"
                value={approvalId}
                onChange={(e) => setApprovalId(e.target.value)}
                placeholder="e.g. SOW-2026-FIN-009"
                className="glass-input"
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                Leaves SOW locked and ready for Workflow 2 (Schedule Addition).
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                background: decision === "reject" ? "#f43f5e" : "#0b5cab",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              {decision === "reject" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{isLoading ? "Submitting..." : decision === "reject" ? "Reject Batch" : `Authorize Level ${currentLevel}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
