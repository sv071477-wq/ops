"use client";

import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { api, Batch } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { X, Lock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { FormModal } from "@/components/forms/modal/FormModal";
import { approveBatchSchema, type ApproveBatchInput } from "@/lib/validation/schemas";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ApproveBatchModalProps {
  batch: Batch | null;
  isOpen: boolean;
  onClose: () => void;
  onBatchApproved: () => void;
  canApprove: boolean;
}

export const ApproveBatchModal: React.FC<ApproveBatchModalProps> = ({
  batch,
  isOpen,
  onClose,
  onBatchApproved,
  canApprove,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !batch || !canApprove) return null;

  const currentLevel = batch.approver_1_status === "Approved" ? 2 : 1;

  const handleDecisionSubmit = async (data: ApproveBatchInput) => {
    setIsLoading(true);
    try {
      if (data.decision === "reject") {
        await api.decideBatch(batch.id, currentLevel, "reject", data.reject_reason?.trim());
      } else {
        await api.decideBatch(batch.id, currentLevel, "approve");
      }
      onBatchApproved();
      onClose();
    } catch (err: any) {
      throw new Error(err.message || "Failed to process approval decision");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") return <Badge variant="success">Approved</Badge>;
    if (s === "pending") return <Badge variant="warning">Pending</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleDecisionSubmit}
      schema={approveBatchSchema}
      title="Two-Level Batch Governance Approval"
      description={`Evaluating Level ${currentLevel} authorization checkpoint`}
      submitLabel={`Authorize Level ${currentLevel}`}
      loading={isLoading}
      initialData={{ decision: "approve" }}
      render={(form) => {
        const decision = form.watch("decision");
        
        return (
          <>
            {/* Batch Summary */}
            <div className="space-y-4 mb-4 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target Batch</p>
                  <p className="font-bold text-lg text-primary">{batch.batch_id}</p>
                  <p className="text-sm text-muted-foreground">
                    {batch.program_name} • {batch.client_name || "Enterprise Client"} ({batch.domain || "IT/ITES"})
                  </p>
                </div>
              </div>
            </div>

            {/* Batch Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-4 border rounded-lg bg-background">
              {[
                ["Program", batch.program_name],
                ["Client", batch.client_name || "Enterprise Client"],
                ["Technology", batch.technology || "Not specified"],
                ["Category", batch.category || "Not specified"],
                ["Delivery mode", batch.delivery_mode || "Not specified"],
                ["Location", batch.location_city || "Remote"],
                ["Start date", formatDate(batch.start_date, "Not set")],
                ["End date", formatDate(batch.end_date, "Not set")],
                ["Training days", String(batch.training_days ?? 0)],
                ["Total hours", String(batch.total_hours ?? 0)],
                ["Enrollments", String(batch.total_enrollments ?? 0)],
                ["Faculty", batch.faculty_assigned_text || "Not assigned"],
                ["Sales SPOC", batch.sales_spoc?.full_name || "Not assigned"],
                ["Manager SPOC", batch.primary_manager?.full_name || "Not assigned"],
                ["Coordinator", batch.coordinator?.full_name || "Not assigned"],
                ["Batch status", batch.status],
              ].map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>

            {/* Approver Status */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-4 border rounded-lg bg-background">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Approver 1 Status</p>
                <p className="text-sm font-medium">{getStatusBadge(batch.approver_1_status || "Pending")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Approver 2 Status</p>
                <p className="text-sm font-medium">{getStatusBadge(batch.approver_2_status || "Pending")}</p>
              </div>
            </div>

            {/* Decision Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">Authorization Decision *</label>
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="decision"
                  control={form.control}
                  rules={{ required: "Decision is required" }}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange("approve")}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg font-semibold text-sm transition-all",
                        field.value === "approve"
                          ? "border-2 border-green-500 bg-green-50 text-green-700"
                          : "border border-input bg-background hover:bg-accent"
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve Level {currentLevel}</span>
                    </button>
                  )}
                />
                <Controller
                  name="decision"
                  control={form.control}
                  rules={{ required: "Decision is required" }}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange("reject")}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg font-semibold text-sm transition-all",
                        field.value === "reject"
                          ? "border-2 border-destructive bg-destructive/10 text-destructive"
                          : "border border-input bg-background hover:bg-accent"
                      )}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject Level {currentLevel}</span>
                    </button>
                  )}
                />
              </div>
            </div>

            {/* Reject Reason */}
            {decision === "reject" && (
              <div className="space-y-2">
                <TextField
                  name="reject_reason"
                  label="Reason for Rejection *"
                  placeholder="Explain the reason for rejection..."
                  type="text"
                  required
                  helperText="Minimum 3 characters required"
                />
              </div>
            )}
          </>
        );
      }}
    />
  );
};