import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import { AdminPortalProvider, type AdminPortalValue } from '@/components/admin/AdminPortalContext';
import { TeamsTab } from '@/components/admin/tabs/TeamsTab';
import { RolesTab } from '@/components/admin/tabs/RolesTab';
import { TaxonomyTab } from '@/components/admin/tabs/TaxonomyTab';
import { UsersTab } from '@/components/admin/tabs/UsersTab';
import { FmsTab } from '@/components/admin/tabs/FmsTab';
import { HierarchyTab } from '@/components/admin/tabs/HierarchyTab';
import { MappingsTab } from '@/components/admin/tabs/MappingsTab';
import type { BatchOption, CoordinatorMappingRecord, FmsSyncLog, Role, Team, User, UserHierarchyNode } from '@/lib/api';

const TEAMS: Team[] = [
  { id: 't1', name: 'Core Operations', department: 'Ops', description: 'Runs the core batches', is_active: true, member_count: 4, created_at: '2026-01-04T10:00:00Z' },
  { id: 't2', name: 'Finance Review', department: 'Finance', description: null, is_active: false, member_count: 0, created_at: '2026-02-04T10:00:00Z' },
];

const ROLES: Role[] = [
  { id: 'r1', name: 'Operations Lead', system_role: 'Manager', is_active: true, created_at: '2026-01-01T10:00:00Z' },
];

const USERS: User[] = [
  { id: 'u1', email: 'lead@enterprise-ops.com', full_name: 'Ananya Sharma', role: 'Manager', role_id: 'r1', team_id: 't1', team_detail: TEAMS[0], team_name: 'Core Operations', is_manager: true, direct_reports_count: 2, is_active: true, created_at: '2026-01-02T10:00:00Z' },
  { id: 'u2', email: 'exec@enterprise-ops.com', full_name: 'Rohit Menon', role: 'Coordinator', role_id: 'r1', manager_id: 'u1', manager_name: 'Ananya Sharma', direct_reports_count: 0, is_active: true, created_at: '2026-01-03T10:00:00Z' },
];

const HIERARCHY: UserHierarchyNode[] = [
  {
    id: 'u1', full_name: 'Ananya Sharma', email: 'lead@enterprise-ops.com', role: 'Manager',
    role_name: 'Operations Lead', team_name: 'Core Operations',
    direct_reports: [
      { id: 'u2', full_name: 'Rohit Menon', email: 'exec@enterprise-ops.com', role: 'Coordinator', role_name: 'Coordinator', direct_reports: [] },
    ],
  },
];

const OPTIONS: BatchOption[] = [
  { id: 'o1', name: 'Masterclass', description: 'Single trainer', is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
];

const FMS_LOGS: FmsSyncLog[] = [
  { id: 'f1', faculty_id: 'FAC-1', event_type: 'HOURS_UPDATE', status: 'SUCCESS', message: 'ok', timestamp: '2026-03-01T09:00:00Z' },
];

const MAPPINGS: CoordinatorMappingRecord[] = [
  { id: 'm1', coordinator_id: 'u2', coordinator_name: 'Rohit Menon', coordinator_email: 'exec@enterprise-ops.com', manager_id: 'u1', manager_name: 'Ananya Sharma', manager_email: 'lead@enterprise-ops.com', assigned_at: '2026-03-02T09:00:00Z' },
];

function makePortal(overrides: Partial<AdminPortalValue> = {}): AdminPortalValue {
  return {
    teams: TEAMS,
    roles: ROLES,
    users: USERS,
    hierarchy: HIERARCHY,
    batchOptions: OPTIONS,
    fmsLogs: FMS_LOGS,
    mappings: MAPPINGS,
    approval: { approver1Id: 'u1', approver2Id: '' },
    selectedOptionType: 'categories',
    isLoading: false,
    isLoadingOptions: false,
    isLoadingFms: false,
    isLoadingMappings: false,
    refresh: async () => {},
    refreshOptions: async () => {},
    refreshFms: async () => {},
    refreshMappings: async () => {},
    setSelectedOptionType: () => {},
    approverCandidates: USERS.filter((user) => user.role === 'Manager' || user.role === 'Admin'),
    coordinatorCandidates: USERS.filter((user) => user.role === 'Coordinator'),
    managerCandidates: USERS.filter((user) => user.role === 'Manager' || user.role === 'Admin'),
    createTeam: async () => {},
    updateTeam: async () => {},
    deleteTeam: async () => {},
    createRole: async () => {},
    deleteRole: async () => {},
    createOption: async () => {},
    deleteOption: async () => {},
    createUser: async () => {},
    updateUser: async () => {},
    deleteUser: async () => {},
    saveApprovers: async () => {},
    isSavingApprovers: false,
    assignCoordinator: async () => {},
    isAssigningCoordinator: false,
    deleteMapping: async () => {},
    dispatchFmsSync: async () => {},
    isDispatchingFms: false,
    fmsSyncMessage: null,
    clearFmsSyncMessage: () => {},
    ...overrides,
  };
}

function renderTab(ui: ReactElement, overrides: Partial<AdminPortalValue> = {}) {
  return render(
    <ConfirmProvider>
      <AdminPortalProvider value={makePortal(overrides)}>{ui}</AdminPortalProvider>
    </ConfirmProvider>
  );
}

const noop = async () => {};

describe('admin tabs', () => {
  it('renders teams with a table-level create action and row actions', () => {
    renderTab(<TeamsTab />);
    expect(screen.getByRole('button', { name: /Create New Team/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Core Operations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Core Operations' })).toBeInTheDocument();
  });

  it('only offers a save button once the approvers actually change', async () => {
    renderTab(<RolesTab />);
    const save = screen.getByRole('button', { name: /Saved/ });
    expect(save).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('Approver 2 — Level 2'), 'u1');
    expect(screen.getByRole('button', { name: /Save Approvers/ })).toBeEnabled();
  });

  it('switches the taxonomy option set through the filter grid', async () => {
    const setSelectedOptionType = vi.fn();
    renderTab(<TaxonomyTab />, { setSelectedOptionType });

    expect(screen.getByRole('heading', { name: /Categories Management/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Verticals' }));
    expect(setSelectedOptionType).toHaveBeenCalledWith('verticals');
  });

  it('keeps the bulk password tool out of the primary action slot', async () => {
    renderTab(<UsersTab />);

    // The directory's primary action stays singular.
    expect(screen.getAllByRole('button', { name: /Add New User/ })).toHaveLength(1);
    // The pick-any-user flow lives behind the overflow menu.
    await userEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('menuitem', { name: /Change any user's password/ })).toBeInTheDocument();
  });

  it('blocks an FMS dispatch until a faculty id is entered', () => {
    renderTab(<FmsTab />);
    expect(screen.getByRole('button', { name: /Dispatch FMS Sync/ })).toBeDisabled();
  });

  it('filters the reporting tree and keeps managers above a match', async () => {
    renderTab(<HierarchyTab />);
    expect(screen.getByText('Ananya Sharma')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search the reporting tree'), 'Rohit');
    expect(screen.getByText('Ananya Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rohit Menon')).toBeInTheDocument();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it('requires both a coordinator and a manager before assigning', async () => {
    const assignCoordinator = vi.fn(noop);
    const { container } = renderTab(<MappingsTab />, { assignCoordinator });

    // Scope to the assignment form: the filter bar reuses the same two labels.
    const form = container.querySelector('form') as HTMLFormElement;
    const submit = screen.getByRole('button', { name: 'Assign' });
    expect(submit).toBeDisabled();

    await userEvent.selectOptions(within(form).getByLabelText(/^Coordinator/), 'u2');
    await userEvent.selectOptions(within(form).getByLabelText(/^Manager/), 'u1');
    await userEvent.click(submit);

    expect(assignCoordinator).toHaveBeenCalledWith('u2', 'u1');
  });

  it('gives every table a column picker and a CSV export of the filtered rows', () => {
    const { container } = renderTab(<TeamsTab />);
    const table = container.querySelector('table') as HTMLTableElement;

    const headings = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headings).toContain('Team Name');
    expect(headings).toContain('Actions');
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('hides a column when it is unchecked in the column picker', async () => {
    const { container } = renderTab(<TeamsTab />);

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Active Members' }));

    const headings = within(container.querySelector('table') as HTMLTableElement)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headings).not.toContain('Active Members');
    expect(headings).toContain('Team Name');
  });
});
