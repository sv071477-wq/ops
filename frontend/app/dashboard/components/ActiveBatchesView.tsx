"use client";

import React, { useEffect, useMemo } from "react";
import { RefreshCw, Calendar, Layers, Clock, Users, Timer } from "lucide-react";
import { ActiveBatchItem, ActiveBatchesResponse, ActiveSessionItem } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";
import { FullscreenTable, SortableHeaderCell, TableFilters } from "@/components/table";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableFilters } from "@/hooks/useTableFilters";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";

const BATCH_COLUMN_COUNT = 9;
const SESSION_COLUMN_COUNT = 8;

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

function progressColor(rate: number): string {
  if (rate >= 100) return "#10b981";
  if (rate >= 50) return "#0b5cab";
  if (rate > 0) return "#f59e0b";
  return "#94a3b8";
}

const batchClient: TableAccessor<ActiveBatchItem> = (batch) => batch.client_name || "Enterprise Client";
const batchCategory: TableAccessor<ActiveBatchItem> = (batch) => batch.category || "";
const batchDeliveryMode: TableAccessor<ActiveBatchItem> = (batch) => batch.delivery_mode || "Online";
const batchLocation: TableAccessor<ActiveBatchItem> = (batch) => batch.location_city || "Remote";

const BATCH_ACCESSORS: SortAccessors<ActiveBatchItem> = {
  batch: (batch) => batch.batch_id || "",
  program: (batch) => batch.program_name || "",
  client: batchClient,
  category: batchCategory,
  deliveryMode: batchDeliveryMode,
  location: batchLocation,
  startDate: (batch) => batch.start_date ?? null,
  endDate: (batch) => batch.end_date ?? null,
  status: (batch) => batch.status || "",
  enrollments: (batch) => batch.total_enrollments ?? 0,
  sessionsConducted: (batch) => batch.sessions_conducted ?? 0,
  progress: (batch) => batch.progress ?? 0,
};

const sessionPerson: TableAccessor<ActiveSessionItem> = (session) =>
  (session.session_type === "actual" ? session.faculty_name : session.trainer_name) || "";
const sessionLocation: TableAccessor<ActiveSessionItem> = (session) =>
  session.location_city || session.venue || "Remote";

const SESSION_ACCESSORS: SortAccessors<ActiveSessionItem> = {
  batch: (session) => session.batch_id || "",
  batchName: (session) => session.batch_name || "",
  type: (session) => session.session_type || "",
  module: (session) => session.module || "",
  sequence: (session) => session.sequence_number ?? null,
  person: sessionPerson,
  date: (session) => session.session_date ?? null,
  startTime: (session) => session.start_time ?? null,
  duration: (session) => session.duration_hours ?? 0,
  status: (session) => session.status || "",
  mode: (session) => session.mode_of_delivery || "Online",
  location: sessionLocation,
};

const BATCH_DESC_FIRST_KEYS = ["startDate", "endDate", "progress", "enrollments", "sessionsConducted"];
const SESSION_DESC_FIRST_KEYS = ["date", "startTime", "duration", "sequence"];

// Heading padding matches the `14px 16px` body cells of both tables below.
const TABLE_TH_STYLE: React.CSSProperties = { padding: "14px 16px" };

const BATCH_SORT_OPTIONS = [
  { key: "batch", label: "Batch & Program" },
  { key: "program", label: "Program" },
  { key: "client", label: "Client" },
  { key: "category", label: "Category" },
  { key: "deliveryMode", label: "Delivery Mode" },
  { key: "location", label: "Location" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "status", label: "Status" },
  { key: "enrollments", label: "Enrollments" },
  { key: "sessionsConducted", label: "Sessions Conducted" },
  { key: "progress", label: "Progress" },
];

const SESSION_SORT_OPTIONS = [
  { key: "batch", label: "Batch" },
  { key: "type", label: "Type" },
  { key: "module", label: "Module" },
  { key: "sequence", label: "Sequence" },
  { key: "person", label: "Trainer / Faculty" },
  { key: "date", label: "Date" },
  { key: "startTime", label: "Start Time" },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
  { key: "mode", label: "Delivery Mode" },
  { key: "location", label: "Location" },
];

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

  const batchSort = useTableSort(batches, BATCH_ACCESSORS, { descFirstKeys: BATCH_DESC_FIRST_KEYS });
  const sessionSort = useTableSort(sessions, SESSION_ACCESSORS, { descFirstKeys: SESSION_DESC_FIRST_KEYS });

  const batchFilterFields = useMemo(
    () => [
      { key: "status", accessor: BATCH_ACCESSORS.status },
      { key: "deliveryMode", accessor: batchDeliveryMode },
      { key: "client", accessor: batchClient },
      { key: "category", accessor: batchCategory },
      { key: "location", accessor: batchLocation },
    ],
    [],
  );
  const batchesFilters = useTableFilters(batchSort.sortedRows, batchFilterFields);

  const sessionFilterFields = useMemo(
    () => [
      { key: "status", accessor: SESSION_ACCESSORS.status },
      { key: "type", accessor: SESSION_ACCESSORS.type },
      { key: "mode", accessor: SESSION_ACCESSORS.mode },
      { key: "location", accessor: sessionLocation },
      { key: "batch", accessor: SESSION_ACCESSORS.batch },
    ],
    [],
  );
  const sessionsFilters = useTableFilters(sessionSort.sortedRows, sessionFilterFields);

  useEffect(() => {
    onBatchPageChange(1);
  }, [batchesFilters.filtersVersion]);

  useEffect(() => {
    onSessionPageChange(1);
  }, [sessionsFilters.filtersVersion]);

  const batchStart = (batchPage - 1) * batchPageSize;
  const pagedBatches = useMemo(
    () => batchesFilters.filteredRows.slice(batchStart, batchStart + batchPageSize),
    [batchesFilters.filteredRows, batchStart, batchPageSize],
  );

  const sessionStart = (sessionPage - 1) * sessionPageSize;
  const pagedSessions = useMemo(
    () => sessionsFilters.filteredRows.slice(sessionStart, sessionStart + sessionPageSize),
    [sessionsFilters.filteredRows, sessionStart, sessionPageSize],
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

  // Only planned sessions contribute: the API already drops cancelled,
  // not-conducted and completed rows from this list.
  const hoursScheduled = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.session_type === "scheduled" ? Number(s.duration_hours) || 0 : 0), 0),
    [sessions],
  );
  const facultyDeployed = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach((s) => {
      const person = (s.session_type === "actual" ? s.faculty_name : s.trainer_name)?.trim();
      if (person) names.add(person);
    });
    return names.size;
  }, [sessions]);

  // Padding only: `FullscreenTable` owns the header's layout, so anything that
  // changes display/alignment here would undo its two-row header.
  const headerStyle: React.CSSProperties = { padding: "20px 24px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
      {/* Date filter and refresh own the top-right corner on their own row,
          above the heading and the metric cards. */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

      <div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
          Active Batches &amp; Sessions
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
          Batches running on the selected date, with the curriculum and delivery sessions scheduled for that day.
        </p>
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
          hint="Planned and delivered combined"
          icon={<Clock />}
          iconBackground="#ecfeff"
          iconColor="#0f766e"
        />
        <SummaryCard
          label="Hours Scheduled"
          value={`${hoursScheduled.toFixed(1)} hrs`}
          hint="Planned delivery hours for the date"
          icon={<Timer />}
          iconBackground="#fef3c7"
          iconColor="#b45309"
        />
        <SummaryCard
          label="Faculty Deployed"
          value={facultyDeployed}
          hint="Distinct trainers and faculty on the day"
          icon={<Users />}
          iconBackground="#dcfce7"
          iconColor="#16a34a"
        />
      </div>

      <FullscreenTable
        headerStyle={headerStyle}
        title="Ongoing Batches"
        toolbar={
          <TableFilters
            search={{
              value: batchesFilters.search,
              onChange: batchesFilters.setSearch,
              placeholder: "Search batches...",
            }}
            selects={[
              {
                key: "status",
                label: "Status",
                value: batchesFilters.getFilter("status"),
                onChange: (value) => batchesFilters.setFilter("status", value),
                options: batchesFilters.optionsFor("status"),
              },
              {
                key: "deliveryMode",
                label: "Delivery Mode",
                value: batchesFilters.getFilter("deliveryMode"),
                onChange: (value) => batchesFilters.setFilter("deliveryMode", value),
                options: batchesFilters.optionsFor("deliveryMode"),
              },
              {
                key: "client",
                label: "Client",
                value: batchesFilters.getFilter("client"),
                onChange: (value) => batchesFilters.setFilter("client", value),
                options: batchesFilters.optionsFor("client"),
                width: 170,
              },
              {
                key: "category",
                label: "Category",
                value: batchesFilters.getFilter("category"),
                onChange: (value) => batchesFilters.setFilter("category", value),
                options: batchesFilters.optionsFor("category"),
                width: 170,
              },
              {
                key: "location",
                label: "Location",
                value: batchesFilters.getFilter("location"),
                onChange: (value) => batchesFilters.setFilter("location", value),
                options: batchesFilters.optionsFor("location"),
                width: 160,
              },
            ]}
            sort={{
              options: BATCH_SORT_OPTIONS,
              sortKey: batchSort.sortKey,
              sortDir: batchSort.sortDir,
              onChange: (key, dir) => batchSort.applySort(key, dir),
            }}
            onClear={batchesFilters.clearFilters}
            hasActiveFilters={batchesFilters.hasActiveFilters}
            activeFilterCount={batchesFilters.activeFilterCount}
          />
        }
        actions={
          <span
            style={{
              background: "#e8f2fb",
              border: "1px solid #bae6fd",
              color: "#0b5cab",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: "0.78rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {totalBatches} batch(es)
          </span>
        }
        footer={
          <PaginationControls
            currentPage={batchPage}
            totalItems={batchesFilters.filteredRows.length}
            pageSize={batchPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={onBatchPageChange}
            onPageSizeChange={onBatchPageSizeChange}
          />
        }
      >
        <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortableHeaderCell
                columnKey="batch"
                label="Batch &amp; Program"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="client"
                label="Client &amp; Category"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="deliveryMode"
                label="Mode &amp; Location"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="startDate"
                label="Start Date"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="endDate"
                label="End Date"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="status"
                label="Status"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="enrollments"
                label="Enrollments"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={{ ...TABLE_TH_STYLE, textAlign: "center" }}
              />
              <SortableHeaderCell
                columnKey="sessionsConducted"
                label="Sessions Conducted"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="progress"
                label="Progress"
                sortKey={batchSort.sortKey}
                sortDir={batchSort.sortDir}
                onSort={batchSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <ErrorRow colSpan={BATCH_COLUMN_COUNT} message={error} />
            ) : isLoading && batches.length === 0 ? (
              <LoadingRow colSpan={BATCH_COLUMN_COUNT} label="Loading ongoing batches..." />
            ) : batchesFilters.filteredRows.length === 0 ? (
              batches.length === 0 ? (
                <EmptyRow
                  colSpan={BATCH_COLUMN_COUNT}
                  message="No ongoing batches for this date"
                  hint="Select a different date to view batches running that day."
                />
              ) : (
                <EmptyRow
                  colSpan={BATCH_COLUMN_COUNT}
                  message="No batches match the current filters"
                  hint="Clear the search or filters to see all ongoing batches."
                />
              )
            ) : (
              pagedBatches.map((batch) => <BatchRow key={batch.id} batch={batch} />)
            )}
          </tbody>
        </table>
      </FullscreenTable>

      <FullscreenTable
        headerStyle={headerStyle}
        title="Ongoing Sessions"
        toolbar={
          <TableFilters
            search={{
              value: sessionsFilters.search,
              onChange: sessionsFilters.setSearch,
              placeholder: "Search sessions...",
            }}
            selects={[
              {
                key: "status",
                label: "Status",
                value: sessionsFilters.getFilter("status"),
                onChange: (value) => sessionsFilters.setFilter("status", value),
                options: sessionsFilters.optionsFor("status"),
              },
              {
                key: "type",
                label: "Type",
                value: sessionsFilters.getFilter("type"),
                onChange: (value) => sessionsFilters.setFilter("type", value),
                options: sessionsFilters.optionsFor("type"),
                width: 140,
              },
              {
                key: "mode",
                label: "Delivery Mode",
                value: sessionsFilters.getFilter("mode"),
                onChange: (value) => sessionsFilters.setFilter("mode", value),
                options: sessionsFilters.optionsFor("mode"),
                width: 160,
              },
              {
                key: "location",
                label: "Location",
                value: sessionsFilters.getFilter("location"),
                onChange: (value) => sessionsFilters.setFilter("location", value),
                options: sessionsFilters.optionsFor("location"),
                width: 160,
              },
              {
                key: "batch",
                label: "Batch",
                value: sessionsFilters.getFilter("batch"),
                onChange: (value) => sessionsFilters.setFilter("batch", value),
                options: sessionsFilters.optionsFor("batch"),
                width: 170,
              },
            ]}
            sort={{
              options: SESSION_SORT_OPTIONS,
              sortKey: sessionSort.sortKey,
              sortDir: sessionSort.sortDir,
              onChange: (key, dir) => sessionSort.applySort(key, dir),
            }}
            onClear={sessionsFilters.clearFilters}
            hasActiveFilters={sessionsFilters.hasActiveFilters}
            activeFilterCount={sessionsFilters.activeFilterCount}
          />
        }
        actions={
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
        }
        footer={
          <PaginationControls
            currentPage={sessionPage}
            totalItems={sessionsFilters.filteredRows.length}
            pageSize={sessionPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={onSessionPageChange}
            onPageSizeChange={onSessionPageSizeChange}
          />
        }
      >
        <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortableHeaderCell
                columnKey="batch"
                label="Batch"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="type"
                label="Type"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="module"
                label="Module"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="person"
                label="Trainer / Faculty"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="date"
                label="Date"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="startTime"
                label="Time &amp; Duration"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="status"
                label="Status"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
              <SortableHeaderCell
                columnKey="mode"
                label="Delivery"
                sortKey={sessionSort.sortKey}
                sortDir={sessionSort.sortDir}
                onSort={sessionSort.toggleSort}
                style={TABLE_TH_STYLE}
              />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <ErrorRow colSpan={SESSION_COLUMN_COUNT} message={error} />
            ) : isLoading && sessions.length === 0 ? (
              <LoadingRow colSpan={SESSION_COLUMN_COUNT} label="Loading ongoing sessions..." />
            ) : sessionsFilters.filteredRows.length === 0 ? (
              sessions.length === 0 ? (
                <EmptyRow
                  colSpan={SESSION_COLUMN_COUNT}
                  message="No sessions scheduled for this date"
                  hint="Sessions marked cancelled, not conducted, or completed are excluded."
                />
              ) : (
                <EmptyRow
                  colSpan={SESSION_COLUMN_COUNT}
                  message="No sessions match the current filters"
                  hint="Clear the search or filters to see all sessions."
                />
              )
            ) : (
              pagedSessions.map((session) => (
                <SessionRow key={`${session.session_type}-${session.id}`} session={session} />
              ))
            )}
          </tbody>
        </table>
      </FullscreenTable>
    </div>
  );
}
