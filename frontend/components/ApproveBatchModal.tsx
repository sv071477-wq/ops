"use client";

import React, { useState } from "react";
import { api, Batch } from "@/lib/api";
import { X, Lock, CheckCircle2, AlertCircle } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !batch) return null;

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const level = batch.approver_1_status === "Approved" ? 2 : 1;
      await api.decideBatch(batch.id, level, "approve");
      onBatchApproved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to approve batch");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(56, 189, 248, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38bdf8"
            }}>
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-main)" }}>
                Two-Level Batch Approval
              </h3>
              <p style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>
                {batch.approver_1_status === "Approved" ? "Approver 2 decision" : "Approver 1 decision"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApprove} style={{ padding: "24px" }}>
          {error && (
            <div style={{
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#fb7185",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Batch Summary Pill */}
          <div style={{
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20
          }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Target Batch
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8", marginTop: 2 }}>
              {batch.batch_id}
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: 2 }}>
              {batch.program_name} ({batch.client_name})
            </div>
          </div>

          <div style={{ marginBottom: 20, color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Client SOW: <strong>{batch.sow_number || "Not provided"}</strong><br />
            Approval 1: <strong>{batch.approver_1_status || "Pending"}</strong><br />
            Approval 2: <strong>{batch.approver_2_status || "Pending"}</strong>
          </div>

          <div style={{
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: "0.8rem",
            color: "#7dd3fc",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 24
          }}>
            <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
              Both configured approvers must approve before the batch is locked and can proceed with <strong>Workflow 2 (Schedule Addition)</strong>.
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              <CheckCircle2 size={16} />
              <span>{isLoading ? "Processing..." : "Approve Level"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
