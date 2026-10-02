"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { TrainingSession } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";
import { FullscreenTable, PlainHeaderCell, SortableHeaderCell, TableFilters } from "@/components/table";
import type { TableFilterSelectConfig } from "@/components/table";
import { ALL_FILTER_VALUE } from "@/lib/tableUtils";

type SortKey =
  | "date_of_training"
  | "faculty_name"
  | "faculty_type_name"
  | "topic"
  | "no_of_hours"
  | "venue"
  | "location_city"
  | "mode_of_delivery"
  | "status"
  | "feedback_rating"
  | "vertical"
  | "client"
  | "category"
  | "batch_code"
  | "coordinator"
  | "created_at";
type SortDir = "asc" | "desc";

const ALL = "ALL";

const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: "date_of_training", dir: "desc" };
const DESC_FIRST_KEYS = new Set<SortKey>(["date_of_training", "created_at"]);

// Every sortable column, in header order, with the exact header text as the label.
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "vertical", label: "Vertical" },
  { key: "client", label: "Client" },
  { key: "category", label: "Category" },
  { key: "batch_code", label: "Batch ID" },
  { key: "date_of_training", label: "Date of Training" },
  { key: "topic", label: "Topic" },
  { key: "faculty_name", label: "Faculty Full Name" },
  { key: "faculty_type_name", label: "Faculty Type" },
  { key: "no_of_hours", label: "No. of Hours" },
  { key: "venue", label: "Venue" },
  { key: "location_city", label: "Location/City" },
  { key: "mode_of_delivery", label: "Mode of Delivery" },
  { key: "coordinator", label: "Coordinator" },
  { key: "status", label: "Status" },
  { key: "feedback_rating", label: "Feedback Rating" },
  { key: "created_at", label: "Created At" },
];

const TH_STYLE: React.CSSProperties = { padding: "12px 14px" };

// Numeric columns are right-aligned in the body, so their headings match.
const NUMERIC_TH_STYLE: React.CSSProperties = { ...TH_STYLE, textAlign: "right" };

const TD_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  color: "var(--text-main)",
  fontSize: "0.825rem",
  verticalAlign: "top",
};

const FILTER_STYLE: React.CSSProperties = { padding: "7px 10px", fontSize: "0.8rem" };

// Bespoke toolbar controls must match the shared controls' box exactly, or the
// toolbar grid breaks alignment.
const BE_FILTER_STYLE: React.CSSProperties = {
  ...FILTER_STYLE,
  width: "100%",
  height: 34,
  boxSizing: "border-box",
  borderRadius: 6,
  border: "1px solid var(--border-subtle)",
  background: "#fff",
  fontWeight: 600,
  color: "var(--text-main)",
};

const COLUMN_COUNT = 27;

interface FacultyUtilizationViewProps {
  data: TrainingSession[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// This view keeps "ALL" as its no-filter sentinel; the shared controls speak "".
function toSharedFilterValue(value: string): string {
  return value === ALL ? ALL_FILTER_VALUE : value;
}

function fromSharedFilterValue(value: string): string {
  return value === ALL_FILTER_VALUE ? ALL : value;
}

function shortId(value?: string | null): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function formatTime(value?: string | null, fallback: string = "—"): string {
  if (!value) return fallback;
  const trimmed = String(value).trim();
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
  if (s === "completed") return { background: "#dcfce7", color: "#166534" };
  if (s === "inprogress") return { background: "#ecfeff", color: "#0f766e" };
  if (s === "scheduled") return { background: "#e8f2fb", color: "#0b5cab" };
  if (s === "rescheduled") return { background: "#f5f3ff", color: "#6d28d9" };
  if (s === "cancelled" || s === "not conducted") return { background: "#fef2f2", color: "#b91c1c" };
  return { background: "#f1f5f9", color: "#475569" };
}

function StatusBadge({ status }: { status?: string | null }) {
  const { background, color } = statusBadgeColor(status || "");
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

function Tag({ value, fallback }: { value?: string | null; fallback: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        background: "#e8f2fb",
        color: "#0b5cab",
        fontSize: "0.72rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {value || fallback}
    </span>
  );
}

function YesNo({ value }: { value?: boolean | null }) {
  if (!value) return <span style={{ color: "var(--text-dim)" }}>No</span>;
  return <span style={{ color: "#16a34a", fontWeight: 700 }}>Yes</span>;
}

function LoadingRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} style={{ textAlign: "center", padding: "40px 16px" }}>
        <RefreshCw className="animate-spin" size={24} color="#0b5cab" style={{ margin: "0 auto 8px" }} />
        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{label}</div>
      </td>
    </tr>
  );
}

function EmptyRow({ message, hint }: { message: string; hint?: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{message}</div>
        {hint ? <div style={{ fontSize: "0.8rem", marginTop: 4 }}>{hint}</div> : null}
      </td>
    </tr>
  );
}

function UtilizationRow({ row }: { row: TrainingSession }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.825rem" }}>
      <td style={TD_STYLE}>{row.vertical || "—"}</td>
      <td style={{ ...TD_STYLE, maxWidth: 160, whiteSpace: "normal" }}>{row.client || "—"}</td>
      <td style={TD_STYLE}>{row.category || "—"}</td>
      <td style={{ ...TD_STYLE, fontWeight: 600, whiteSpace: "nowrap" }} title={row.batch_id || undefined}>
        {row.batch_code || shortId(row.batch_id)}
      </td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatDate(row.date_of_training)}</td>
      <td style={{ ...TD_STYLE, maxWidth: 240, whiteSpace: "normal" }}>{row.topic || "—"}</td>
      <td style={{ ...TD_STYLE, fontWeight: 600, whiteSpace: "nowrap" }}>{row.faculty_name || "—"}</td>
      <td style={TD_STYLE}>{row.faculty_type_name || "—"}</td>
      <td style={{ ...TD_STYLE, textAlign: "right" }}>{row.no_of_hours ?? "—"}</td>
      <td style={{ ...TD_STYLE, maxWidth: 240, whiteSpace: "normal", color: "var(--text-muted)" }}>
        {row.module_feedback || "—"}
      </td>
      <td style={{ ...TD_STYLE, maxWidth: 180, whiteSpace: "normal" }}>{row.venue || "—"}</td>
      <td style={TD_STYLE}>{row.location_city || "—"}</td>
      <td style={TD_STYLE}>
        <Tag value={row.mode_of_delivery} fallback="—" />
      </td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{row.coordinator || "—"}</td>
      <td style={TD_STYLE}>
        <StatusBadge status={row.status} />
      </td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatTime(row.start_time)}</td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatTime(row.end_time)}</td>
      <td style={TD_STYLE}>
        <YesNo value={row.feedback_submitted} />
      </td>
      <td style={{ ...TD_STYLE, textAlign: "right" }}>{row.feedback_rating ?? "—"}</td>
      <td style={{ ...TD_STYLE, maxWidth: 220, whiteSpace: "normal", color: "var(--text-muted)" }}>
        {row.outcome_reason || "—"}
      </td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatDateTime(row.outcome_at, "—")}</td>
      <td style={TD_STYLE} title={row.outcome_by || undefined}>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem" }}>
          {shortId(row.outcome_by)}
        </span>
      </td>
      <td style={TD_STYLE} title={row.id || undefined}>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem" }}>
          {shortId(row.id)}
        </span>
      </td>
      <td style={TD_STYLE} title={row.training_session_id || undefined}>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem" }}>
          {shortId(row.training_session_id)}
        </span>
      </td>
      <td style={TD_STYLE} title={row.program_type_id || undefined}>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem" }}>
          {shortId(row.program_type_id)}
        </span>
      </td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatDateTime(row.created_at, "—")}</td>
      <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>{formatDateTime(row.updated_at, "—")}</td>
    </tr>
  );
}

export function FacultyUtilizationView({ data, isLoading, error, onRefresh }: FacultyUtilizationViewProps) {
  const rows = useMemo(() => data ?? [], [data]);

  const [search, setSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [coordinatorFilter, setCoordinatorFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [modeFilter, setModeFilter] = useState(ALL);
  const [verticalFilter, setVerticalFilter] = useState(ALL);
  const [cityFilter, setCityFilter] = useState(ALL);
  const [feedbackFilter, setFeedbackFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT.key);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT.dir);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const options = useMemo(() => {
    const collect = (values: (string | null | undefined)[]) =>
      [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      faculty: collect(rows.map((r) => r.faculty_name)),
      status: collect(rows.map((r) => r.status)),
      mode: collect(rows.map((r) => r.mode_of_delivery)),
      vertical: collect(rows.map((r) => r.vertical)),
      city: collect(rows.map((r) => r.location_city)),
      client: collect(rows.map((r) => r.client)),
      category: collect(rows.map((r) => r.category)),
      coordinator: collect(rows.map((r) => r.coordinator)),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term) {
        const haystack = [
          row.faculty_name,
          row.faculty_type_name,
          row.topic,
          row.venue,
          row.location_city,
          row.client,
          row.category,
          row.batch_code,
          row.coordinator,
          row.module_feedback,
          row.mode_of_delivery,
          row.status,
          row.vertical,
          row.batch_id,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (facultyFilter !== ALL && (row.faculty_name || "") !== facultyFilter) return false;
      if (clientFilter !== ALL && (row.client || "") !== clientFilter) return false;
      if (categoryFilter !== ALL && (row.category || "") !== categoryFilter) return false;
      if (coordinatorFilter !== ALL && (row.coordinator || "") !== coordinatorFilter) return false;
      if (statusFilter !== ALL && (row.status || "") !== statusFilter) return false;
      if (modeFilter !== ALL && (row.mode_of_delivery || "") !== modeFilter) return false;
      if (verticalFilter !== ALL && (row.vertical || "") !== verticalFilter) return false;
      if (cityFilter !== ALL && (row.location_city || "") !== cityFilter) return false;
      if (feedbackFilter === "SUBMITTED" && !row.feedback_submitted) return false;
      if (feedbackFilter === "PENDING" && row.feedback_submitted) return false;
      const day = row.date_of_training ? row.date_of_training.slice(0, 10) : "";
      if (startDate && (!day || day < startDate)) return false;
      if (endDate && (!day || day > endDate)) return false;
      return true;
    });
  }, [
    rows,
    search,
    facultyFilter,
    clientFilter,
    categoryFilter,
    coordinatorFilter,
    statusFilter,
    modeFilter,
    verticalFilter,
    cityFilter,
    feedbackFilter,
    startDate,
    endDate,
  ]);

  const sortedRows = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;
    const value = (row: TrainingSession): string | number | null => {
      switch (sortKey) {
        case "date_of_training":
        case "created_at":
          return row[sortKey] ? new Date(row[sortKey] as string).getTime() : null;
        case "no_of_hours":
          return row.no_of_hours ?? null;
        case "feedback_rating":
          return row.feedback_rating ?? null;
        case "faculty_name":
          return row.faculty_name || null;
        case "faculty_type_name":
          return row.faculty_type_name || null;
        case "client":
          return row.client || null;
        case "category":
          return row.category || null;
        case "batch_code":
          return row.batch_code || null;
        case "coordinator":
          return row.coordinator || null;
        case "topic":
          return row.topic || null;
        case "venue":
          return row.venue || null;
        case "location_city":
          return row.location_city || null;
        case "mode_of_delivery":
          return row.mode_of_delivery || null;
        case "status":
          return row.status || null;
        case "vertical":
          return row.vertical || null;
      }
    };

    return [...filteredRows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      // Blank cells always sink to the bottom, whichever direction is active.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      let comparison: number;
      if (typeof av === "number" && typeof bv === "number") {
        comparison = av - bv;
      } else {
        comparison = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (comparison !== 0) return comparison * direction;
      return (
        new Date(b.date_of_training).getTime() - new Date(a.date_of_training).getTime()
      );
    });
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [
    rows.length,
    search,
    facultyFilter,
    clientFilter,
    categoryFilter,
    coordinatorFilter,
    statusFilter,
    modeFilter,
    verticalFilter,
    cityFilter,
    feedbackFilter,
    startDate,
    endDate,
    sortKey,
    sortDir,
  ]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const hasActiveFilters =
    search !== "" ||
    facultyFilter !== ALL ||
    clientFilter !== ALL ||
    categoryFilter !== ALL ||
    coordinatorFilter !== ALL ||
    statusFilter !== ALL ||
    modeFilter !== ALL ||
    verticalFilter !== ALL ||
    cityFilter !== ALL ||
    feedbackFilter !== ALL ||
    startDate !== "" ||
    endDate !== "";

  const clearFilters = () => {
    setSearch("");
    setFacultyFilter(ALL);
    setClientFilter(ALL);
    setCategoryFilter(ALL);
    setCoordinatorFilter(ALL);
    setStatusFilter(ALL);
    setModeFilter(ALL);
    setVerticalFilter(ALL);
    setCityFilter(ALL);
    setFeedbackFilter(ALL);
    setStartDate("");
    setEndDate("");
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(DESC_FIRST_KEYS.has(key) ? "desc" : "asc");
  };

  // The shared header cells hand back a plain string key.
  const sortByColumn = (key: string) => toggleSort(key as SortKey);

  // Backs the shared "Sort by" dropdown: a newly picked column starts on its
  // natural direction, the active column (and the direction button) toggles.
  const handleSortByChange = (key: string | null, dir?: SortDir | null) => {
    if (!key) return;
    const nextKey = key as SortKey;
    if (nextKey === sortKey) {
      setSortDir(dir === "desc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDir(DESC_FIRST_KEYS.has(nextKey) ? "desc" : "asc");
  };

  const filterSelect = (
    key: string,
    label: string,
    allLabel: string,
    value: string,
    setValue: (next: string) => void,
    items: string[],
    width: number,
  ): TableFilterSelectConfig => ({
    key,
    label,
    allLabel,
    value: toSharedFilterValue(value),
    onChange: (next) => setValue(fromSharedFilterValue(next)),
    options: items,
    width,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <FullscreenTable
        title={
          <div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              Faculty Utilization
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
              Every row of the <code style={{ fontSize: "0.8rem" }}>faculty_utilization</code> delivery ledger, as
              stored.
            </p>
          </div>
        }
        titleStyle={{ whiteSpace: "normal" }}
        toolbar={
          <TableFilters
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search faculty, topic, venue, city, batch...",
              width: 280,
            }}
            selects={[
              filterSelect("faculty", "Faculty", "All faculty", facultyFilter, setFacultyFilter, options.faculty, 165),
              filterSelect("client", "Client", "All clients", clientFilter, setClientFilter, options.client, 150),
              filterSelect(
                "category",
                "Category",
                "All categories",
                categoryFilter,
                setCategoryFilter,
                options.category,
                150,
              ),
              filterSelect(
                "coordinator",
                "Coordinator",
                "All coordinators",
                coordinatorFilter,
                setCoordinatorFilter,
                options.coordinator,
                165,
              ),
              filterSelect("status", "Status", "All status", statusFilter, setStatusFilter, options.status, 140),
              filterSelect("mode", "Mode", "All modes", modeFilter, setModeFilter, options.mode, 140),
              filterSelect(
                "vertical",
                "Vertical",
                "All verticals",
                verticalFilter,
                setVerticalFilter,
                options.vertical,
                150,
              ),
              filterSelect("city", "City", "All cities", cityFilter, setCityFilter, options.city, 150),
            ]}
            sort={{ options: SORT_OPTIONS, sortKey, sortDir, onChange: handleSortByChange, width: 210 }}
            bespoke={[
              {
                key: "feedback",
                label: "Feedback",
                width: 155,
                content: (
                  <select
                    value={feedbackFilter}
                    onChange={(e) => setFeedbackFilter(e.target.value)}
                    className="glass-input"
                    style={BE_FILTER_STYLE}
                  >
                    <option value={ALL}>All feedback</option>
                    <option value="SUBMITTED">Feedback submitted</option>
                    <option value="PENDING">Feedback pending</option>
                  </select>
                ),
              },
              {
                key: "startDate",
                label: "Date From",
                width: 150,
                content: (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="glass-input"
                    aria-label="Training date from"
                    title="Training date from"
                    style={BE_FILTER_STYLE}
                  />
                ),
              },
              {
                key: "endDate",
                label: "Date To",
                width: 150,
                content: (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="glass-input"
                    aria-label="Training date to"
                    title="Training date to"
                    style={BE_FILTER_STYLE}
                  />
                ),
              },
            ]}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        }
        actions={
          onRefresh ? (
            <button
              onClick={onRefresh}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              title="Reload ledger records"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : undefined} />
              <span>Refresh</span>
            </button>
          ) : null
        }
        footer={
          <>
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>
                Showing <strong>{sortedRows.length}</strong> of <strong>{rows.length}</strong> records
              </span>
              {hasActiveFilters ? (
                <span
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#b45309",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  Filters applied
                </span>
              ) : null}
            </div>

            <PaginationControls
              currentPage={page}
              totalItems={sortedRows.length}
              pageSize={pageSize}
              pageSizeOptions={[15, 25, 50, 100]}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </>
        }
      >
        <table className="glass-table" style={{ width: "100%", minWidth: 3200, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortableHeaderCell columnKey="vertical" label="Vertical" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <SortableHeaderCell columnKey="client" label="Client" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={150} style={TH_STYLE} />
              <SortableHeaderCell columnKey="category" label="Category" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <SortableHeaderCell columnKey="batch_code" label="Batch ID" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={170} style={TH_STYLE} />
              <SortableHeaderCell columnKey="date_of_training" label="Date of Training" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <SortableHeaderCell columnKey="topic" label="Topic" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={220} style={TH_STYLE} />
              <SortableHeaderCell columnKey="faculty_name" label="Faculty Full Name" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={160} style={TH_STYLE} />
              <SortableHeaderCell columnKey="faculty_type_name" label="Faculty Type" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={150} style={TH_STYLE} />
              <SortableHeaderCell columnKey="no_of_hours" label="No. of Hours" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={NUMERIC_TH_STYLE} />
              <PlainHeaderCell style={TH_STYLE}>Module Feedback</PlainHeaderCell>
              <SortableHeaderCell columnKey="venue" label="Venue" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={150} style={TH_STYLE} />
              <SortableHeaderCell columnKey="location_city" label="Location/City" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={140} style={TH_STYLE} />
              <SortableHeaderCell columnKey="mode_of_delivery" label="Mode of Delivery" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <SortableHeaderCell columnKey="coordinator" label="Coordinator" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} minWidth={150} style={TH_STYLE} />
              <SortableHeaderCell columnKey="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <PlainHeaderCell style={TH_STYLE}>Start Time</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>End Time</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>Feedback Submitted</PlainHeaderCell>
              <SortableHeaderCell columnKey="feedback_rating" label="Feedback Rating" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={NUMERIC_TH_STYLE} />
              <PlainHeaderCell style={TH_STYLE}>Outcome Reason</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>Outcome At</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>Outcome By</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>ID</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>Training Session ID</PlainHeaderCell>
              <PlainHeaderCell style={TH_STYLE}>Program Type ID</PlainHeaderCell>
              <SortableHeaderCell columnKey="created_at" label="Created At" sortKey={sortKey} sortDir={sortDir} onSort={sortByColumn} style={TH_STYLE} />
              <PlainHeaderCell style={TH_STYLE}>Updated At</PlainHeaderCell>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <EmptyRow message="Could not load utilization records" hint={error} />
            ) : isLoading && rows.length === 0 ? (
              <LoadingRow label="Loading utilization records..." />
            ) : rows.length === 0 ? (
              <EmptyRow message="No utilization records in the ledger yet." />
            ) : paginatedRows.length === 0 ? (
              <EmptyRow message="No records match the current filters." hint="Adjust or clear the filters above." />
            ) : (
              paginatedRows.map((row) => <UtilizationRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </FullscreenTable>
    </div>
  );
}
