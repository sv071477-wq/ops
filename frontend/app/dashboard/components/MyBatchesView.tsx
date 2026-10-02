"use client";

import React, { useEffect, useMemo } from "react";
import { RefreshCw, Layers, CalendarClock, CalendarX2, Clock } from "lucide-react";
import { Batch } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { PaginationControls } from "@/components/PaginationControls";
import { FullscreenTable, PlainHeaderCell, SortableHeaderCell, TableFilters } from "@/components/table";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableFilters } from "@/hooks/useTableFilters";
import type { TableFilterField } from "@/hooks/useTableFilters";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import { isBlankTableValue } from "@/lib/tableUtils";

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

const COLUMN_COUNT = 9;

const BATCH_ACCESSORS: SortAccessors<Batch> = {
  batchId: (batch) => batch.batch_id ?? "",
  program: (batch) => batch.program_name ?? "",
  client: (batch) => batch.client_name ?? "",
  category: (batch) => batch.category ?? "",
  deliveryMode: (batch) => batch.delivery_mode ?? "",
  city: (batch) => batch.location_city ?? "",
  startDate: (batch) => batch.start_date ?? "",
  endDate: (batch) => batch.end_date ?? "",
  status: (batch) => batch.status ?? "",
  trainingDays: (batch) => batch.training_days ?? 0,
  schedule: (batch) => batch.scheduled_session_count ?? 0,
};

const DESC_FIRST_KEYS: readonly string[] = ["startDate", "endDate"];

// BatchRow's cells use 14px vertical padding, so the headings must match.
const BATCH_TH_STYLE: React.CSSProperties = { padding: "14px 16px" };

const BATCH_SEARCH_ACCESSOR: TableAccessor<Batch> = (batch) =>
  Object.values(BATCH_ACCESSORS)
    .map((accessor) => accessor(batch))
    .filter((value) => !isBlankTableValue(value))
    .join(" ");

const BATCH_FILTER_FIELDS: readonly TableFilterField<Batch>[] = [
  { key: "status", accessor: BATCH_ACCESSORS.status },
  { key: "category", accessor: BATCH_ACCESSORS.category },
  { key: "deliveryMode", accessor: BATCH_ACCESSORS.deliveryMode },
  { key: "client", accessor: BATCH_ACCESSORS.client },
];

const BATCH_SORT_OPTIONS: readonly { key: string; label: string }[] = [
  { key: "batchId", label: "Batch ID" },
  { key: "program", label: "Program" },
  { key: "client", label: "Client" },
  { key: "category", label: "Category" },
  { key: "deliveryMode", label: "Delivery Mode" },
  { key: "city", label: "Location" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "status", label: "Status" },
  { key: "trainingDays", label: "Training Days" },
  { key: "schedule", label: "Scheduled Sessions" },
];

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

  const { sortKey, sortDir, sortedRows, toggleSort, applySort } = useTableSort(batches, BATCH_ACCESSORS, {
    descFirstKeys: DESC_FIRST_KEYS,
  });

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
  } = useTableFilters(sortedRows, BATCH_FILTER_FIELDS, BATCH_SEARCH_ACCESSOR);

  useEffect(() => {
    onPageChange(1);
  }, [filtersVersion]);

  const start = (page - 1) * pageSize;
  const pagedBatches = useMemo(() => filteredRows.slice(start, start + pageSize), [filteredRows, start, pageSize]);

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

  const panelHeaderStyle: React.CSSProperties = { padding: "20px 24px" };

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

      <FullscreenTable
        headerStyle={panelHeaderStyle}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            Batches Assigned To You
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
              {filteredRows.length} batch(es)
            </span>
          </span>
        }
        toolbar={
          <TableFilters
            search={{ value: search, onChange: setSearch, placeholder: "Search batches..." }}
            selects={[
              {
                key: "status",
                label: "Status",
                value: getFilter("status"),
                onChange: (value) => setFilter("status", value),
                options: optionsFor("status"),
                allLabel: "All statuses",
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
                key: "deliveryMode",
                label: "Delivery Mode",
                value: getFilter("deliveryMode"),
                onChange: (value) => setFilter("deliveryMode", value),
                options: optionsFor("deliveryMode"),
                allLabel: "All delivery modes",
                width: 160,
              },
              {
                key: "client",
                label: "Client",
                value: getFilter("client"),
                onChange: (value) => setFilter("client", value),
                options: optionsFor("client"),
                allLabel: "All clients",
                width: 170,
              },
            ]}
            sort={{
              options: BATCH_SORT_OPTIONS,
              sortKey,
              sortDir,
              onChange: applySort,
            }}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />
        }
        footer={
          <PaginationControls
            currentPage={page}
            totalItems={filteredRows.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        }
      >
        <table className="glass-table" style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortableHeaderCell
                columnKey="batchId"
                label="Batch & Program"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="client"
                label="Client"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="deliveryMode"
                label="Mode & Location"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="startDate"
                label="Start"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="endDate"
                label="End"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="status"
                label="Status"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="trainingDays"
                label="Training Days"
                style={{ ...BATCH_TH_STYLE, textAlign: "center" }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeaderCell
                columnKey="schedule"
                label="Schedule"
                style={BATCH_TH_STYLE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <PlainHeaderCell style={BATCH_TH_STYLE}>Action</PlainHeaderCell>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <ErrorRow colSpan={COLUMN_COUNT} message={error} />
            ) : isLoading && filteredRows.length === 0 ? (
              <LoadingRow colSpan={COLUMN_COUNT} label="Loading your batches..." />
            ) : filteredRows.length === 0 ? (
              hasActiveFilters ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  message="No batches match your filters"
                  hint="Clear the search or filter selections to see all your batches."
                />
              ) : (
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
              )
            ) : (
              pagedBatches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} onOpenBatchDetail={onOpenBatchDetail} />
              ))
            )}
          </tbody>
        </table>
      </FullscreenTable>
    </div>
  );
}
