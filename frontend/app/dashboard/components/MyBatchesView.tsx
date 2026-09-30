"use client";

import React, { useMemo } from "react";
import { RefreshCw, Layers, CalendarClock, CalendarX2, Clock } from "lucide-react";
import { Batch } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";

interface MyBatchesViewProps {
  data: Batch[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onOpenBatchDetail: (batch: Batch) => void;
  canCreateBatch?: boolean;
  onCreateBatch?: () => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function statusBadgeColor(status: string): { background: string; color: string } {
  const s = (status || "").toLowerCase();
  if (s === "requested" || s.includes("pending")) return { background: "#fef3c7", color: "#b45309" };
  if (s === "approved" || s === "upcoming" || s === "scheduled") return { background: "#e8f2fb", color: "#0b5cab" };
  if (s === "ongoing" || s === "inprogress") return { background: "#ecfeff", color: "#0f766e" };
  if (s === "completed") return { background: "#dcfce7", color: "#166534" };
  if (s === "onhold") return { background: "#ffedd5", color: "#b45309" };
  if (s === "cancelled" || s === "not conducted") return { background: "#fef2f2", color: "#b91c1c" };
  if (s === "rescheduled") return { background: "#f5f3ff", color: "#6d28d9" };
  return { background: "#f1f5f9", color: "#475569" };
}

function StatusBadge({ status }: { status: string }) {
  const { background, color } = statusBadgeColor(status);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 6,
        background,
        color,
        fontWeight: 700,
        fontSize: "0.72rem",
        whiteSpace: "nowrap",
      }}
    >
      {status || "—"}
    </span>
  );
}

/**
 * The reason this view exists: "Not scheduled" is the call to action a
 * coordinator needs before they can ingest a timetable, and it is invisible
 * everywhere else in the product.
 */
function ScheduleBadge({ count }: { count: number }) {
  const scheduled = count > 0;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 6,
        background: scheduled ? "#dcfce7" : "#fef2f2",
        color: scheduled ? "#166534" : "#b91c1c",
        fontWeight: 700,
        fontSize: "0.72rem",
        whiteSpace: "nowrap",
      }}
    >
      {scheduled ? `${count} day${count === 1 ? "" : "s"}` : "Not scheduled"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  iconBackground,
  iconColor,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "18px 20px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--text-dim)",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "var(--text-main)",
            marginTop: 4,
            fontFamily: "var(--font-display)",
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>
      </div>
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: iconBackground,
        }}
      >
        {React.cloneElement(icon as React.ReactElement, { size: 17, color: iconColor })}
      </div>
    </div>
  );
}

function EmptyRow({
  colSpan,
  message,
  hint,
  action,
}: {
  colSpan: number;
  message: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "48px 16px" }}>
        <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", fontWeight: 600 }}>{message}</div>
        {hint ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>{hint}</div>
        ) : null}
        {action}
      </td>
    </tr>
  );
}

function LoadingRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "40px 16px" }}>
        <RefreshCw
          className="animate-spin"
          size={24}
          color="#0b5cab"
          style={{ margin: "0 auto 8px auto" }}
          aria-hidden="true"
        />
        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{label}</div>
      </td>
    </tr>
  );
}

function ErrorRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "40px 16px" }}>
        <div style={{ color: "#b91c1c", fontSize: "0.875rem", fontWeight: 600 }}>{message}</div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>
          Use the refresh action to retry loading your batches.
        </div>
      </td>
    </tr>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        whiteSpace: "nowrap",
        fontSize: "0.78rem",
        color: "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

const thStyle: React.CSSProperties = {
  background: "#f8fafc",
  textAlign: "left",
  fontSize: "0.78rem",
  color: "var(--text-dim)",
};

const COLUMN_COUNT = 9;

function BatchRow({
  batch,
  onOpenBatchDetail,
}: {
  batch: Batch;
  onOpenBatchDetail: (batch: Batch) => void;
}) {
  return (
    <tr
      onClick={() => onOpenBatchDetail(batch)}
      style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem", cursor: "pointer" }}
    >
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{batch.batch_id}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
          {batch.program_name}
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
          {batch.client_name || "Enterprise Client"}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{batch.category || "—"}</div>
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{batch.delivery_mode || "Online"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
          {batch.location_city || "Remote"}
        </div>
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{formatDate(batch.start_date)}</div>
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{formatDate(batch.end_date)}</div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <StatusBadge status={batch.status} />
      </td>
      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "var(--text-main)" }}>
        {batch.training_days || 0}
      </td>
      <td style={{ padding: "14px 16px" }}>
        <ScheduleBadge count={batch.scheduled_session_count ?? 0} />
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenBatchDetail(batch);
          }}
          className="btn btn-primary"
          style={{ padding: "5px 12px", fontSize: "0.775rem" }}
        >
          Manage Schedule
        </button>
      </td>
    </tr>
  );
}

export function MyBatchesView({
  data,
  isLoading,
  error,
  onRefresh,
  onOpenBatchDetail,
  canCreateBatch = false,
  onCreateBatch,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: MyBatchesViewProps) {
  const batches = useMemo(() => data ?? [], [data]);

  const start = (page - 1) * pageSize;
  const pagedBatches = useMemo(() => batches.slice(start, start + pageSize), [batches, start, pageSize]);

  const unscheduledCount = useMemo(
    () => batches.filter((batch) => (batch.scheduled_session_count ?? 0) === 0).length,
    [batches]
  );
  const scheduledDays = useMemo(
    () => batches.reduce((sum, batch) => sum + (batch.scheduled_session_count ?? 0), 0),
    [batches]
  );
  const inFlightCount = useMemo(
    () => batches.filter((batch) => batch.status === "Ongoing").length,
    [batches]
  );

  const headerStyle: React.CSSProperties = {
    padding: "20px 24px",
    borderBottom: "1px solid var(--border-subtle)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
            My Batches
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Batches you own, and whether each one still needs a timetable.
          </p>
        </div>

        {onRefresh ? (
          <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <button
              onClick={onRefresh}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              title="Refresh your batches"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : undefined} />
              <span>Refresh</span>
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <SummaryCard
          label="My Batches"
          value={batches.length}
          hint="Batches assigned to you"
          icon={<Layers />}
          iconBackground="#e8f2fb"
          iconColor="#0b5cab"
        />
        <SummaryCard
          label="Awaiting Schedule"
          value={unscheduledCount}
          hint="No timetable ingested yet"
          icon={<CalendarX2 />}
          iconBackground="#fef2f2"
          iconColor="#b91c1c"
        />
        <SummaryCard
          label="Scheduled Days"
          value={scheduledDays}
          hint="Timetable days across your batches"
          icon={<CalendarClock />}
          iconBackground="#dcfce7"
          iconColor="#16a34a"
        />
        <SummaryCard
          label="Ongoing"
          value={inFlightCount}
          hint="Currently running batches"
          icon={<Clock />}
          iconBackground="#ecfeff"
          iconColor="#0f766e"
        />
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Batches Assigned To You
          </h3>
          <span
            style={{
              background: "#e8f2fb",
              border: "1px solid #bae6fd",
              color: "#0b5cab",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            {batches.length} batch(es)
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
            <thead>
              <tr style={thStyle}>
                <TableHeader>Batch &amp; Program</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Mode &amp; Location</TableHeader>
                <TableHeader>Start</TableHeader>
                <TableHeader>End</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Training Days</TableHeader>
                <TableHeader>Schedule</TableHeader>
                <TableHeader>Action</TableHeader>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <ErrorRow colSpan={COLUMN_COUNT} message={error} />
              ) : isLoading && batches.length === 0 ? (
                <LoadingRow colSpan={COLUMN_COUNT} label="Loading your batches..." />
              ) : batches.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  message="No batches assigned to you yet"
                  hint={
                    canCreateBatch
                      ? "Use Add New Batch to create one, then open it to build its timetable."
                      : "Batches assigned to you will appear here."
                  }
                  action={
                    canCreateBatch && onCreateBatch ? (
                      <button
                        type="button"
                        onClick={onCreateBatch}
                        className="btn btn-primary"
                        style={{ marginTop: 14, padding: "8px 14px", fontSize: "0.8rem" }}
                      >
                        Add New Batch
                      </button>
                    ) : null
                  }
                />
              ) : (
                pagedBatches.map((batch) => (
                  <BatchRow key={batch.id} batch={batch} onOpenBatchDetail={onOpenBatchDetail} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={page}
          totalItems={batches.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
