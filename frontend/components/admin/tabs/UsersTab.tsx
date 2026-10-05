"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, KeyRound, Search, Trash2, UserPlus } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu, ExportButton, FullscreenTable, SortableHeaderCell, TableFilters, TableMenu
} from "@/components/table";
import type { CsvColumn } from "@/lib/csv";
import { errorMessage } from "@/lib/notify";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import type { User } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import {
  ACTIONS_COLUMN_STYLE, AdminDialog, EmptyState, ErrorBanner, FormField, LoadingState, NAVBAR_HEIGHT,
  PANEL_CLASS, PanelTitle, ROW_ACTION_BUTTON, RowActions, StatusPill, TABLE_TH_STYLE, TD, ActionsHeaderCell
} from "@/components/admin/ui";

const activeStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");

const SORT_ACCESSORS: SortAccessors<User> = {
  fullName: (u) => u.full_name,
  email: (u) => u.email,
  role: (u) => u.role_detail?.name || u.role,
  team: (u) => u.team_detail?.name || u.team_name,
  manager: (u) => u.manager_name,
  reports: (u) => u.direct_reports_count ?? 0,
  status: (u) => activeStatusLabel(u.is_active),
};

const SORT_OPTIONS = [
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Corporate Email" },
  { key: "role", label: "Assigned Role / Title" },
  { key: "team", label: "Assigned Team (Dept)" },
  { key: "manager", label: "Reports To (Manager)" },
  { key: "reports", label: "Direct Reports" },
  { key: "status", label: "Status" },
];

const FILTER_FIELDS: readonly TableFilterField<User>[] = [
  { key: "role", accessor: SORT_ACCESSORS.role },
  { key: "team", accessor: SORT_ACCESSORS.team },
  { key: "status", accessor: SORT_ACCESSORS.status },
];

const SEARCH: TableAccessor<User> = (u) =>
  [u.full_name, u.email, u.role, u.team_name, u.manager_name].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Corporate Email" },
  { key: "role", label: "Assigned Role / Title" },
  { key: "team", label: "Assigned Team (Dept)" },
  { key: "manager", label: "Reports To (Manager)" },
  { key: "reports", label: "Direct Reports" },
  { key: "status", label: "Status" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<User>[] = [
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Corporate Email" },
  { key: "role", label: "Assigned Role", value: (u) => u.role_detail?.name || u.role },
  { key: "team", label: "Assigned Team", value: (u) => u.team_detail?.name || u.team_name || "" },
  { key: "manager", label: "Reports To", value: (u) => u.manager_name || "" },
  { key: "reports", label: "Direct Reports", value: (u) => u.direct_reports_count ?? 0 },
  { key: "status", label: "Status", value: (u) => activeStatusLabel(u.is_active) },
];

interface UserFormState {
  fullName: string;
  email: string;
  roleId: string;
  teamId: string;
  managerId: string;
  isActive: boolean;
}

const EMPTY_USER_FORM: UserFormState = {
  fullName: "",
  email: "",
  roleId: "",
  teamId: "",
  managerId: "",
  isActive: true,
};

export function UsersTab() {
  const { users, roles, teams, createUser, updateUser, deleteUser, refresh, isLoading } = useAdminPortal();
  const confirmAction = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // `undefined` keeps the modal closed; `null` means "pick a user".
  const [passwordTarget, setPasswordTarget] = useState<User | null | undefined>(undefined);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sort = useTableSort(users, SORT_ACCESSORS);
  const filters = useTableFilters(sort.sortedRows, FILTER_FIELDS, SEARCH);
  const filtered = filters.filteredRows;
  const columns = useColumnVisibility<ColumnKey>({ columns: COLUMNS });

  useEffect(() => { setPage(1); }, [filters.filtersVersion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const managerOptions = useMemo(
    () => users.filter((user) => user.id !== editingUser?.id),
    [users, editingUser]
  );

  const openCreate = () => {
    setCreateForm({
      ...EMPTY_USER_FORM,
      roleId: roles[0]?.id ?? "",
      teamId: teams[0]?.id ?? "",
    });
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.full_name,
      email: user.email,
      roleId: user.role_id || "",
      teamId: user.team_id || "",
      managerId: user.manager_id || "",
      isActive: user.is_active,
    });
    setEditError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setIsSubmitting(true);
    try {
      await createUser({
        email: createForm.email.trim().toLowerCase(),
        full_name: createForm.fullName.trim(),
        role_id: createForm.roleId || undefined,
        team_id: createForm.teamId || undefined,
        manager_id: createForm.managerId || undefined,
      });
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(errorMessage(error, "Failed to provision user"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setIsSubmitting(true);
    try {
      await updateUser(editingUser, {
        email: editForm.email.trim().toLowerCase(),
        full_name: editForm.fullName.trim(),
        role_id: editForm.roleId || null,
        team_id: editForm.teamId || null,
        manager_id: editForm.managerId || null,
        is_active: editForm.isActive,
      });
      setEditingUser(null);
    } catch (error) {
      setEditError(errorMessage(error, "Failed to update staff member"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    const confirmed = await confirmAction({
      title: "Delete staff member?",
      description: `This permanently removes the account for "${user.full_name}".`,
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteUser(user);
  };

  const roleOptions = (selectedId: string) => (
    <>
      {!roles.some((role) => role.id === selectedId) && (
        <option value={selectedId}>{selectedId ? "Unassigned" : "— Select position title —"}</option>
      )}
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name} ({role.system_role})
        </option>
      ))}
    </>
  );

  const teamOptions = (selectedId: string) => (
    <>
      <option value="">— No Team Assigned —</option>
      {!teams.some((team) => team.id === selectedId) && selectedId && (
        <option value={selectedId}>Unknown team</option>
      )}
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </>
  );

  return (
    <>
      <FullscreenTable
        panelClassName={PANEL_CLASS}
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title="Organization Staff Directory"
            description="Provision employees, assign position titles and teams, and configure reporting managers."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {users.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search staff by name, email, role, team...",
              width: 280,
            }}
            selects={[
              {
                key: "role",
                label: "Role",
                value: filters.getFilter("role"),
                onChange: (value) => filters.setFilter("role", value),
                options: filters.optionsFor("role"),
                allLabel: "All roles",
              },
              {
                key: "team",
                label: "Team",
                value: filters.getFilter("team"),
                onChange: (value) => filters.setFilter("team", value),
                options: filters.optionsFor("team"),
                allLabel: "All teams",
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
            <ExportButton filename="staff-directory" columns={EXPORT_COLUMNS} rows={filtered} />
            <TableMenu
              label="Staff directory tools"
              triggerLabel="Tools"
              items={[
                {
                  key: "password",
                  label: "Change any user's password",
                  description: "Pick a user without leaving the directory",
                  icon: <KeyRound className="h-4 w-4" />,
                  onSelect: () => setPasswordTarget(null),
                },
              ]}
            />
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Add New User</span>
            </Button>
          </>
        }
        footer={
          isLoading || paginated.length === 0 ? undefined : (
            <PaginationControls
              label="Staff directory pages"
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
          <LoadingState label="Loading staff directory..." />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={users.length === 0 ? "No staff members yet" : "No staff members match the current filters"}
            description={
              users.length === 0
                ? "Provision your first staff account to get started."
                : "Clear the search or filters to see everyone."
            }
            action={
              users.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Add New User</span>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={filters.clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <table className="glass-table table-pin-first-col w-full border-collapse">
            <thead>
              <tr>
                {columns.isVisible("fullName") && (
                  <SortableHeaderCell
                    columnKey="fullName"
                    label="Full Name"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("email") && (
                  <SortableHeaderCell
                    columnKey="email"
                    label="Corporate Email"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("role") && (
                  <SortableHeaderCell
                    columnKey="role"
                    label="Assigned Role / Title"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("team") && (
                  <SortableHeaderCell
                    columnKey="team"
                    label="Assigned Team (Dept)"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("manager") && (
                  <SortableHeaderCell
                    columnKey="manager"
                    label="Reports To (Manager)"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("reports") && (
                  <SortableHeaderCell
                    columnKey="reports"
                    label="Direct Reports"
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
                <ActionsHeaderCell />
              </tr>
            </thead>
            <tbody>
              {paginated.map((user) => (
                <tr key={user.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("fullName") && (
                    <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{user.full_name}</td>
                  )}
                  {columns.isVisible("email") && <td className={cn(TD, "text-muted-foreground")}>{user.email}</td>}
                  {columns.isVisible("role") && (
                    <td className={TD}>
                      <Badge variant="default" className="normal-case tracking-normal">
                        {user.role_detail?.name || user.role}
                      </Badge>
                    </td>
                  )}
                  {columns.isVisible("team") && (
                    <td className={TD}>
                      {user.team_detail ? (
                        <span className="font-semibold text-foreground">{user.team_detail.name}</span>
                      ) : (
                        <span className="text-muted-foreground/60">— Unassigned —</span>
                      )}
                    </td>
                  )}
                  {columns.isVisible("manager") && (
                    <td className={cn(TD, user.manager_name ? "text-foreground" : "text-muted-foreground/60")}>
                      {user.manager_name || "— Top Level —"}
                    </td>
                  )}
                  {columns.isVisible("reports") && (
                    <td className={TD}>
                      {user.direct_reports_count && user.direct_reports_count > 0 ? (
                        <Badge variant="success" className="normal-case tracking-normal">
                          {user.direct_reports_count} direct report{user.direct_reports_count === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">0</span>
                      )}
                    </td>
                  )}
                  {columns.isVisible("status") && (
                    <td className={TD}>
                      <StatusPill active={user.is_active} />
                    </td>
                  )}
                  <td className={cn(TD, "text-right")} style={ACTIONS_COLUMN_STYLE}>
                    <RowActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPasswordTarget(user)}
                        title="Change password"
                        aria-label={`Change password for ${user.full_name}`}
                        className={ROW_ACTION_BUTTON}
                      >
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(user)}
                        title="Edit staff member"
                        aria-label={`Edit ${user.full_name}`}
                        className={ROW_ACTION_BUTTON}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(user)}
                        title="Delete staff member"
                        aria-label={`Delete ${user.full_name}`}
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
        title="Provision New User"
        description="Create an employee account, assign their position title, team, and reporting manager."
        maxWidth="sm:max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form" loading={isSubmitting}>
              Create User Account
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate} className="space-y-4">
          {createError && <ErrorBanner message={createError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required>
              <input
                type="text"
                value={createForm.fullName}
                onChange={(event) => setCreateForm((form) => ({ ...form, fullName: event.target.value }))}
                placeholder="e.g. Ananya Sharma"
                className="glass-input"
                required
              />
            </FormField>
            <FormField label="Corporate Email" required>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))}
                placeholder="name@enterprise-ops.com"
                className="glass-input"
                required
              />
            </FormField>
          </div>
          <FormField label="Assigned Position Title / Role" required>
            <select
              value={createForm.roleId}
              onChange={(event) => setCreateForm((form) => ({ ...form, roleId: event.target.value }))}
              className="glass-input"
              required
            >
              {roleOptions(createForm.roleId)}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Assigned Team">
              <select
                value={createForm.teamId}
                onChange={(event) => setCreateForm((form) => ({ ...form, teamId: event.target.value }))}
                className="glass-input"
              >
                {teamOptions(createForm.teamId)}
              </select>
            </FormField>
            <FormField label="Reports To (Manager)">
              <select
                value={createForm.managerId}
                onChange={(event) => setCreateForm((form) => ({ ...form, managerId: event.target.value }))}
                className="glass-input"
              >
                <option value="">— No Manager (Top-level Leader) —</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role_detail?.name || user.role})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit Staff Member"
        description="Update account details, role, team, reporting manager, or status."
        maxWidth="sm:max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" loading={isSubmitting} disabled={!editingUser}>
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4">
          {editError && <ErrorBanner message={editError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required>
              <input
                value={editForm.fullName}
                onChange={(event) => setEditForm((form) => ({ ...form, fullName: event.target.value }))}
                className="glass-input"
                required
              />
            </FormField>
            <FormField label="Corporate Email" required>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))}
                className="glass-input"
                required
              />
            </FormField>
          </div>
          <FormField label="Assigned Position Title / Role" required>
            <select
              value={editForm.roleId}
              onChange={(event) => setEditForm((form) => ({ ...form, roleId: event.target.value }))}
              className="glass-input"
              required
            >
              {roleOptions(editForm.roleId)}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Assigned Team">
              <select
                value={editForm.teamId}
                onChange={(event) => setEditForm((form) => ({ ...form, teamId: event.target.value }))}
                className="glass-input"
              >
                {teamOptions(editForm.teamId)}
              </select>
            </FormField>
            <FormField label="Reports To (Manager)">
              <select
                value={editForm.managerId}
                onChange={(event) => setEditForm((form) => ({ ...form, managerId: event.target.value }))}
                className="glass-input"
              >
                <option value="">— No Manager —</option>
                {managerOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role_detail?.name || user.role})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(event) => setEditForm((form) => ({ ...form, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-input accent-[hsl(214_88%_27%)]"
            />
            Account is active
          </label>
        </form>
      </AdminDialog>

      <ChangePasswordModal
        isOpen={passwordTarget !== undefined}
        onClose={() => setPasswordTarget(undefined)}
        targetUser={passwordTarget ?? null}
        allUsers={users}
        onSuccess={refresh}
      />
    </>
  );
}