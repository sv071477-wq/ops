"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { TrainingSession } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu,
  ExportButton,
  FullscreenTable,
  PlainHeaderCell,
  RefreshButton,
  SortableHeaderCell,
  TableCaption,
  TableFilters,
  TableStateRow,
} from "@/components/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CountBadge,
  EmptyState,
  ErrorBanner,
  LoadingState,
  NAVBAR_HEIGHT,
  PanelTitle,
} from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useColumnVisibility, type UseColumnVisibilityResult } from "@/hooks/useColumnVisibility";
import { usePersistentState, reviveNumber } from "@/hooks/usePersistentState";
import { useTableFilters } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import {
  buildFilterFields,
  buildSearchAccessor,
  buildSortAccessors,
  buildSortOptions,
  isSortable,
  type TableColumnDef,
} from "@/lib/tableColumns";
import { ALL_FILTER_VALUE } from "@/lib/tableUtils";
import type { CsvColumn } from "@/lib/csv";

const FEEDBACK_FILTER_ID = "faculty-utilization-feedback-filter";
const START_DATE_FILTER_ID = "faculty-utilization-start-date";
const END_DATE_FILTER_ID = "faculty-utilization-end-date";

const COLUMN_STORAGE_KEY = "ops.table.faculty-utilization.columns";
const PAGE_SIZE_STORAGE_KEY = "ops.table.faculty-utilization.pageSize";
const DEFAULT_PAGE_SIZE = 15;

const TH_STYLE: React.CSSProperties = { padding: "12px 14px" };

const TD_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  color: "var(--text-main)",
  fontSize: "0.825rem",
  verticalAlign: "top",
};

const MONO_STYLE: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "0.75rem" };

// Bespoke toolbar controls have to occupy exactly the box `TableFilters` gives
// its own controls (36px, same radius, border and padding) or the toolbar grid
// breaks alignment. `CONTROL_STYLE` is not exported, so it is mirrored here
// against the same tokens instead of a drifting hardcoded copy.
const BESPOKE_CONTROL_STYLE: React.CSSProperties = {
  width: "100%",
  height: 36,
  boxSizing: "border-box",
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--color-input)",
  background: "var(--color-card)",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-main)",
};

const WRAP_STYLE: React.CSSProperties = { maxWidth: 160, whiteSpace: "normal" };
const LONG_WRAP_STYLE: React.CSSProperties = { maxWidth: 240, whiteSpace: "normal" };
const MUTED_STYLE: React.CSSProperties = { color: "var(--text-muted)" };
const BOLD_NOWRAP_STYLE: React.CSSProperties = { fontWeight: 600, whiteSpace: "nowrap" };

interface UtilizationColumnDef extends TableColumnDef<TrainingSession> {
  minWidth?: number;
}

type UtilizationColumn = TableColumnDef<TrainingSession, ColumnKey> & { minWidth?: number };

/**
 * The one column definition the whole table is derived from: sort accessors,
 * sort options, filter fields, the search haystack, the ColumnsMenu list and
 * the header/body cell order all come from here, so a column cannot be visible
 * without being sortable, or hidden from the filters but on screen.
 */
const UTILIZATION_COLUMN_DEFS = [
  { key: "vertical", label: "Vertical", accessor: (row: TrainingSession) => row.vertical || "", filterable: true },
  { key: "client", label: "Client", accessor: (row: TrainingSession) => row.client || "", filterable: true, minWidth: 150 },
  { key: "category", label: "Category", accessor: (row: TrainingSession) => row.category || "", filterable: true },
  {
    key: "batchCode",
    label: "Batch ID",
    accessor: (row: TrainingSession) => row.batch_code || "",
    search: [(row: TrainingSession) => row.batch_id || ""],
    minWidth: 170,
  },
  { key: "dateOfTraining", label: "Date of Training", accessor: (row: TrainingSession) => row.date_of_training || "" },
  { key: "topic", label: "Topic", accessor: (row: TrainingSession) => row.topic || "", minWidth: 220 },
  {
    key: "facultyName",
    label: "Faculty Full Name",
    accessor: (row: TrainingSession) => row.faculty_name || "",
    filterable: true,
    minWidth: 160,
  },
  {
    key: "facultyTypeName",
    label: "Faculty Type",
    accessor: (row: TrainingSession) => row.faculty_type_name || "",
    minWidth: 150,
  },
  { key: "noOfHours", label: "No. of Hours", accessor: (row: TrainingSession) => row.no_of_hours ?? null, align: "right" },
  {
    key: "moduleFeedback",
    label: "Module Feedback",
    accessor: (row: TrainingSession) => row.module_feedback || "",
    sortable: false,
  },
  { key: "venue", label: "Venue", accessor: (row: TrainingSession) => row.venue || "", minWidth: 150 },
  {
    key: "locationCity",
    label: "Location/City",
    accessor: (row: TrainingSession) => row.location_city || "",
    filterable: true,
    minWidth: 140,
  },
  {
    key: "modeOfDelivery",
    label: "Mode of Delivery",
    accessor: (row: TrainingSession) => row.mode_of_delivery || "",
    filterable: true,
  },
  {
    key: "coordinator",
    label: "Coordinator",
    accessor: (row: TrainingSession) => row.coordinator || "",
    filterable: true,
    minWidth: 150,
  },
  { key: "status", label: "Status", accessor: (row: TrainingSession) => row.status || "", filterable: true },
  { key: "startTime", label: "Start Time", accessor: (row: TrainingSession) => row.start_time || "", sortable: false },
  { key: "endTime", label: "End Time", accessor: (row: TrainingSession) => row.end_time || "", sortable: false },
  {
    key: "feedbackSubmitted",
    label: "Feedback Submitted",
    accessor: (row: TrainingSession) => row.feedback_submitted,
    sortable: false,
  },
  {
    key: "feedbackRating",
    label: "Feedback Rating",
    accessor: (row: TrainingSession) => row.feedback_rating ?? null,
    align: "right",
  },
  {
    key: "outcomeReason",
    label: "Outcome Reason",
    accessor: (row: TrainingSession) => row.outcome_reason || "",
    sortable: false,
  },
  { key: "outcomeAt", label: "Outcome At", accessor: (row: TrainingSession) => row.outcome_at || "", sortable: false },
  { key: "outcomeBy", label: "Outcome By", accessor: (row: TrainingSession) => row.outcome_by || "", sortable: false },
  { key: "id", label: "ID", accessor: (row: TrainingSession) => row.id || "", sortable: false },
  {
    key: "trainingSessionId",
    label: "Training Session ID",
    accessor: (row: TrainingSession) => row.training_session_id || "",
    sortable: false,
  },
  {
    key: "programTypeId",
    label: "Program Type ID",
    accessor: (row: TrainingSession) => row.program_type_id || "",
    sortable: false,
  },
  { key: "createdAt", label: "Created At", accessor: (row: TrainingSession) => row.created_at || "" },
  { key: "updatedAt", label: "Updated At", accessor: (row: TrainingSession) => row.updated_at || "", sortable: false },
] as const satisfies readonly UtilizationColumnDef[];

type ColumnKey = (typeof UTILIZATION_COLUMN_DEFS)[number]["key"];

// The `as const` tuple above is what keeps `ColumnKey` a literal union, and an
// inferred tuple only carries `minWidth`/`align` on the entries that declare
// them. This widened alias is the view the header and row walks read, so both
// can ask for either property unconditionally.
const UTILIZATION_COLUMNS: readonly UtilizationColumn[] = UTILIZATION_COLUMN_DEFS;

const UTILIZATION_COLUMN_KEYS: readonly { key: ColumnKey; label: string }[] = UTILIZATION_COLUMN_DEFS.map(
  (column) => ({ key: column.key, label: column.label })
);

const UTILIZATION_ACCESSORS = buildSortAccessors(UTILIZATION_COLUMN_DEFS);
const UTILIZATION_SORT_OPTIONS = buildSortOptions(UTILIZATION_COLUMN_DEFS);
const UTILIZATION_FILTER_FIELDS = buildFilterFields(UTILIZATION_COLUMN_DEFS);
const UTILIZATION_SEARCH_ACCESSOR = buildSearchAccessor(UTILIZATION_COLUMN_DEFS);
const UTILIZATION_DESC_FIRST_KEYS = ["dateOfTraining", "createdAt"] as const;

/**
 * Raw database ids, audit stamps and the outcome/feedback trail are the ledger's
 * plumbing: 15 readable columns ship visible and the rest are one click away.
 */
const DEFAULT_HIDDEN: readonly ColumnKey[] = [
  "id",
  "trainingSessionId",
  "programTypeId",
  "createdAt",
  "updatedAt",
  "feedbackSubmitted",
  "outcomeAt",
  "outcomeBy",
  "startTime",
  "endTime",
  "feedbackRating",
  "outcomeReason",
];

// Every meaningful column, then the raw ids last so a spreadsheet keeps the
// join keys without pushing the readable fields off the row.
const EXPORT_COLUMNS: readonly CsvColumn<TrainingSession>[] = [
  { key: "vertical", label: "Vertical" },
  { key: "client", label: "Client" },
  { key: "category", label: "Category" },
  { key: "batch_code", label: "Batch ID" },
  { key: "date_of_training", label: "Date of Training" },
  { key: "topic", label: "Topic" },
  { key: "faculty_name", label: "Faculty Full Name" },
  { key: "faculty_type_name", label: "Faculty Type" },
  { key: "no_of_hours", label: "No. of Hours" },
  { key: "module_feedback", label: "Module Feedback" },
  { key: "venue", label: "Venue" },
  { key: "location_city", label: "Location/City" },
  { key: "mode_of_delivery", label: "Mode of Delivery" },
  { key: "coordinator", label: "Coordinator" },
  { key: "status", label: "Status" },
  { key: "start_time", label: "Start Time" },
  { key: "end_time", label: "End Time" },
  { key: "feedback_submitted", label: "Feedback Submitted" },
  { key: "feedback_rating", label: "Feedback Rating" },
  { key: "outcome_reason", label: "Outcome Reason" },
  { key: "outcome_at", label: "Outcome At" },
  { key: "outcome_by", label: "Outcome By" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
  { key: "id", label: "ID" },
  { key: "training_session_id", label: "Training Session ID" },
  { key: "program_type_id", label: "Program Type ID" },
];

interface FacultyUtilizationViewProps {
  data: TrainingSession[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

interface CellDef {
  style?: React.CSSProperties;
  title?: string;
  content: React.ReactNode;
}

function text(value?: string | null): CellDef {
  return { content: value || "—" };
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

function YesNo({ value }: { value?: boolean | null }) {
  if (!value) return <span style={{ color: "var(--text-dim)" }}>No</span>;
  return <span style={{ color: "var(--color-success)", fontWeight: 700 }}>Yes</span>;
}

/**
 * Body cell per column. A `Record` over the column keys, so a column cannot be
 * declared without a matching cell: the header and the row stay 1:1 by
 * construction, and the compiler catches a missing cell instead of leaving a
 * short row behind.
 */
const CELL_DEFS: Record<ColumnKey, (row: TrainingSession) => CellDef> = {
  vertical: (row) => text(row.vertical),
  client: (row) => ({ style: WRAP_STYLE, content: row.client || "—" }),
  category: (row) => text(row.category),
  batchCode: (row) => ({
    style: BOLD_NOWRAP_STYLE,
    title: row.batch_id || undefined,
    content: row.batch_code || shortId(row.batch_id),
  }),
  dateOfTraining: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatDate(row.date_of_training) }),
  topic: (row) => ({ style: LONG_WRAP_STYLE, content: row.topic || "—" }),
  facultyName: (row) => ({ style: BOLD_NOWRAP_STYLE, content: row.faculty_name || "—" }),
  facultyTypeName: (row) => text(row.faculty_type_name),
  noOfHours: (row) => ({ style: { textAlign: "right" }, content: row.no_of_hours ?? "—" }),
  moduleFeedback: (row) => ({
    style: { ...LONG_WRAP_STYLE, ...MUTED_STYLE },
    content: row.module_feedback || "—",
  }),
  venue: (row) => ({ style: { ...WRAP_STYLE, maxWidth: 180 }, content: row.venue || "—" }),
  locationCity: (row) => text(row.location_city),
  modeOfDelivery: (row) => ({
    content: <Badge variant="info" size="sm">{row.mode_of_delivery || "—"}</Badge>,
  }),
  coordinator: (row) => ({ style: BOLD_NOWRAP_STYLE, content: row.coordinator || "—" }),
  status: (row) => ({ content: <StatusBadge status={row.status} /> }),
  startTime: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatTime(row.start_time) }),
  endTime: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatTime(row.end_time) }),
  feedbackSubmitted: (row) => ({ content: <YesNo value={row.feedback_submitted} /> }),
  feedbackRating: (row) => ({ style: { textAlign: "right" }, content: row.feedback_rating ?? "—" }),
  outcomeReason: (row) => ({ style: { ...LONG_WRAP_STYLE, ...MUTED_STYLE }, content: row.outcome_reason || "—" }),
  outcomeAt: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatDateTime(row.outcome_at, "—") }),
  outcomeBy: (row) => ({
    style: MONO_STYLE,
    title: row.outcome_by || undefined,
    content: shortId(row.outcome_by),
  }),
  id: (row) => ({ style: MONO_STYLE, title: row.id || undefined, content: shortId(row.id) }),
  trainingSessionId: (row) => ({
    style: MONO_STYLE,
    title: row.training_session_id || undefined,
    content: shortId(row.training_session_id),
  }),
  programTypeId: (row) => ({
    style: MONO_STYLE,
    title: row.program_type_id || undefined,
    content: shortId(row.program_type_id),
  }),
  createdAt: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatDateTime(row.created_at, "—") }),
  updatedAt: (row) => ({ style: BOLD_NOWRAP_STYLE, content: formatDateTime(row.updated_at, "—") }),
};

function UtilizationRow({
  row,
  columns,
}: {
  row: TrainingSession;
  columns: UseColumnVisibilityResult<ColumnKey>;
}) {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.825rem" }}>
      {UTILIZATION_COLUMNS.map((column) => {
        if (!columns.isVisible(column.key)) return null;
        const cell = CELL_DEFS[column.key](row);
        return (
          <td key={column.key} style={{ ...TD_STYLE, ...cell.style }} title={cell.title}>
            {cell.content}
          </td>
        );
      })}
    </tr>
  );
}

export function FacultyUtilizationView({ data, isLoading, error, onRefresh }: FacultyUtilizationViewProps) {
  const rows = useMemo(() => data ?? [], [data]);

  const { sortKey, sortDir, sortedRows, toggleSort, applySort } = useTableSort(
    rows,
    UTILIZATION_ACCESSORS,
    { initialKey: "dateOfTraining", initialDir: "desc", descFirstKeys: UTILIZATION_DESC_FIRST_KEYS }
  );

  const {
    search,
    setSearch,
    setFilter,
    getFilter,
    optionsFor,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    filteredRows,
    filtersVersion,
  } = useTableFilters(sortedRows, UTILIZATION_FILTER_FIELDS, UTILIZATION_SEARCH_ACCESSOR);

  // The synthetic feedback bucket and the training-date range are predicates, not
  // option lists, so they cannot be expressed as shared filter fields.
  const [feedbackFilter, setFeedbackFilter] = useState(ALL_FILTER_VALUE);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const columns = useColumnVisibility<ColumnKey>({
    columns: UTILIZATION_COLUMN_KEYS,
    defaultHidden: DEFAULT_HIDDEN,
    storageKey: COLUMN_STORAGE_KEY,
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>(
    PAGE_SIZE_STORAGE_KEY,
    DEFAULT_PAGE_SIZE,
    reviveNumber
  );

  useEffect(() => {
    setPage(1);
  }, [filtersVersion, feedbackFilter, startDate, endDate, sortKey, sortDir, rows.length]);

  const matchedRows = useMemo(() => {
    if (!feedbackFilter && !startDate && !endDate) return filteredRows;
    return filteredRows.filter((row) => {
      if (feedbackFilter === "SUBMITTED" && !row.feedback_submitted) return false;
      if (feedbackFilter === "PENDING" && row.feedback_submitted) return false;
      const day = row.date_of_training ? row.date_of_training.slice(0, 10) : "";
      if (startDate && (!day || day < startDate)) return false;
      if (endDate && (!day || day > endDate)) return false;
      return true;
    });
  }, [filteredRows, feedbackFilter, startDate, endDate]);

  const bespokeFilterCount = (feedbackFilter ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0);
  const filtersActive = hasActiveFilters || bespokeFilterCount > 0;
  const totalFilterCount = activeFilterCount + bespokeFilterCount;

  const clearAllFilters = () => {
    clearFilters();
    setFeedbackFilter(ALL_FILTER_VALUE);
    setStartDate("");
    setEndDate("");
  };

  const start = (page - 1) * pageSize;
  const paginatedRows = useMemo(() => matchedRows.slice(start, start + pageSize), [matchedRows, start, pageSize]);

  const visibleColumnCount = UTILIZATION_COLUMN_KEYS.filter((column) => columns.isVisible(column.key)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <FullscreenTable
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title="Faculty Utilization"
            description="Every row of the faculty_utilization delivery ledger, as stored."
            meta={
              <CountBadge
                value={`${matchedRows.length} of ${rows.length}`}
                label={matchedRows.length === rows.length ? "records" : "records match"}
              />
            }
          />
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
              {
                key: "facultyName",
                label: "Faculty",
                value: getFilter("facultyName"),
                onChange: (value) => setFilter("facultyName", value),
                options: optionsFor("facultyName"),
                allLabel: "All faculty",
                width: 165,
              },
              {
                key: "client",
                label: "Client",
                value: getFilter("client"),
                onChange: (value) => setFilter("client", value),
                options: optionsFor("client"),
                allLabel: "All clients",
                width: 150,
              },
              {
                key: "category",
                label: "Category",
                value: getFilter("category"),
                onChange: (value) => setFilter("category", value),
                options: optionsFor("category"),
                allLabel: "All categories",
                width: 150,
              },
              {
                key: "coordinator",
                label: "Coordinator",
                value: getFilter("coordinator"),
                onChange: (value) => setFilter("coordinator", value),
                options: optionsFor("coordinator"),
                allLabel: "All coordinators",
                width: 165,
              },
              {
                key: "status",
                label: "Status",
                value: getFilter("status"),
                onChange: (value) => setFilter("status", value),
                options: optionsFor("status"),
                allLabel: "All status",
                width: 140,
              },
              {
                key: "modeOfDelivery",
                label: "Mode",
                value: getFilter("modeOfDelivery"),
                onChange: (value) => setFilter("modeOfDelivery", value),
                options: optionsFor("modeOfDelivery"),
                allLabel: "All modes",
                width: 140,
              },
              {
                key: "vertical",
                label: "Vertical",
                value: getFilter("vertical"),
                onChange: (value) => setFilter("vertical", value),
                options: optionsFor("vertical"),
                allLabel: "All verticals",
                width: 150,
              },
              {
                key: "locationCity",
                label: "City",
                value: getFilter("locationCity"),
                onChange: (value) => setFilter("locationCity", value),
                options: optionsFor("locationCity"),
                allLabel: "All cities",
                width: 150,
              },
            ]}
            sort={{
              options: UTILIZATION_SORT_OPTIONS,
              sortKey,
              sortDir,
              onChange: applySort,
              width: 210,
            }}
            bespoke={[
              {
                key: "feedback",
                label: "Feedback",
                htmlFor: FEEDBACK_FILTER_ID,
                width: 155,
                content: (
                  <select
                    id={FEEDBACK_FILTER_ID}
                    value={feedbackFilter}
                    onChange={(event) => setFeedbackFilter(event.target.value)}
                    className="glass-input"
                    style={BESPOKE_CONTROL_STYLE}
                  >
                    <option value={ALL_FILTER_VALUE}>All feedback</option>
                    <option value="SUBMITTED">Feedback submitted</option>
                    <option value="PENDING">Feedback pending</option>
                  </select>
                ),
              },
              {
                key: "startDate",
                label: "Date From",
                htmlFor: START_DATE_FILTER_ID,
                width: 150,
                content: (
                  <input
                    id={START_DATE_FILTER_ID}
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="glass-input"
                    title="Training date from"
                    style={BESPOKE_CONTROL_STYLE}
                  />
                ),
              },
              {
                key: "endDate",
                label: "Date To",
                htmlFor: END_DATE_FILTER_ID,
                width: 150,
                content: (
                  <input
                    id={END_DATE_FILTER_ID}
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="glass-input"
                    title="Training date to"
                    style={BESPOKE_CONTROL_STYLE}
                  />
                ),
              },
            ]}
            onClear={clearAllFilters}
            hasActiveFilters={filtersActive}
            activeFilterCount={totalFilterCount}
          />
        }
        actions={
          <>
            <ColumnsMenu
              columns={UTILIZATION_COLUMN_KEYS}
              hidden={columns.hidden}
              onToggle={columns.toggle}
              onShowAll={columns.showAll}
            />
            <ExportButton filename="faculty-utilization" columns={EXPORT_COLUMNS} rows={matchedRows} />
            {onRefresh && <RefreshButton onClick={onRefresh} isLoading={isLoading} label="Refresh" />}
          </>
        }
        footer={
          <PaginationControls
            label="Faculty utilization pages"
            currentPage={page}
            totalItems={matchedRows.length}
            pageSize={pageSize}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        }
      >
        <table className="glass-table table-pin-first-col w-full border-collapse" style={{ minWidth: 2400 }}>
          <TableCaption>Faculty utilization delivery ledger records</TableCaption>
          <thead>
            <tr>
              {UTILIZATION_COLUMNS.map((column) => {
                if (!columns.isVisible(column.key)) return null;
                const style: React.CSSProperties = { ...TH_STYLE, textAlign: column.align ?? "left" };
                return isSortable(column) ? (
                  <SortableHeaderCell
                    key={column.key}
                    columnKey={column.key}
                    label={column.label}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    minWidth={column.minWidth}
                    style={style}
                  />
                ) : (
                  <PlainHeaderCell key={column.key} minWidth={column.minWidth} style={style}>
                    {column.label}
                  </PlainHeaderCell>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <TableStateRow colSpan={visibleColumnCount}>
                <ErrorBanner message={error} className="mx-auto my-6 max-w-lg" />
              </TableStateRow>
            ) : isLoading && rows.length === 0 ? (
              <TableStateRow colSpan={visibleColumnCount}>
                <LoadingState label="Loading utilization records..." />
              </TableStateRow>
            ) : rows.length === 0 ? (
              <TableStateRow colSpan={visibleColumnCount}>
                <EmptyState
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  title="No utilization records in the ledger yet"
                  description="Faculty sessions appear here as soon as they are recorded."
                />
              </TableStateRow>
            ) : paginatedRows.length === 0 ? (
              <TableStateRow colSpan={visibleColumnCount}>
                <EmptyState
                  icon={<Search className="h-5 w-5" aria-hidden="true" />}
                  title="No records match the current filters"
                  description="Adjust or clear the filters above to see the rest of the ledger."
                  action={
                    <Button size="sm" variant="outline" onClick={clearAllFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </TableStateRow>
            ) : (
              paginatedRows.map((row) => <UtilizationRow key={row.id} row={row} columns={columns} />)
            )}
          </tbody>
        </table>
      </FullscreenTable>
    </div>
  );
}