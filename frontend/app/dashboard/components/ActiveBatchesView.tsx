"use client";

import React, { useMemo } from "react";
import { RefreshCw, Calendar, Layers, Clock, Users, MapPin } from "lucide-react";
import { ActiveBatchItem, ActiveBatchesResponse, ActiveSessionItem } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";

interface ActiveBatchesViewProps {
  filterDate: string;
  onFilterDateChange: (date: string) => void;
  data: ActiveBatchesResponse | null;
  isLoading: boolean;
  error?: string | null;
  batchPage: number;
  batchPageSize: number;
  onBatchPageChange: (page: number) => void;
  onBatchPageSizeChange: (pageSize: number) => void;
  sessionPage: number;
  sessionPageSize: number;
  onSessionPageChange: (page: number) => void;
  onSessionPageSizeChange: (pageSize: number) => void;
  onRefresh?: () => void;
}

function formatTime(value?: string | null, fallback: string = "—"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const timeMatch = trimmed.match(/T(\d{2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`;
  const plainMatch = trimmed.match(/^(\d{2}):(\d{2})/);
  if (plainMatch) return `${plainMatch[1]}:${plainMatch[2]}`;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
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

function EmptyRow({ colSpan, message, hint }: { colSpan: number; message: string; hint?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: "48px 16px" }}>
        <div style={{ color: "var(--text-dim)", fontSize: "0.95rem", fontWeight: 600 }}>{message}</div>
        {hint ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>{hint}</div>
        ) : null}
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
          Use the refresh action to retry loading active batches.
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

function progressColor(rate: number): string {
  if (rate >= 100) return "#10b981";
  if (rate >= 50) return "#0b5cab";
  if (rate > 0) return "#f59e0b";
  return "#94a3b8";
}

function BatchRow({ batch }: { batch: ActiveBatchItem }) {
  const rate = Math.min(100, Math.max(0, Math.round(batch.progress ?? 0)));
  const barColor = progressColor(rate);
  const totalDays = batch.training_days || 0;

  return (
    <tr style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{batch.batch_id}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{batch.program_name}</div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{batch.client_name || "Enterprise Client"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{batch.category || "—"}</div>
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{batch.delivery_mode || "Online"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{batch.location_city || "Remote"}</div>
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
        {batch.total_enrollments}
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
            {batch.sessions_conducted}
          </span>
          {totalDays > 0 ? (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>/ {totalDays} days</span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>days TBD</span>
          )}
        </div>
      </td>
      <td style={{ padding: "14px 16px", minWidth: 130 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: barColor, marginBottom: 5 }}>
          {totalDays > 0 ? `${rate}%` : "N/A"}
        </div>
        <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden" }}>
          <div
            style={{
              width: `${rate}%`,
              height: "100%",
              background: barColor,
              borderRadius: 9999,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </td>
    </tr>
  );
}

function SessionRow({ session }: { session: ActiveSessionItem }) {
  const isActual = session.session_type === "actual";
  const person = isActual ? session.faculty_name : session.trainer_name;
  const location = session.location_city || session.venue;

  return (
    <tr style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{session.batch_id || "—"}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{session.batch_name || "—"}</div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 6,
            background: isActual ? "#ecfeff" : "#e8f2fb",
            color: isActual ? "#0f766e" : "#0b5cab",
            fontWeight: 700,
            fontSize: "0.72rem",
            whiteSpace: "nowrap",
          }}
        >
          {isActual ? "Actual" : "Scheduled"}
        </span>
      </td>
      <td style={{ padding: "14px 16px", maxWidth: 260 }}>
        <div style={{ whiteSpace: "normal", color: "var(--text-main)" }}>{session.module || "—"}</div>
        {session.sequence_number ? (
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 2 }}>
            Session #{session.sequence_number}
          </div>
        ) : null}
      </td>
      <td style={{ padding: "14px 16px", color: "var(--text-main)" }}>{person || "—"}</td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "var(--text-main)", fontWeight: 600 }}>
        {formatDate(session.session_date)}
      </td>
      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
        <div style={{ color: "var(--text-main)", fontWeight: 600 }}>
          {formatTime(session.start_time)} – {formatTime(session.end_time)}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 2 }}>
          {session.duration_hours ? `${Number(session.duration_hours).toFixed(2)} hrs` : "—"}
        </div>
      </td>
      <td style={{ padding: "14px 16px" }}>
        <StatusBadge status={session.status} />
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{session.mode_of_delivery || "Online"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>{location || "Remote"}</div>
      </td>
    </tr>
  );
}

export function ActiveBatchesView({
  filterDate,
  onFilterDateChange,
  data,
  isLoading,
  error,
  batchPage,
  batchPageSize,
  onBatchPageChange,
  onBatchPageSizeChange,
  sessionPage,
  sessionPageSize,
  onSessionPageChange,
  onSessionPageSizeChange,
  onRefresh,
}: ActiveBatchesViewProps) {
  const batches = useMemo(() => data?.batches ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const batchStart = (batchPage - 1) * batchPageSize;
  const pagedBatches = useMemo(
    () => batches.slice(batchStart, batchStart + batchPageSize),
    [batches, batchStart, batchPageSize],
  );

  const sessionStart = (sessionPage - 1) * sessionPageSize;
  const pagedSessions = useMemo(
    () => sessions.slice(sessionStart, sessionStart + sessionPageSize),
    [sessions, sessionStart, sessionPageSize],
  );

  const scheduledCount = useMemo(
    () => sessions.filter((s) => s.session_type === "scheduled").length,
    [sessions],
  );
  const actualCount = useMemo(
    () => sessions.filter((s) => s.session_type === "actual").length,
    [sessions],
  );

  const totalBatches = data?.total_batches ?? 0;
  const totalSessions = data?.total_sessions ?? sessions.length;
  const totalEnrollments = useMemo(
    () => batches.reduce((sum, batch) => sum + (batch.total_enrollments || 0), 0),
    [batches],
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
            Active Batches &amp; Sessions
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Batches running on the selected date, with the curriculum and delivery sessions scheduled for that day.
          </p>
        </div>

        <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
          <Calendar size={16} color="var(--text-dim)" aria-hidden="true" />
          <label htmlFor="active-batches-date" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)" }}>
            Date
          </label>
          <input
            id="active-batches-date"
            type="date"
            value={filterDate}
            onChange={(e) => onFilterDateChange(e.target.value)}
            className="glass-input"
            style={{ padding: "6px 10px", fontSize: "0.85rem" }}
          />
          {onRefresh ? (
            <button
              onClick={onRefresh}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              title="Refresh active batches"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : undefined} />
              <span>Refresh</span>
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <SummaryCard
          label="Ongoing Batches"
          value={totalBatches}
          hint="Active on the selected date"
          icon={<Layers />}
          iconBackground="#e8f2fb"
          iconColor="#0b5cab"
        />
        <SummaryCard
          label="Sessions Today"
          value={totalSessions}
          hint="Scheduled and actual combined"
          icon={<Clock />}
          iconBackground="#ecfeff"
          iconColor="#0f766e"
        />
        <SummaryCard
          label="Enrolled Learners"
          value={totalEnrollments}
          hint="Across ongoing batches"
          icon={<Users />}
          iconBackground="#dcfce7"
          iconColor="#16a34a"
        />
        <SummaryCard
          label="Delivery Sites"
          value={batches.filter((b) => b.location_city).length}
          hint="Distinct locations in progress"
          icon={<MapPin />}
          iconBackground="#fef3c7"
          iconColor="#d97706"
        />
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Ongoing Batches
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
            {totalBatches} batch(es)
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
            <thead>
              <tr style={thStyle}>
                <TableHeader>Batch &amp; Program</TableHeader>
                <TableHeader>Client &amp; Category</TableHeader>
                <TableHeader>Mode &amp; Location</TableHeader>
                <TableHeader>Start Date</TableHeader>
                <TableHeader>End Date</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Enrollments</TableHeader>
                <TableHeader>Sessions Conducted</TableHeader>
                <TableHeader>Progress</TableHeader>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <ErrorRow colSpan={9} message={error} />
              ) : isLoading && batches.length === 0 ? (
                <LoadingRow colSpan={9} label="Loading ongoing batches..." />
              ) : batches.length === 0 ? (
                <EmptyRow
                  colSpan={9}
                  message="No ongoing batches for this date"
                  hint="Select a different date to view batches running that day."
                />
              ) : (
                pagedBatches.map((batch) => <BatchRow key={batch.id} batch={batch} />)
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={batchPage}
          totalItems={batches.length}
          pageSize={batchPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={onBatchPageChange}
          onPageSizeChange={onBatchPageSizeChange}
        />
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Ongoing Sessions
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
              {scheduledCount} scheduled
            </span>
            <span
              style={{
                background: "#ecfeff",
                border: "1px solid #a5f3fc",
                color: "#0f766e",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              {actualCount} actual
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
            <thead>
              <tr style={thStyle}>
                <TableHeader>Batch</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Module</TableHeader>
                <TableHeader>Trainer / Faculty</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Time &amp; Duration</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Delivery</TableHeader>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <ErrorRow colSpan={8} message={error} />
              ) : isLoading && sessions.length === 0 ? (
                <LoadingRow colSpan={8} label="Loading ongoing sessions..." />
              ) : sessions.length === 0 ? (
                <EmptyRow
                  colSpan={8}
                  message="No sessions scheduled for this date"
                  hint="Sessions marked cancelled, not conducted, or completed are excluded."
                />
              ) : (
                pagedSessions.map((session) => (
                  <SessionRow key={`${session.session_type}-${session.id}`} session={session} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={sessionPage}
          totalItems={sessions.length}
          pageSize={sessionPageSize}
          pageSizeOptions={[15, 25, 50, 100]}
          onPageChange={onSessionPageChange}
          onPageSizeChange={onSessionPageSizeChange}
        />
      </div>
    </div>
  );
}
