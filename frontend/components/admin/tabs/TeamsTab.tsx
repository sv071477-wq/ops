"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Layers, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu, ExportButton, FullscreenTable, SortableHeaderCell, TableFilters
} from "@/components/table";
import type { CsvColumn } from "@/lib/csv";
import { errorMessage } from "@/lib/notify";
import { formatDate } from "@/lib/dateUtils";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import type { Team } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import {
  ACTIONS_COLUMN_STYLE, AdminDialog, EmptyState, ErrorBanner, FormField, LoadingState, NAVBAR_HEIGHT,
  PANEL_CLASS, PanelTitle, ROW_ACTION_BUTTON, RowActions, StatusPill, TABLE_TH_STYLE, TD, ActionsHeaderCell
} from "@/components/admin/ui";

const activeStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");

const SORT_ACCESSORS: SortAccessors<Team> = {
  name: (t) => t.name,
  description: (t) => t.description,
  members: (t) => t.member_count ?? 0,
  status: (t) => activeStatusLabel(t.is_active),
  createdAt: (t) => t.created_at,
};

const SORT_OPTIONS = [
  { key: "name", label: "Team Name" },
  { key: "description", label: "Description" },
  { key: "members", label: "Active Members" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

const FILTER_FIELDS: readonly TableFilterField<Team>[] = [
  { key: "status", accessor: SORT_ACCESSORS.status },
];

const SEARCH: TableAccessor<Team> = (t) =>
  [t.name, t.description, t.department].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "name", label: "Team Name" },
  { key: "description", label: "Description" },
  { key: "members", label: "Active Members" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<Team>[] = [
  { key: "name", label: "Team Name" },
  { key: "department", label: "Department" },
  { key: "description", label: "Description" },
  { key: "members", label: "Active Members", value: (t) => t.member_count ?? 0 },
  { key: "status", label: "Status", value: (t) => activeStatusLabel(t.is_active) },
  { key: "createdAt", label: "Created At", value: (t) => formatDate(t.created_at) },
];

interface TeamFormState {
  name: string;
  department: string;
  description: string;
}

const EMPTY_FORM: TeamFormState = { name: "", department: "Ops", description: "" };

export function TeamsTab() {
  const { teams, createTeam, updateTeam, deleteTeam, isLoading } = useAdminPortal();
  const confirmAction = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [createForm, setCreateForm] = useState<TeamFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<TeamFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sort = useTableSort(teams, SORT_ACCESSORS, {
    initialKey: "createdAt",
    initialDir: "desc",
    descFirstKeys: ["createdAt"],
  });
  const filters = useTableFilters(sort.sortedRows, FILTER_FIELDS, SEARCH);
  const filtered = filters.filteredRows;
  const columns = useColumnVisibility<ColumnKey>({ columns: COLUMNS });

  useEffect(() => { setPage(1); }, [filters.filtersVersion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const openCreate = () => {
    setCreateForm(EMPTY_FORM);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setEditForm({
      name: team.name,
      department: team.department || "Ops",
      description: team.description || "",
    });
    setFormError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createTeam({
        name: createForm.name.trim(),
        department: createForm.department.trim() || "Ops",
        description: createForm.description.trim() || undefined,
      });
      setIsCreateOpen(false);
    } catch (error) {
      setFormError(errorMessage(error, "Failed to create team"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTeam) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await updateTeam(editingTeam, {
        name: editForm.name.trim(),
        department: editForm.department.trim() || "Ops",
        description: editForm.description.trim() || undefined,
      });
      setEditingTeam(null);
    } catch (error) {
      setFormError(errorMessage(error, "Failed to update team"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (team: Team) => {
    const confirmed = await confirmAction({
      title: "Delete team?",
      description: `"${team.name}" will be deleted. Any assigned users will become unassigned from this team.`,
      confirmLabel: "Delete team",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteTeam(team);
  };

  const isEmpty = teams.length === 0;
  const isFilteredEmpty = !isEmpty && paginated.length === 0;

  return (
    <>
      <FullscreenTable
        panelClassName={PANEL_CLASS}
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title="Ops Teams Management"
            description="Functional delivery, sales, and finance teams operating within the Operations Department."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {teams.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search teams by name or description...",
            }}
            selects={[
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
            <ExportButton filename="ops-teams" columns={EXPORT_COLUMNS} rows={filtered} />
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Create New Team</span>
            </Button>
          </>
        }
        footer={
          isLoading || isFilteredEmpty ? undefined : (
            <PaginationControls
              label="Ops teams pages"
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
        {isLoading ? (
          <LoadingState label="Loading teams..." />
        ) : isEmpty ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No teams created yet"
            description="Create your first operational team to get started."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create New Team</span>
              </Button>
            }
          />
        ) : isFilteredEmpty ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No teams match the current filters"
            description="Clear the search or filters to see every team."
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
                {columns.isVisible("name") && (
                  <SortableHeaderCell
                    columnKey="name"
                    label="Team Name"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("description") && (
                  <SortableHeaderCell
                    columnKey="description"
                    label="Description"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("members") && (
                  <SortableHeaderCell
                    columnKey="members"
                    label="Active Members"
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
                {columns.isVisible("createdAt") && (
                  <SortableHeaderCell
                    columnKey="createdAt"
                    label="Created At"
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
              {paginated.map((team) => (
                <tr key={team.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("name") && (
                    <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{team.name}</td>
                  )}
                  {columns.isVisible("description") && (
                    <td className={cn(TD, "max-w-[280px] truncate text-muted-foreground")} title={team.description || ""}>
                      {team.description || "—"}
                    </td>
                  )}
                  {columns.isVisible("members") && (
                    <td className={TD}>
                      <Badge variant={team.member_count ? "success" : "secondary"}>
                        {team.member_count || 0} member{team.member_count === 1 ? "" : "s"}
                      </Badge>
                    </td>
                  )}
                  {columns.isVisible("status") && (
                    <td className={TD}>
                      <StatusPill active={team.is_active} />
                    </td>
                  )}
                  {columns.isVisible("createdAt") && (
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDate(team.created_at)}</td>
                  )}
                  <td className={cn(TD, "text-right")} style={ACTIONS_COLUMN_STYLE}>
                    <RowActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(team)}
                        title="Edit team"
                        aria-label={`Edit ${team.name}`}
                        className={ROW_ACTION_BUTTON}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(team)}
                        title="Delete team"
                        aria-label={`Delete ${team.name}`}
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

      <AdminDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Team"
        description="Add a new functional team within the Ops Department."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-team-form" loading={isSubmitting}>
              Create Team
            </Button>
          </>
        }
      >
        <form id="create-team-form" onSubmit={handleCreate} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <FormField label="Team Name" required>
            <input
              type="text"
              value={createForm.name}
              onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
              placeholder="e.g. Core Operations, Delivery Team, Academic Ops"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <textarea
              value={createForm.description}
              onChange={(event) => setCreateForm((form) => ({ ...form, description: event.target.value }))}
              placeholder="Brief summary of team responsibilities..."
              rows={3}
              className="glass-input resize-y"
            />
          </FormField>
        </form>
      </AdminDialog>

      <AdminDialog
        open={Boolean(editingTeam)}
        onClose={() => setEditingTeam(null)}
        title={`Edit Team: ${editingTeam?.name ?? ""}`}
        description="Update the team name and description."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-team-form" loading={isSubmitting} disabled={!editingTeam}>
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-team-form" onSubmit={handleUpdate} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <FormField label="Team Name" required>
            <input
              type="text"
              value={editForm.name}
              onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <textarea
              value={editForm.description}
              onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
              rows={3}
              className="glass-input resize-y"
            />
          </FormField>
        </form>
      </AdminDialog>
    </>
  );
}