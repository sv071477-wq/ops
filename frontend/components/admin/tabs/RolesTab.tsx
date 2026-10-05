"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
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
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import {
  ACTIONS_COLUMN_STYLE, AdminDialog, CountBadge, EmptyState, ErrorBanner, FormField, LoadingState,
  NAVBAR_HEIGHT, PANEL_CLASS, Panel, PanelBody, PanelHeading, PanelTitle, ROW_ACTION_BUTTON,
  RowActions, StatusPill, TABLE_TH_STYLE, TD, ActionsHeaderCell
} from "@/components/admin/ui";

const SYSTEM_ROLE_OPTIONS = [
  { value: "Coordinator", label: "Coordinator (Operations & Schedule Management)" },
  { value: "Manager", label: "Manager (Department / Team Leadership)" },
  { value: "Faculty", label: "Faculty (Trainer / Instructor)" },
  { value: "Sales", label: "Sales (Client & Account Operations)" },
  { value: "Admin", label: "Admin (Full Organization Governance)" },
];

const activeStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");

const SORT_ACCESSORS: SortAccessors<Role> = {
  name: (r) => r.name,
  systemRole: (r) => r.system_role,
  status: (r) => activeStatusLabel(r.is_active),
  createdAt: (r) => r.created_at,
};

const SORT_OPTIONS = [
  { key: "name", label: "Position Title / Role Name" },
  { key: "systemRole", label: "Base System Capability" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

const FILTER_FIELDS: readonly TableFilterField<Role>[] = [
  { key: "systemRole", accessor: SORT_ACCESSORS.systemRole },
  { key: "status", accessor: SORT_ACCESSORS.status },
];

const SEARCH: TableAccessor<Role> = (r) => [r.name, r.system_role].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "name", label: "Position Title / Role Name" },
  { key: "systemRole", label: "Base System Capability" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<Role>[] = [
  { key: "name", label: "Position Title" },
  { key: "system_role", label: "Base System Capability" },
  { key: "status", label: "Status", value: (r) => activeStatusLabel(r.is_active) },
  { key: "created_at", label: "Created At", value: (r) => formatDate(r.created_at) },
];

export function RolesTab() {
  const {
    roles, approval, approverCandidates, saveApprovers, isSavingApprovers, createRole, deleteRole, isLoading,
  } = useAdminPortal();
  const confirmAction = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [approver1Id, setApprover1Id] = useState(approval.approver1Id);
  const [approver2Id, setApprover2Id] = useState(approval.approver2Id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSystemRole, setNewRoleSystemRole] = useState("Coordinator");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The portal owns the authoritative selection; mirror it into local form state.
  useEffect(() => setApprover1Id(approval.approver1Id), [approval.approver1Id]);
  useEffect(() => setApprover2Id(approval.approver2Id), [approval.approver2Id]);

  const sort = useTableSort(roles, SORT_ACCESSORS, {
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

  const isDirty = approver1Id !== approval.approver1Id || approver2Id !== approval.approver2Id;
  const approverMissing = [approver1Id, approver2Id].some((id) => Boolean(id) && !approverCandidates.some((u) => u.id === id));

  const handleSaveApprovers = async () => {
    setFormError(null);
    try {
      await saveApprovers(approver1Id, approver2Id);
    } catch (error) {
      setFormError(errorMessage(error, "Failed to save approvers"));
    }
  };

  const handleCreateRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createRole({ name: newRoleName.trim(), system_role: newRoleSystemRole });
      setNewRoleName("");
      setIsCreateOpen(false);
    } catch (error) {
      setFormError(errorMessage(error, "Failed to create position title"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    const confirmed = await confirmAction({
      title: "Delete position title?",
      description: `"${role.name}" will be removed from the organization.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteRole(role);
  };

  const renderApproverOptions = (selectedId: string) => {
    const selectedExists = approverCandidates.some((user) => user.id === selectedId);
    return (
      <>
        <option value="">— Select approver —</option>
        {selectedId && !selectedExists && (
          <option value={selectedId}>Unknown approver ({selectedId})</option>
        )}
        {approverCandidates.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name} ({user.role})
          </option>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeading
          title="Batch Approval Configuration"
          description="Designate the two approvers every batch passes through before it can be scheduled."
          meta={isDirty ? <Badge variant="warning" size="sm">Unsaved changes</Badge> : <CountBadge value="Saved" />}
        />

        <PanelBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            {formError && <div className="md:col-span-2 lg:col-span-3"><ErrorBanner message={formError} /></div>}
            <FormField label="Approver 1 — Level 1">
              <select
                value={approver1Id}
                onChange={(event) => setApprover1Id(event.target.value)}
                className="glass-input"
              >
                {renderApproverOptions(approver1Id)}
              </select>
            </FormField>
            <FormField label="Approver 2 — Level 2">
              <select
                value={approver2Id}
                onChange={(event) => setApprover2Id(event.target.value)}
                className="glass-input"
              >
                {renderApproverOptions(approver2Id)}
              </select>
            </FormField>
            <Button
              onClick={handleSaveApprovers}
              loading={isSavingApprovers}
              disabled={!isDirty}
              title={isDirty ? "Save the approval levels" : "No changes to save"}
            >
              <span>{isDirty ? "Save Approvers" : "Saved"}</span>
            </Button>
          </div>
          {approverMissing && (
            <p className="mt-3 text-xs font-medium text-warning">
              A configured approver is no longer an active Admin or Manager. Pick a replacement and save.
            </p>
          )}
        </PanelBody>
      </Panel>

      <FullscreenTable
        panelClassName={PANEL_CLASS}
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title="Roles & Position Titles"
            description="Create and manage the official organizational titles recognized in the platform."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {roles.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search position titles...",
            }}
            selects={[
              {
                key: "systemRole",
                label: "Base System Capability",
                value: filters.getFilter("systemRole"),
                onChange: (value) => filters.setFilter("systemRole", value),
                options: filters.optionsFor("systemRole"),
                allLabel: "All capabilities",
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
            <ExportButton filename="position-titles" columns={EXPORT_COLUMNS} rows={filtered} />
            <Button
              size="sm"
              onClick={() => {
                setNewRoleName("");
                setFormError(null);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Position Title</span>
            </Button>
          </>
        }
        footer={
          isLoading || paginated.length === 0 ? undefined : (
            <PaginationControls
              label="Position titles pages"
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
          <LoadingState label="Loading position titles..." />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-5 w-5" />}
            title="No position titles defined"
            description="Add a position title to start assigning roles to staff."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-5 w-5" />}
            title="No position titles match the current filters"
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
                    label="Position Title / Role Name"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("systemRole") && (
                  <SortableHeaderCell
                    columnKey="systemRole"
                    label="Base System Capability"
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
              {paginated.map((role) => (
                <tr key={role.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("name") && (
                    <td className={cn(TD, "font-semibold text-foreground")}>{role.name}</td>
                  )}
                  {columns.isVisible("systemRole") && (
                    <td className={TD}>
                      <Badge variant="default" className="normal-case tracking-normal">
                        {role.system_role}
                      </Badge>
                    </td>
                  )}
                  {columns.isVisible("status") && (
                    <td className={TD}>
                      <StatusPill active={role.is_active} />
                    </td>
                  )}
                  {columns.isVisible("createdAt") && (
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDate(role.created_at)}</td>
                  )}
                  <td className={cn(TD, "text-right")} style={ACTIONS_COLUMN_STYLE}>
                    <RowActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteRole(role)}
                        title="Delete position title"
                        aria-label={`Delete ${role.name}`}
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
        title="Add Position Title / Role"
        description="Define a new position title and select its system operational permissions."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-role-form" loading={isSubmitting}>
              Create Position Title
            </Button>
          </>
        }
      >
        <form id="create-role-form" onSubmit={handleCreateRole} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <FormField label="Role / Position Title Name" required>
            <input
              type="text"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              placeholder="e.g. Lead Technical Trainer, Senior Operations Lead"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Base System Permission Level" required>
            <select
              value={newRoleSystemRole}
              onChange={(event) => setNewRoleSystemRole(event.target.value)}
              className="glass-input"
              required
            >
              {SYSTEM_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </form>
      </AdminDialog>
    </div>
  );
}