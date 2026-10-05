"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu, ExportButton, FullscreenTable, RefreshButton, SortableHeaderCell, TableFilters
} from "@/components/table";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dateUtils";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import type { CoordinatorMappingRecord } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import {
  ACTIONS_COLUMN_STYLE, EmptyState, ErrorBanner, FormField, LoadingState, NAVBAR_HEIGHT, PANEL_CLASS,
  Panel, PanelBody, PanelHeading, PanelTitle, ROW_ACTION_BUTTON, RowActions, TABLE_TH_STYLE, TD,
  ActionsHeaderCell
} from "@/components/admin/ui";

const SORT_ACCESSORS: SortAccessors<CoordinatorMappingRecord> = {
  coordinator: (m) => m.coordinator_name,
  manager: (m) => m.manager_name,
  assignedAt: (m) => m.assigned_at,
};

const SORT_OPTIONS = [
  { key: "coordinator", label: "Coordinator" },
  { key: "manager", label: "Mapped Manager" },
  { key: "assignedAt", label: "Assigned On" },
];

const FILTER_FIELDS: readonly TableFilterField<CoordinatorMappingRecord>[] = [
  { key: "coordinator", accessor: SORT_ACCESSORS.coordinator },
  { key: "manager", accessor: SORT_ACCESSORS.manager },
];

const SEARCH: TableAccessor<CoordinatorMappingRecord> = (m) =>
  [m.coordinator_name, m.coordinator_email, m.manager_name, m.manager_email].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "coordinator", label: "Coordinator" },
  { key: "manager", label: "Mapped Manager" },
  { key: "assignedAt", label: "Assigned On" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<CoordinatorMappingRecord>[] = [
  { key: "coordinator_name", label: "Coordinator" },
  { key: "coordinator_email", label: "Coordinator Email" },
  { key: "manager_name", label: "Mapped Manager" },
  { key: "manager_email", label: "Manager Email" },
  { key: "assigned_at", label: "Assigned On", value: (m) => formatDate(m.assigned_at) },
];

export function MappingsTab() {
  const {
    mappings, isLoadingMappings, refreshMappings, coordinatorCandidates, managerCandidates,
    assignCoordinator, isAssigningCoordinator, deleteMapping,
  } = useAdminPortal();
  const confirmAction = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sort = useTableSort(mappings, SORT_ACCESSORS, {
    initialKey: "assignedAt",
    initialDir: "desc",
    descFirstKeys: ["assignedAt"],
  });
  const filters = useTableFilters(sort.sortedRows, FILTER_FIELDS, SEARCH);
  const filtered = filters.filteredRows;
  const columns = useColumnVisibility<ColumnKey>({ columns: COLUMNS });

  useEffect(() => { setPage(1); }, [filters.filtersVersion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const canAssign = Boolean(coordinatorId && managerId) && !isAssigningCoordinator;

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAssign) {
      setFormError("Select both a coordinator and a manager.");
      return;
    }
    setFormError(null);
    try {
      await assignCoordinator(coordinatorId, managerId);
      setCoordinatorId("");
      setManagerId("");
    } catch {
      // The portal already surfaced the failure; keep the selections for a retry.
    }
  };

  const handleDelete = async (mapping: CoordinatorMappingRecord) => {
    const name = mapping.coordinator_name || mapping.coordinator_id;
    const confirmed = await confirmAction({
      title: "Remove coordinator mapping?",
      description: `This removes the mapping for “${name}”.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteMapping(mapping);
  };

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeading
          title="Assign Coordinator to Manager"
          description="A coordinator can be mapped to multiple managers, so each manager sees that coordinator's batches in their scope."
        />

        <PanelBody>
          <form
            onSubmit={handleAssign}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
          >
            {formError && <div className="md:col-span-2 lg:col-span-3"><ErrorBanner message={formError} /></div>}
            <FormField label="Coordinator" required>
              <select
                value={coordinatorId}
                onChange={(event) => setCoordinatorId(event.target.value)}
                className="glass-input"
              >
                <option value="">— Select Coordinator —</option>
                {coordinatorCandidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Manager" required>
              <select
                value={managerId}
                onChange={(event) => setManagerId(event.target.value)}
                className="glass-input"
              >
                <option value="">— Select Manager —</option>
                {managerCandidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </FormField>
            <Button type="submit" loading={isAssigningCoordinator} disabled={!canAssign}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              <span>Assign</span>
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
            title="Active Coordinator Mappings"
            description="Coordinators visible to each manager."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {mappings.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search mappings by coordinator or manager...",
            }}
            selects={[
              {
                key: "coordinator",
                label: "Coordinator",
                value: filters.getFilter("coordinator"),
                onChange: (value) => filters.setFilter("coordinator", value),
                options: filters.optionsFor("coordinator"),
                allLabel: "All coordinators",
                width: 180,
              },
              {
                key: "manager",
                label: "Manager",
                value: filters.getFilter("manager"),
                onChange: (value) => filters.setFilter("manager", value),
                options: filters.optionsFor("manager"),
                allLabel: "All managers",
                width: 180,
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
            <ExportButton filename="coordinator-mappings" columns={EXPORT_COLUMNS} rows={filtered} />
            <RefreshButton onClick={refreshMappings} isLoading={isLoadingMappings} />
          </>
        }
        footer={
          isLoadingMappings || paginated.length === 0 ? undefined : (
            <PaginationControls
              label="Coordinator mapping pages"
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
        {isLoadingMappings ? (
          <LoadingState label="Loading mappings..." />
        ) : mappings.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="No coordinator-manager mappings configured yet"
            description="Use the form above to add the first mapping."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="No mappings match the current filters"
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
                {columns.isVisible("coordinator") && (
                  <SortableHeaderCell
                    columnKey="coordinator"
                    label="Coordinator"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("manager") && (
                  <SortableHeaderCell
                    columnKey="manager"
                    label="Mapped Manager"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("assignedAt") && (
                  <SortableHeaderCell
                    columnKey="assignedAt"
                    label="Assigned On"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                <ActionsHeaderCell />
              </tr>
            </thead>
            <tbody>
              {paginated.map((mapping) => (
                <tr key={mapping.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("coordinator") && (
                    <td className={TD}>
                      <div className="font-semibold text-foreground">{mapping.coordinator_name || "—"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{mapping.coordinator_email || ""}</div>
                    </td>
                  )}
                  {columns.isVisible("manager") && (
                    <td className={TD}>
                      <div className="font-semibold text-primary">{mapping.manager_name || "—"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{mapping.manager_email || ""}</div>
                    </td>
                  )}
                  {columns.isVisible("assignedAt") && (
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>
                      {formatDate(mapping.assigned_at)}
                    </td>
                  )}
                  <td className={cn(TD, "text-right")} style={ACTIONS_COLUMN_STYLE}>
                    <RowActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(mapping)}
                        title="Remove mapping"
                        aria-label={`Remove mapping for ${mapping.coordinator_name || mapping.coordinator_id}`}
                        className={cn(ROW_ACTION_BUTTON, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FullscreenTable>
    </div>
  );
}