"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRightLeft, CheckCircle2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu, ExportButton, FullscreenTable, RefreshButton, SortableHeaderCell, TableFilters
} from "@/components/table";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTime } from "@/lib/dateUtils";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import type { FmsSyncLog } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import {
  EmptyState, ErrorBanner, FormField, LoadingState, NAVBAR_HEIGHT, PANEL_CLASS, Panel, PanelBody,
  PanelHeading, PanelTitle, TABLE_TH_STYLE, TD
} from "@/components/admin/ui";

const SORT_ACCESSORS: SortAccessors<FmsSyncLog> = {
  facultyId: (log) => log.faculty_id,
  eventType: (log) => log.event_type,
  status: (log) => log.status,
  timestamp: (log) => log.timestamp,
  message: (log) => log.message,
};

const SORT_OPTIONS = [
  { key: "facultyId", label: "Faculty ID" },
  { key: "eventType", label: "Event Type" },
  { key: "status", label: "Status" },
  { key: "timestamp", label: "Timestamp" },
  { key: "message", label: "Message" },
];

const FILTER_FIELDS: readonly TableFilterField<FmsSyncLog>[] = [
  { key: "eventType", accessor: SORT_ACCESSORS.eventType },
  { key: "status", accessor: SORT_ACCESSORS.status },
];

const SEARCH: TableAccessor<FmsSyncLog> = (log) =>
  [log.faculty_id, log.event_type, log.status, log.message].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "facultyId", label: "Faculty ID" },
  { key: "eventType", label: "Event Type" },
  { key: "status", label: "Status" },
  { key: "timestamp", label: "Timestamp" },
  { key: "message", label: "Message" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<FmsSyncLog>[] = [
  { key: "faculty_id", label: "Faculty ID" },
  { key: "event_type", label: "Event Type" },
  { key: "status", label: "Status" },
  { key: "response_code", label: "Response Code" },
  { key: "timestamp", label: "Timestamp", value: (log) => formatDateTime(log.timestamp) },
  { key: "message", label: "Message" },
];

export function FmsTab() {
  const {
    fmsLogs, isLoadingFms, refreshFms, dispatchFmsSync, isDispatchingFms, fmsSyncMessage, clearFmsSyncMessage,
  } = useAdminPortal();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [facultyId, setFacultyId] = useState("");
  const [eventType, setEventType] = useState("HOURS_UPDATE");
  const [formError, setFormError] = useState<string | null>(null);

  const sort = useTableSort(fmsLogs, SORT_ACCESSORS, {
    initialKey: "timestamp",
    initialDir: "desc",
    descFirstKeys: ["timestamp"],
  });
  const filters = useTableFilters(sort.sortedRows, FILTER_FIELDS, SEARCH);
  const filtered = filters.filteredRows;
  const columns = useColumnVisibility<ColumnKey>({ columns: COLUMNS });

  useEffect(() => { setPage(1); }, [filters.filtersVersion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedId = facultyId.trim();
    if (!trimmedId) {
      setFormError("Enter a faculty identifier to dispatch a payload.");
      return;
    }
    setFormError(null);
    clearFmsSyncMessage();
    await dispatchFmsSync(trimmedId, eventType);
  };

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeading
          title="FMS External Integration"
          description="Dispatch real-time delivery logs, hours updates, and faculty synchronization payloads to enterprise FMS."
        />

        <PanelBody>
          {fmsSyncMessage && (
            <div
              role="status"
              className={cn(
                "mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
                fmsSyncMessage.type === "success"
                  ? "border-success/25 bg-success-light text-success"
                  : "border-destructive/25 bg-destructive-light text-destructive"
              )}
            >
              {fmsSyncMessage.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{fmsSyncMessage.text}</span>
            </div>
          )}

          <form
            onSubmit={handleDispatch}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto] lg:items-end"
          >
            {formError && <div className="md:col-span-2 lg:col-span-3"><ErrorBanner message={formError} /></div>}
            <FormField label="Faculty Identifier / ID" required>
              <input
                type="text"
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                placeholder="e.g. FAC-2026-CORE-001"
                className="glass-input"
                required
              />
            </FormField>
            <FormField label="Sync Event Type">
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                className="glass-input"
              >
                <option value="HOURS_UPDATE">HOURS_UPDATE</option>
                <option value="FACULTY_PROFILE">FACULTY_PROFILE</option>
                <option value="GATE_STATUS">GATE_STATUS</option>
              </select>
            </FormField>
            <Button type="submit" loading={isDispatchingFms} disabled={!facultyId.trim()}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              <span>Dispatch FMS Sync</span>
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <FullscreenTable
        panelClassName={PANEL_CLASS}
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title="FMS Dispatch History"
            description="Every payload sent to the external FMS, newest first."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {fmsLogs.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search dispatches by faculty, event, status or message...",
            }}
            selects={[
              {
                key: "eventType",
                label: "Event Type",
                value: filters.getFilter("eventType"),
                onChange: (value) => filters.setFilter("eventType", value),
                options: filters.optionsFor("eventType"),
                allLabel: "All event types",
                width: 175,
              },
              {
                key: "status",
                label: "Status",
                value: filters.getFilter("status"),
                onChange: (value) => filters.setFilter("status", value),
                options: filters.optionsFor("status"),
                allLabel: "All statuses",
              },
            ]}
            sort={{
              options: SORT_OPTIONS,
              sortKey: sort.sortKey,
              sortDir: sort.sortDir,
              onChange: sort.applySort,
            }}
            onClear={filters.clearFilters}
            hasActiveFilters={filters.hasActiveFilters}
            activeFilterCount={filters.activeFilterCount}
          />
        }
        actions={
          <>
            <ColumnsMenu
              columns={COLUMNS}
              hidden={columns.hidden}
              onToggle={columns.toggle}
              onShowAll={columns.showAll}
            />
            <ExportButton filename="fms-sync-log" columns={EXPORT_COLUMNS} rows={filtered} />
            <RefreshButton onClick={refreshFms} isLoading={isLoadingFms} label="Refresh logs" />
          </>
        }
        footer={
          isLoadingFms || paginated.length === 0 ? undefined : (
            <PaginationControls
              label="FMS dispatch pages"
              currentPage={page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )
        }
      >
        {isLoadingFms ? (
          <LoadingState label="Loading sync logs..." />
        ) : fmsLogs.length === 0 ? (
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title="No FMS sync dispatches recorded yet"
            description="Dispatch a payload above to populate the audit trail."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title="No dispatches match the current filters"
            action={
              <Button size="sm" variant="outline" onClick={filters.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <table className="glass-table table-pin-first-col w-full border-collapse">
            <thead>
              <tr>
                {columns.isVisible("facultyId") && (
                  <SortableHeaderCell
                    columnKey="facultyId"
                    label="Faculty ID"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("eventType") && (
                  <SortableHeaderCell
                    columnKey="eventType"
                    label="Event Type"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("status") && (
                  <SortableHeaderCell
                    columnKey="status"
                    label="Status"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("timestamp") && (
                  <SortableHeaderCell
                    columnKey="timestamp"
                    label="Timestamp"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("message") && (
                  <SortableHeaderCell
                    columnKey="message"
                    label="Message"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.map((log) => (
                <tr key={log.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("facultyId") && (
                    <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{log.faculty_id}</td>
                  )}
                  {columns.isVisible("eventType") && (
                    <td className={cn(TD, "font-mono text-xs uppercase text-muted-foreground")}>{log.event_type}</td>
                  )}
                  {columns.isVisible("status") && (
                    <td className={TD}>
                      <Badge variant={log.status === "SUCCESS" ? "success" : "destructive"}>{log.status}</Badge>
                    </td>
                  )}
                  {columns.isVisible("timestamp") && (
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDateTime(log.timestamp)}</td>
                  )}
                  {columns.isVisible("message") && (
                    <td className={cn(TD, "max-w-[320px] truncate text-muted-foreground")} title={log.message || ""}>
                      {log.message || "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FullscreenTable>
    </div>
  );
}