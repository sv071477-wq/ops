"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  api, Role, Team, User, UserHierarchyNode, BatchOption, FmsSyncLog, CoordinatorMappingRecord
} from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { notifyError, notifySuccess, errorMessage } from "@/lib/notify";
import { useConfirm } from "@/components/ConfirmProvider";
import { Navbar } from "@/components/Navbar";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { PaginationControls } from "@/components/PaginationControls";
import { FullscreenTable, PlainHeaderCell, SortableHeaderCell, TableFilters } from "@/components/table";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertCircle, ArrowRightLeft, Briefcase, Building2, CheckCircle2, Database, Edit2,
  GitFork, KeyRound, Layers, Link2, Network, Plus, RefreshCw, Search, Shield, Sliders,
  Tag, Trash2, UserCheck, UserPlus, Users
} from "lucide-react";

type AdminTabKey = "teams" | "roles" | "options" | "users" | "fms" | "hierarchy" | "mappings";
type OptionTypeKey =
  | "categories" | "delivery-modes" | "accommodations" | "entities" | "faculty-types" | "verticals";

const OPTION_TYPE_LABELS: Record<OptionTypeKey, string> = {
  categories: "Categories",
  "delivery-modes": "Delivery Modes",
  accommodations: "Accommodations",
  entities: "Legal Entities",
  "faculty-types": "Faculty Types",
  verticals: "Verticals",
};

const TD = "px-5 py-3.5 text-sm align-middle";

const PANEL_CLASS = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

// The shared header cells render inline styles, so `TABLE_TH_STYLE` overrides the
// shared heading typography to match the Tailwind look of this portal, and sets
// the heading padding to match `TD`.
const TABLE_TH_STYLE: React.CSSProperties = {
  padding: "14px 20px",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-muted-foreground)",
};

const TABLE_TH_RIGHT_STYLE: React.CSSProperties = { ...TABLE_TH_STYLE, textAlign: "right" };

const SORT_ACCENT = "var(--color-primary)";

const PANEL_HEADER_STYLE: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
};

const PANEL_TITLE_STYLE: React.CSSProperties = { whiteSpace: "normal", flex: "1 1 260px" };

const activeStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");

function joinTableText(values: (string | number | null | undefined)[]): string {
  return values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .join(" ");
}

const TEAM_SORT_ACCESSORS: SortAccessors<Team> = {
  name: (t) => t.name,
  description: (t) => t.description,
  members: (t) => t.member_count ?? 0,
  status: (t) => activeStatusLabel(t.is_active),
  createdAt: (t) => t.created_at,
};

const TEAM_SORT_OPTIONS = [
  { key: "name", label: "Team Name" },
  { key: "description", label: "Description" },
  { key: "members", label: "Active Members" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

const TEAM_DESC_FIRST_KEYS = ["createdAt"];

const TEAM_FILTER_FIELDS: readonly TableFilterField<Team>[] = [
  { key: "status", accessor: TEAM_SORT_ACCESSORS.status },
];

const TEAM_SEARCH: TableAccessor<Team> = (t) => joinTableText([t.name, t.description, t.department]);

const ROLE_SORT_ACCESSORS: SortAccessors<Role> = {
  name: (r) => r.name,
  systemRole: (r) => r.system_role,
  status: (r) => activeStatusLabel(r.is_active),
  createdAt: (r) => r.created_at,
};

const ROLE_SORT_OPTIONS = [
  { key: "name", label: "Position Title / Role Name" },
  { key: "systemRole", label: "Base System Capability" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

const ROLE_DESC_FIRST_KEYS = ["createdAt"];

const ROLE_FILTER_FIELDS: readonly TableFilterField<Role>[] = [
  { key: "systemRole", accessor: ROLE_SORT_ACCESSORS.systemRole },
  { key: "status", accessor: ROLE_SORT_ACCESSORS.status },
];

const ROLE_SEARCH: TableAccessor<Role> = (r) => joinTableText([r.name, r.system_role]);

const OPTION_SORT_ACCESSORS: SortAccessors<BatchOption> = {
  name: (o) => o.name,
  description: (o) => o.description,
  status: (o) => activeStatusLabel(o.is_active),
};

const OPTION_SORT_OPTIONS = [
  { key: "name", label: "Option Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
];

const OPTION_FILTER_FIELDS: readonly TableFilterField<BatchOption>[] = [
  { key: "status", accessor: OPTION_SORT_ACCESSORS.status },
];

const OPTION_SEARCH: TableAccessor<BatchOption> = (o) => joinTableText([o.name, o.description]);

const USER_SORT_ACCESSORS: SortAccessors<User> = {
  fullName: (u) => u.full_name,
  email: (u) => u.email,
  role: (u) => u.role_detail?.name || u.role,
  team: (u) => u.team_detail?.name || u.team_name,
  manager: (u) => u.manager_name,
  reports: (u) => u.direct_reports_count ?? 0,
  status: (u) => activeStatusLabel(u.is_active),
};

const USER_SORT_OPTIONS = [
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Corporate Email" },
  { key: "role", label: "Assigned Role / Title" },
  { key: "team", label: "Assigned Team (Dept)" },
  { key: "manager", label: "Reports To (Manager)" },
  { key: "reports", label: "Direct Reports" },
  { key: "status", label: "Status" },
];

const USER_FILTER_FIELDS: readonly TableFilterField<User>[] = [
  { key: "role", accessor: USER_SORT_ACCESSORS.role },
  { key: "team", accessor: USER_SORT_ACCESSORS.team },
  { key: "status", accessor: USER_SORT_ACCESSORS.status },
];

const USER_SEARCH: TableAccessor<User> = (u) =>
  joinTableText([u.full_name, u.email, u.role, u.team_name, u.manager_name]);

const FMS_SORT_ACCESSORS: SortAccessors<FmsSyncLog> = {
  facultyId: (log) => log.faculty_id,
  eventType: (log) => log.event_type,
  status: (log) => log.status,
  timestamp: (log) => log.timestamp,
  message: (log) => log.message,
};

const FMS_SORT_OPTIONS = [
  { key: "facultyId", label: "Faculty ID" },
  { key: "eventType", label: "Event Type" },
  { key: "status", label: "Status" },
  { key: "timestamp", label: "Timestamp" },
  { key: "message", label: "Message" },
];

const FMS_DESC_FIRST_KEYS = ["timestamp"];

const FMS_FILTER_FIELDS: readonly TableFilterField<FmsSyncLog>[] = [
  { key: "eventType", accessor: FMS_SORT_ACCESSORS.eventType },
  { key: "status", accessor: FMS_SORT_ACCESSORS.status },
];

const FMS_SEARCH: TableAccessor<FmsSyncLog> = (log) =>
  joinTableText([log.faculty_id, log.event_type, log.status, log.message]);

const MAPPING_SORT_ACCESSORS: SortAccessors<CoordinatorMappingRecord> = {
  coordinator: (m) => m.coordinator_name,
  manager: (m) => m.manager_name,
  assignedAt: (m) => m.assigned_at,
};

const MAPPING_SORT_OPTIONS = [
  { key: "coordinator", label: "Coordinator" },
  { key: "manager", label: "Mapped Manager" },
  { key: "assignedAt", label: "Assigned On" },
];

const MAPPING_DESC_FIRST_KEYS = ["assignedAt"];

const MAPPING_FILTER_FIELDS: readonly TableFilterField<CoordinatorMappingRecord>[] = [
  { key: "coordinator", accessor: MAPPING_SORT_ACCESSORS.coordinator },
  { key: "manager", accessor: MAPPING_SORT_ACCESSORS.manager },
];

const MAPPING_SEARCH: TableAccessor<CoordinatorMappingRecord> = (m) =>
  joinTableText([m.coordinator_name, m.coordinator_email, m.manager_name, m.manager_email]);

type Tone = "primary" | "info" | "success" | "warning" | "violet";

const TONE_ICON: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  violet: "bg-violet-500/10 text-violet-600",
};

const TONE_VALUE: Record<Tone, string> = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-amber-600",
  violet: "text-violet-600",
};

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-[1.75rem] font-extrabold leading-none tracking-tight", TONE_VALUE[tone])}>
          {value}
        </p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground/80">{hint}</p>
      </div>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE_ICON[tone])}>
        {icon}
      </span>
    </div>
  );
}

function PanelHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function TablePanelTitle({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(PANEL_CLASS, className)}>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-light px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "sm:max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={cn("flex max-h-[90vh] flex-col overflow-hidden p-0", maxWidth)}>
        <DialogHeader className="shrink-0 border-b border-border/70 bg-muted/40 px-6 py-5 pr-14">
          <DialogTitle className="text-lg font-bold tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>}
        </DialogHeader>
        <div className="modal-scroll-content flex-1 space-y-4 px-6 py-5">{children}</div>
        {footer && (
          <DialogFooter className="shrink-0 gap-3 border-t border-border/70 bg-muted/40 px-6 py-4 sm:justify-end">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        active ? "text-success" : "text-muted-foreground/70"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", active ? "bg-success" : "bg-muted-foreground/50")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const ROW_ACTIONS = "flex items-center justify-end gap-1";

// Recursive Org Tree Node Component
const OrgTreeNode: React.FC<{ node: UserHierarchyNode; depth?: number }> = ({ node, depth = 0 }) => {
  const hasChildren = node.direct_reports && node.direct_reports.length > 0;
  const isManager = hasChildren || node.role?.toLowerCase() === "manager" || node.role?.toLowerCase() === "admin";

  return (
    <div className="relative" style={{ marginTop: depth > 0 ? 12 : 0, marginLeft: depth > 0 ? 28 : 0 }}>
      {depth > 0 && (
        <span className="absolute -left-4 top-6 h-px w-4 bg-border" aria-hidden="true" />
      )}

      <div
        className={cn(
          "flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors sm:px-5",
          isManager
            ? "border-primary/30 border-l-4 border-l-primary bg-card shadow-sm"
            : "border-border/70 bg-muted/30"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
              isManager ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {node.full_name ? node.full_name.charAt(0).toUpperCase() : "U"}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-foreground">{node.full_name}</span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[0.7rem] font-semibold",
                  isManager ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {node.role_name || node.role}
              </span>
              {node.team_name && <Badge variant="info" size="sm">{node.team_name}</Badge>}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{node.email}</p>
          </div>
        </div>

        <div className="shrink-0">
          {hasChildren ? (
            <Badge variant="success" size="sm">
              Manages {node.direct_reports.length} direct report{node.direct_reports.length === 1 ? "" : "s"}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground/70">Individual contributor</span>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="ml-3.5 border-l-2 border-border pl-4 sm:ml-4">
          {node.direct_reports.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminPortalPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const confirmAction = useConfirm();

  const [activeTab, setActiveTab] = useState<AdminTabKey>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<UserHierarchyNode[]>([]);
  const [approver1Id, setApprover1Id] = useState("");
  const [approver2Id, setApprover2Id] = useState("");
  const [isSavingApprovers, setIsSavingApprovers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Batch Taxonomy Options state
  const [selectedOptionType, setSelectedOptionType] = useState<OptionTypeKey>("categories");
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isCreateOptionOpen, setIsCreateOptionOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionDesc, setNewOptionDesc] = useState("");
  const [optionFormError, setOptionFormError] = useState<string | null>(null);
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);

  // FMS Integration state
  const [fmsLogs, setFmsLogs] = useState<FmsSyncLog[]>([]);
  const [isLoadingFms, setIsLoadingFms] = useState(false);
  const [syncFacultyId, setSyncFacultyId] = useState("");
  const [syncEventType, setSyncEventType] = useState("HOURS_UPDATE");
  const [isSyncingFms, setIsSyncingFms] = useState(false);
  const [fmsSyncMsg, setFmsSyncMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal States
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDepartment, setEditTeamDepartment] = useState("Ops");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [editTeamError, setEditTeamError] = useState<string | null>(null);
  const [isSubmittingEditTeam, setIsSubmittingEditTeam] = useState(false);

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);

  const handleOpenChangePassword = (target: User | null) => {
    setPasswordTargetUser(target);
    setIsChangePasswordOpen(true);
  };

  // Form States for Team Creation
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDepartment, setNewTeamDepartment] = useState("Ops");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [teamFormError, setTeamFormError] = useState<string | null>(null);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);

  // Form States for Role Creation
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSystemRole, setNewRoleSystemRole] = useState("Coordinator");
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Form States for User Creation
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");
  const [newUserTeamId, setNewUserTeamId] = useState("");
  const [newUserReportsToId, setNewUserReportsToId] = useState<string>("");
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserRoleId, setEditUserRoleId] = useState("");
  const [editUserTeamId, setEditUserTeamId] = useState("");
  const [editUserReportsToId, setEditUserReportsToId] = useState("");
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [editUserFormError, setEditUserFormError] = useState<string | null>(null);
  const [isSubmittingEditUser, setIsSubmittingEditUser] = useState(false);

  // Coordinator Mappings state
  const [mappings, setMappings] = useState<CoordinatorMappingRecord[]>([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [mappingCoordinatorId, setMappingCoordinatorId] = useState("");
  const [mappingManagerId, setMappingManagerId] = useState("");
  const [mappingFormError, setMappingFormError] = useState<string | null>(null);
  const [isSubmittingMapping, setIsSubmittingMapping] = useState(false);

  // Pagination states for all admin tables
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  const [teamPage, setTeamPage] = useState(1);
  const [teamPageSize, setTeamPageSize] = useState(10);

  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);

  const [optionPage, setOptionPage] = useState(1);
  const [optionPageSize, setOptionPageSize] = useState(10);

  const [fmsLogPage, setFmsLogPage] = useState(1);
  const [fmsLogPageSize, setFmsLogPageSize] = useState(10);

  const [mappingPage, setMappingPage] = useState(1);
  const [mappingPageSize, setMappingPageSize] = useState(10);

  // Table sort + filter state for all admin tables: raw rows -> sorted -> filtered -> paginated
  const teamSort = useTableSort(teams, TEAM_SORT_ACCESSORS, {
    initialKey: "createdAt",
    initialDir: "desc",
    descFirstKeys: TEAM_DESC_FIRST_KEYS,
  });
  const teamFilters = useTableFilters(teamSort.sortedRows, TEAM_FILTER_FIELDS, TEAM_SEARCH);
  const filteredTeams = teamFilters.filteredRows;

  const roleSort = useTableSort(roles, ROLE_SORT_ACCESSORS, {
    initialKey: "createdAt",
    initialDir: "desc",
    descFirstKeys: ROLE_DESC_FIRST_KEYS,
  });
  const roleFilters = useTableFilters(roleSort.sortedRows, ROLE_FILTER_FIELDS, ROLE_SEARCH);
  const filteredRoles = roleFilters.filteredRows;

  const optionSort = useTableSort(batchOptions, OPTION_SORT_ACCESSORS);
  const optionFilters = useTableFilters(optionSort.sortedRows, OPTION_FILTER_FIELDS, OPTION_SEARCH);
  const filteredOptions = optionFilters.filteredRows;

  const userSort = useTableSort(users, USER_SORT_ACCESSORS);
  const userFilters = useTableFilters(userSort.sortedRows, USER_FILTER_FIELDS, USER_SEARCH);
  const filteredUsers = userFilters.filteredRows;

  const fmsSort = useTableSort(fmsLogs, FMS_SORT_ACCESSORS, {
    initialKey: "timestamp",
    initialDir: "desc",
    descFirstKeys: FMS_DESC_FIRST_KEYS,
  });
  const fmsFilters = useTableFilters(fmsSort.sortedRows, FMS_FILTER_FIELDS, FMS_SEARCH);
  const filteredFmsLogs = fmsFilters.filteredRows;

  const mappingSort = useTableSort(mappings, MAPPING_SORT_ACCESSORS, {
    initialKey: "assignedAt",
    initialDir: "desc",
    descFirstKeys: MAPPING_DESC_FIRST_KEYS,
  });
  const mappingFilters = useTableFilters(
    mappingSort.sortedRows,
    MAPPING_FILTER_FIELDS,
    MAPPING_SEARCH
  );
  const filteredMappings = mappingFilters.filteredRows;

  // Reset to the first page whenever a table's search or filters change
  useEffect(() => { setTeamPage(1); }, [teamFilters.filtersVersion]);
  useEffect(() => { setRolePage(1); }, [roleFilters.filtersVersion]);
  useEffect(() => { setOptionPage(1); }, [optionFilters.filtersVersion]);
  useEffect(() => { setUserPage(1); }, [userFilters.filtersVersion]);
  useEffect(() => { setFmsLogPage(1); }, [fmsFilters.filtersVersion]);
  useEffect(() => { setMappingPage(1); }, [mappingFilters.filtersVersion]);

  // Derived paginated records
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  const paginatedTeams = useMemo(() => {
    const start = (teamPage - 1) * teamPageSize;
    return filteredTeams.slice(start, start + teamPageSize);
  }, [filteredTeams, teamPage, teamPageSize]);

  const paginatedRoles = useMemo(() => {
    const start = (rolePage - 1) * rolePageSize;
    return filteredRoles.slice(start, start + rolePageSize);
  }, [filteredRoles, rolePage, rolePageSize]);

  const paginatedOptions = useMemo(() => {
    const start = (optionPage - 1) * optionPageSize;
    return filteredOptions.slice(start, start + optionPageSize);
  }, [filteredOptions, optionPage, optionPageSize]);

  const paginatedFmsLogs = useMemo(() => {
    const start = (fmsLogPage - 1) * fmsLogPageSize;
    return filteredFmsLogs.slice(start, start + fmsLogPageSize);
  }, [filteredFmsLogs, fmsLogPage, fmsLogPageSize]);

  const paginatedMappings = useMemo(() => {
    const start = (mappingPage - 1) * mappingPageSize;
    return filteredMappings.slice(start, start + mappingPageSize);
  }, [filteredMappings, mappingPage, mappingPageSize]);

  // Security Check
  useEffect(() => {
    if (!isAuthLoading) {
      if (!user) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        } else {
          router.push("/login");
        }
      } else if (user.role?.toLowerCase() !== "admin") {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        } else {
          router.push("/");
        }
      }
    }
  }, [user, isAuthLoading, router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTeams, fetchedRoles, fetchedUsers, fetchedHierarchy, approvalConfig] = await Promise.all([
        api.getTeams().catch(() => []),
        api.getRoles(),
        api.getUsers().catch(() => []),
        api.getHierarchy().catch(() => []),
        api.getApprovalConfiguration().catch(() => null),
      ]);
      setTeams(fetchedTeams);
      setRoles(fetchedRoles);
      setUsers(fetchedUsers);
      setHierarchy(fetchedHierarchy);
      if (approvalConfig) {
        setApprover1Id(approvalConfig.approver_1_id || "");
        setApprover2Id(approvalConfig.approver_2_id || "");
      }

      if (fetchedRoles.length > 0 && !newUserRoleId) setNewUserRoleId(fetchedRoles[0].id);
      if (fetchedTeams.length > 0 && !newUserTeamId) setNewUserTeamId(fetchedTeams[0].id);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Batch Options
  const fetchBatchOptions = async () => {
    setIsLoadingOptions(true);
    try {
      const opts = await api.getBatchOptions(selectedOptionType);
      setBatchOptions(opts);
    } catch (err) {
      console.error("Failed to load options:", err);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Fetch FMS Logs
  const fetchFmsLogs = async () => {
    setIsLoadingFms(true);
    try {
      const logs = await api.getFmsLogs();
      setFmsLogs(logs);
    } catch (err) {
      console.error("Failed to load FMS logs:", err);
    } finally {
      setIsLoadingFms(false);
    }
  };

  useEffect(() => {
    if (user && user.role?.toLowerCase() === "admin") {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "options") {
      fetchBatchOptions();
    } else if (activeTab === "fms") {
      fetchFmsLogs();
    } else if (activeTab === "mappings") {
      fetchMappings();
    }
  }, [activeTab, selectedOptionType]);

  const handleSaveApprovers = async () => {
    setIsSavingApprovers(true);
    try {
      await api.updateApprovalConfiguration({ approver_1_id: approver1Id, approver_2_id: approver2Id });
      notifySuccess("Approval levels saved");
    } catch (err: any) {
      notifyError("Failed to save approvers", err);
    } finally {
      setIsSavingApprovers(false);
    }
  };

  const fetchMappings = async () => {
    setIsLoadingMappings(true);
    try {
      const data = await api.listCoordinatorMappings();
      setMappings(data);
    } catch (err) {
      console.error("Failed to load mappings:", err);
    } finally {
      setIsLoadingMappings(false);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingCoordinatorId || !mappingManagerId) {
      setMappingFormError("Please select both a coordinator and a manager.");
      return;
    }
    setMappingFormError(null);
    setIsSubmittingMapping(true);
    try {
      await api.assignCoordinator({ coordinator_id: mappingCoordinatorId, manager_id: mappingManagerId });
      setMappingCoordinatorId("");
      setMappingManagerId("");
      await fetchMappings();
    } catch (err: any) {
      setMappingFormError(errorMessage(err, "Failed to create mapping"));
    } finally {
      setIsSubmittingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string, name: string) => {
    const ok = await confirmAction({
      title: "Remove coordinator mapping?",
      description: `This removes the mapping for "${name}".`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteCoordinatorMapping(mappingId);
      notifySuccess("Mapping removed");
      await fetchMappings();
    } catch (err: any) {
      notifyError("Failed to remove mapping", err);
    }
  };

  // Handle Add Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamFormError(null);
    setIsSubmittingTeam(true);

    try {
      await api.createTeam({
        name: newTeamName.trim(),
        department: newTeamDepartment.trim() || "Ops",
        description: newTeamDescription.trim() || undefined,
        is_active: true,
      });
      setNewTeamName("");
      setNewTeamDepartment("Ops");
      setNewTeamDescription("");
      setIsCreateTeamOpen(false);
      await fetchData();
    } catch (err: any) {
      setTeamFormError(errorMessage(err, "Failed to create team"));
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  // Handle Delete Team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const ok = await confirmAction({
      title: "Delete team?",
      description: `"${teamName}" will be deleted. Any assigned users will become unassigned from this team.`,
      confirmLabel: "Delete team",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteTeam(teamId);
      notifySuccess("Team deleted");
      await fetchData();
    } catch (err) {
      notifyError("Failed to delete team", err);
    }
  };

  // Handle Open Edit Team
  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamDepartment(team.department || "Ops");
    setEditTeamDescription(team.description || "");
    setEditTeamError(null);
    setIsEditTeamOpen(true);
  };

  // Handle Save Edited Team
  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setEditTeamError(null);
    setIsSubmittingEditTeam(true);

    try {
      await api.updateTeam(editingTeam.id, {
        name: editTeamName.trim(),
        department: editTeamDepartment.trim() || "Ops",
        description: editTeamDescription.trim() || undefined,
      });
      setIsEditTeamOpen(false);
      setEditingTeam(null);
      await fetchData();
    } catch (err: any) {
      setEditTeamError(errorMessage(err, "Failed to update team"));
    } finally {
      setIsSubmittingEditTeam(false);
    }
  };

  // Handle Add Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleFormError(null);
    setIsSubmittingRole(true);

    try {
      await api.createRole({
        name: newRoleName.trim(),
        system_role: newRoleSystemRole,
        is_active: true,
      });
      setNewRoleName("");
      setIsCreateRoleOpen(false);
      await fetchData();
    } catch (err: any) {
      setRoleFormError(errorMessage(err, "Failed to create role"));
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Handle Delete Role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    const ok = await confirmAction({
      title: "Delete position title?",
      description: `"${roleName}" will be removed from the organization.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteRole(roleId);
      notifySuccess("Position title deleted");
      await fetchData();
    } catch (err) {
      notifyError("Failed to delete role", err);
    }
  };

  // Handle Add Batch Option
  const handleCreateOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setOptionFormError(null);
    setIsSubmittingOption(true);

    try {
      if (selectedOptionType === "faculty-types") {
        await api.createFacultyType({
          name: newOptionName.trim(),
          description: newOptionDesc.trim() || undefined,
        });
      } else if (selectedOptionType === "verticals") {
        await api.createVertical({
          name: newOptionName.trim(),
          description: newOptionDesc.trim() || undefined,
        });
      } else {
        await api.createBatchOption(selectedOptionType, {
          name: newOptionName.trim(),
          description: newOptionDesc.trim() || undefined,
        });
      }
      setNewOptionName("");
      setNewOptionDesc("");
      setIsCreateOptionOpen(false);
      await fetchBatchOptions();
    } catch (err: any) {
      setOptionFormError(errorMessage(err, "Failed to create option"));
    } finally {
      setIsSubmittingOption(false);
    }
  };

  // Handle Delete Batch Option
  const handleDeleteOption = async (optionId: string, optionName: string) => {
    const ok = await confirmAction({
      title: "Deactivate taxonomy option?",
      description: `"${optionName}" will no longer be selectable.`,
      confirmLabel: "Deactivate",
      destructive: true,
    });
    if (!ok) return;
    try {
      if (selectedOptionType === "faculty-types") {
        await api.deleteFacultyType(optionId);
      } else if (selectedOptionType === "verticals") {
        await api.deleteVertical(optionId);
      } else {
        await api.deleteBatchOption(selectedOptionType, optionId);
      }
      notifySuccess("Option deactivated");
      await fetchBatchOptions();
    } catch (err) {
      notifyError("Failed to delete option", err);
    }
  };

  // Handle FMS Sync Dispatch
  const handleDispatchFmsSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncFacultyId) return;
    setIsSyncingFms(true);
    setFmsSyncMsg(null);

    try {
      await api.syncFacultyFms(syncFacultyId, syncEventType);
      setFmsSyncMsg({ type: "success", text: `Successfully dispatched ${syncEventType} to external FMS!` });
      await fetchFmsLogs();
    } catch (err: any) {
      setFmsSyncMsg({ type: "error", text: errorMessage(err, "FMS Sync dispatch failed") });
    } finally {
      setIsSyncingFms(false);
    }
  };

  // Handle Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setIsSubmittingUser(true);

    try {
      await api.adminCreateUser({
        email: newUserEmail.trim().toLowerCase(),
        full_name: newUserFullName.trim(),
        role_id: newUserRoleId || undefined,
        team_id: newUserTeamId || undefined,
        manager_id: newUserReportsToId || undefined,
        is_active: true,
        send_welcome_email: true,
      });
      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserReportsToId("");
      setIsCreateUserOpen(false);
      await fetchData();
    } catch (err: any) {
      setUserFormError(errorMessage(err, "Failed to provision user"));
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenEditUser = (staffUser: User) => {
    setEditingUser(staffUser);
    setEditUserEmail(staffUser.email);
    setEditUserFullName(staffUser.full_name);
    setEditUserRoleId(staffUser.role_id || "");
    setEditUserTeamId(staffUser.team_id || "");
    setEditUserReportsToId(staffUser.manager_id || "");
    setEditUserIsActive(staffUser.is_active);
    setEditUserFormError(null);
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserFormError(null);
    setIsSubmittingEditUser(true);

    try {
      await api.updateUser(editingUser.id, {
        email: editUserEmail.trim().toLowerCase(),
        full_name: editUserFullName.trim(),
        role_id: editUserRoleId || null,
        team_id: editUserTeamId || null,
        manager_id: editUserReportsToId || null,
        is_active: editUserIsActive,
      });
      setIsEditUserOpen(false);
      await fetchData();
    } catch (err: any) {
      setEditUserFormError(errorMessage(err, "Failed to update staff member"));
    } finally {
      setIsSubmittingEditUser(false);
    }
  };

  const handleDeleteUser = async (staffUser: User) => {
    if (staffUser.id === user?.id) {
      notifyError("You cannot delete your own admin account.");
      return;
    }
    const ok = await confirmAction({
      title: "Delete staff member?",
      description: `This permanently removes the account for "${staffUser.full_name}".`,
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteUser(staffUser.id);
      notifySuccess("Staff member deleted");
      await fetchData();
    } catch (err) {
      notifyError("Failed to delete staff member", err);
    }
  };

  if (isAuthLoading || !user || user.role?.toLowerCase() !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying Administrator Privileges...</span>
        </div>
      </div>
    );
  }

  const managerCount = users.filter((u) => u.is_manager || (u.direct_reports_count && u.direct_reports_count > 0)).length;
  const opsTeamCount = teams.filter((t) => (t.department || "").toLowerCase() === "ops").length;
  const approverCandidates = users.filter((u) => u.is_active && (u.role === "Admin" || u.role === "Manager"));
  const coordinatorCandidates = users.filter((u) => u.role === "Coordinator" && u.is_active);
  const managerCandidates = users.filter((u) => (u.role === "Manager" || u.role === "Admin") && u.is_active);

  const tabs: { key: AdminTabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "teams", label: "Ops Teams", icon: Layers, count: teams.length },
    { key: "roles", label: "Roles & Titles", icon: Tag, count: roles.length },
    { key: "options", label: "Batch Taxonomy", icon: Sliders, count: batchOptions.length },
    { key: "users", label: "Staff Directory", icon: Users, count: users.length },
    { key: "fms", label: "FMS External Sync", icon: ArrowRightLeft },
    { key: "hierarchy", label: "Hierarchy Tree", icon: GitFork, count: hierarchy.length },
    { key: "mappings", label: "Coordinator Mappings", icon: Link2, count: mappings.length },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Page header */}
          <div className="flex flex-col gap-6 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-primary">
                <Shield className="h-3.5 w-3.5" />
                Administration &amp; Governance
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Enterprise Governance &amp; Taxonomy Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Manage Ops teams, position titles, batch taxonomy options, staff directory, and FMS integrations.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Configured Teams"
              value={teams.length}
              hint={`${opsTeamCount} in Ops department`}
              tone="info"
            />
            <StatCard
              icon={<Briefcase className="h-5 w-5" />}
              label="Configured Roles"
              value={roles.length}
              hint="Dynamic position titles"
              tone="primary"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Registered Staff"
              value={users.length}
              hint="Active employees"
              tone="violet"
            />
            <StatCard
              icon={<UserCheck className="h-5 w-5" />}
              label="Managers / Leads"
              value={managerCount}
              hint="With direct reports"
              tone="success"
            />
            <StatCard
              icon={<Network className="h-5 w-5" />}
              label="Reporting Trees"
              value={hierarchy.length}
              hint="Root leadership branches"
              tone="warning"
            />
          </div>

          {/* Tab navigation */}
          <div className="mb-6 overflow-x-auto pb-1 scrollbar-thin">
            <nav
              aria-label="Administration sections"
              className="inline-flex min-w-full items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {typeof tab.count === "number" && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold",
                          isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-6 pb-10">
            {/* TAB: OPS TEAMS */}
            {activeTab === "teams" && (
              <FullscreenTable
                panelClassName={PANEL_CLASS}
                headerStyle={PANEL_HEADER_STYLE}
                titleStyle={PANEL_TITLE_STYLE}
                title={
                  <TablePanelTitle
                    title="Ops Teams Management"
                    description="Functional delivery, sales, and finance teams operating within the Operations Department."
                  />
                }
                toolbar={
                  <TableFilters
                    search={{
                      value: teamFilters.search,
                      onChange: teamFilters.setSearch,
                      placeholder: "Search teams by name or description...",
                    }}
                    selects={[
                      {
                        key: "status",
                        label: "Status",
                        value: teamFilters.getFilter("status"),
                        onChange: (value) => teamFilters.setFilter("status", value),
                        options: teamFilters.optionsFor("status"),
                        allLabel: "All statuses",
                      },
                    ]}
                    sort={{
                      options: TEAM_SORT_OPTIONS,
                      sortKey: teamSort.sortKey,
                      sortDir: teamSort.sortDir,
                      onChange: teamSort.applySort,
                    }}
                    onClear={teamFilters.clearFilters}
                    hasActiveFilters={teamFilters.hasActiveFilters}
                    activeFilterCount={teamFilters.activeFilterCount}
                  />
                }
                actions={
                  <Button onClick={() => setIsCreateTeamOpen(true)}>
                    <Plus className="h-4 w-4" />
                    <span>Create New Team</span>
                  </Button>
                }
                footer={
                  <PaginationControls
                    currentPage={teamPage}
                    totalItems={filteredTeams.length}
                    pageSize={teamPageSize}
                    onPageChange={setTeamPage}
                    onPageSizeChange={(newSize) => {
                      setTeamPageSize(newSize);
                      setTeamPage(1);
                    }}
                  />
                }
              >
                {teams.length === 0 ? (
                  <EmptyState
                    icon={<Layers className="h-5 w-5" />}
                    title="No teams created yet"
                    description="Use “Create New Team” to add your first operational team."
                  />
                ) : (
                  <table className="glass-table w-full border-collapse">
                    <thead>
                      <tr>
                        <SortableHeaderCell
                          columnKey="name"
                          label="Team Name"
                          style={TABLE_TH_STYLE}
                          sortKey={teamSort.sortKey}
                          sortDir={teamSort.sortDir}
                          onSort={teamSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="description"
                          label="Description"
                          style={TABLE_TH_STYLE}
                          sortKey={teamSort.sortKey}
                          sortDir={teamSort.sortDir}
                          onSort={teamSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="members"
                          label="Active Members"
                          style={TABLE_TH_STYLE}
                          sortKey={teamSort.sortKey}
                          sortDir={teamSort.sortDir}
                          onSort={teamSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="status"
                          label="Status"
                          style={TABLE_TH_STYLE}
                          sortKey={teamSort.sortKey}
                          sortDir={teamSort.sortDir}
                          onSort={teamSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="createdAt"
                          label="Created At"
                          style={TABLE_TH_STYLE}
                          sortKey={teamSort.sortKey}
                          sortDir={teamSort.sortDir}
                          onSort={teamSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <PlainHeaderCell style={TABLE_TH_RIGHT_STYLE}>Actions</PlainHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTeams.map((t) => (
                        <tr key={t.id} className="border-b border-border/70 last:border-0">
                          <td className={cn(TD, "font-semibold text-foreground")}>{t.name}</td>
                          <td className={cn(TD, "max-w-[280px] truncate text-muted-foreground")} title={t.description || ""}>
                            {t.description || "—"}
                          </td>
                          <td className={TD}>
                            <Badge variant={t.member_count ? "success" : "secondary"}>
                              {t.member_count || 0} member{t.member_count === 1 ? "" : "s"}
                            </Badge>
                          </td>
                          <td className={TD}><StatusPill active={t.is_active} /></td>
                          <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDate(t.created_at)}</td>
                          <td className={cn(TD, "text-right")}>
                            <div className={ROW_ACTIONS}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditTeam(t)}
                                title="Edit Team"
                                aria-label={`Edit ${t.name}`}
                                className="h-8 gap-1.5 px-2 text-primary hover:bg-primary/10 hover:text-primary"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTeam(t.id, t.name)}
                                title="Delete Team"
                                aria-label={`Delete ${t.name}`}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </FullscreenTable>
            )}

            {/* TAB: ROLES & APPROVAL CONFIG */}
            {activeTab === "roles" && (
              <div className="space-y-6">
                <Panel>
                  <PanelHeading
                    title="Batch Approval Configuration"
                    description="Designate the two approvers every batch passes through before it can be scheduled."
                  />

                  <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <FormField label="Approver 1 — Level 1">
                      <select
                        value={approver1Id}
                        onChange={(e) => setApprover1Id(e.target.value)}
                        className="glass-input"
                      >
                        <option value="">Select approver 1</option>
                        {approverCandidates.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Approver 2 — Level 2">
                      <select
                        value={approver2Id}
                        onChange={(e) => setApprover2Id(e.target.value)}
                        className="glass-input"
                      >
                        <option value="">Select approver 2</option>
                        {approverCandidates.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                    </FormField>
                    <Button
                      onClick={handleSaveApprovers}
                      loading={isSavingApprovers}
                      className="lg:mb-0.5"
                    >
                      <span>Save Approvers</span>
                    </Button>
                  </div>
                </Panel>

                <FullscreenTable
                  panelClassName={PANEL_CLASS}
                  headerStyle={PANEL_HEADER_STYLE}
                  titleStyle={PANEL_TITLE_STYLE}
                  title={
                    <TablePanelTitle
                      title="Roles & Position Titles"
                      description="Create and manage the official organizational titles recognized in the platform."
                    />
                  }
                  toolbar={
                    <TableFilters
                      search={{
                        value: roleFilters.search,
                        onChange: roleFilters.setSearch,
                        placeholder: "Search position titles...",
                      }}
                      selects={[
                        {
                          key: "systemRole",
                          label: "Base System Capability",
                          value: roleFilters.getFilter("systemRole"),
                          onChange: (value) => roleFilters.setFilter("systemRole", value),
                          options: roleFilters.optionsFor("systemRole"),
                          allLabel: "All capabilities",
                          width: 175,
                        },
                        {
                          key: "status",
                          label: "Status",
                          value: roleFilters.getFilter("status"),
                          onChange: (value) => roleFilters.setFilter("status", value),
                          options: roleFilters.optionsFor("status"),
                          allLabel: "All statuses",
                        },
                      ]}
                      sort={{
                        options: ROLE_SORT_OPTIONS,
                        sortKey: roleSort.sortKey,
                        sortDir: roleSort.sortDir,
                        onChange: roleSort.applySort,
                      }}
                      onClear={roleFilters.clearFilters}
                      hasActiveFilters={roleFilters.hasActiveFilters}
                      activeFilterCount={roleFilters.activeFilterCount}
                    />
                  }
                  actions={
                    <Button onClick={() => setIsCreateRoleOpen(true)}>
                      <Plus className="h-4 w-4" />
                      <span>Add Position Title</span>
                    </Button>
                  }
                  footer={
                    <PaginationControls
                      currentPage={rolePage}
                      totalItems={filteredRoles.length}
                      pageSize={rolePageSize}
                      onPageChange={setRolePage}
                      onPageSizeChange={(newSize) => {
                        setRolePageSize(newSize);
                        setRolePage(1);
                      }}
                    />
                  }
                >
                  {roles.length === 0 ? (
                    <EmptyState
                      icon={<Tag className="h-5 w-5" />}
                      title="No position titles defined"
                      description="Add a position title to start assigning roles to staff."
                    />
                  ) : (
                    <table className="glass-table w-full border-collapse">
                      <thead>
                        <tr>
                          <SortableHeaderCell
                            columnKey="name"
                            label="Position Title / Role Name"
                            style={TABLE_TH_STYLE}
                            sortKey={roleSort.sortKey}
                            sortDir={roleSort.sortDir}
                            onSort={roleSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="systemRole"
                            label="Base System Capability"
                            style={TABLE_TH_STYLE}
                            sortKey={roleSort.sortKey}
                            sortDir={roleSort.sortDir}
                            onSort={roleSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="status"
                            label="Status"
                            style={TABLE_TH_STYLE}
                            sortKey={roleSort.sortKey}
                            sortDir={roleSort.sortDir}
                            onSort={roleSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="createdAt"
                            label="Created At"
                            style={TABLE_TH_STYLE}
                            sortKey={roleSort.sortKey}
                            sortDir={roleSort.sortDir}
                            onSort={roleSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <PlainHeaderCell style={TABLE_TH_RIGHT_STYLE}>Actions</PlainHeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRoles.map((r) => (
                          <tr key={r.id} className="border-b border-border/70 last:border-0">
                            <td className={cn(TD, "font-semibold text-foreground")}>{r.name}</td>
                            <td className={TD}>
                              <Badge variant="default" className="normal-case tracking-normal">
                                {r.system_role}
                              </Badge>
                            </td>
                            <td className={TD}><StatusPill active={r.is_active} /></td>
                            <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.created_at)}</td>
                            <td className={cn(TD, "text-right")}>
                              <div className={ROW_ACTIONS}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRole(r.id, r.name)}
                                  title="Deactivate Role"
                                  aria-label={`Delete ${r.name}`}
                                  className="ml-auto h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </FullscreenTable>
              </div>
            )}

            {/* TAB: BATCH TAXONOMY & DYNAMIC OPTIONS */}
            {activeTab === "options" && (
              <FullscreenTable
                panelClassName={PANEL_CLASS}
                headerStyle={PANEL_HEADER_STYLE}
                titleStyle={PANEL_TITLE_STYLE}
                title={
                  <TablePanelTitle
                    title="Batch Taxonomy & Option Management"
                    description="Configure predefined categories, delivery modes, accommodations, and legal entities."
                  />
                }
                toolbar={
                  <TableFilters
                    search={{
                      value: optionFilters.search,
                      onChange: optionFilters.setSearch,
                      placeholder: "Search options by name or description...",
                    }}
                    selects={[
                      {
                        key: "status",
                        label: "Status",
                        value: optionFilters.getFilter("status"),
                        onChange: (value) => optionFilters.setFilter("status", value),
                        options: optionFilters.optionsFor("status"),
                        allLabel: "All statuses",
                      },
                    ]}
                    sort={{
                      options: OPTION_SORT_OPTIONS,
                      sortKey: optionSort.sortKey,
                      sortDir: optionSort.sortDir,
                      onChange: optionSort.applySort,
                    }}
                    onClear={optionFilters.clearFilters}
                    hasActiveFilters={optionFilters.hasActiveFilters}
                    activeFilterCount={optionFilters.activeFilterCount}
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className="pl-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                        Option Set
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(Object.keys(OPTION_TYPE_LABELS) as OptionTypeKey[]).map((key) => {
                          const isActive = selectedOptionType === key;
                          return (
                            <Button
                              key={key}
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOptionType(key);
                                setOptionPage(1);
                              }}
                              aria-pressed={isActive}
                              className={cn(
                                "rounded-full px-3.5 text-xs font-semibold",
                                isActive
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {OPTION_TYPE_LABELS[key]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </TableFilters>
                }
                actions={
                  <Button onClick={() => setIsCreateOptionOpen(true)}>
                    <Plus className="h-4 w-4" />
                    <span>Add Taxonomy Option</span>
                  </Button>
                }
                footer={
                  isLoadingOptions || paginatedOptions.length === 0 ? undefined : (
                    <PaginationControls
                      currentPage={optionPage}
                      totalItems={filteredOptions.length}
                      pageSize={optionPageSize}
                      onPageChange={setOptionPage}
                      onPageSizeChange={(newSize) => {
                        setOptionPageSize(newSize);
                        setOptionPage(1);
                      }}
                    />
                  )
                }
              >
                {isLoadingOptions ? (
                  <LoadingState label="Loading taxonomy options..." />
                ) : paginatedOptions.length === 0 ? (
                  <EmptyState
                    icon={<Sliders className="h-5 w-5" />}
                    title={`No ${OPTION_TYPE_LABELS[selectedOptionType].toLowerCase()} configured`}
                    description="Add an option so it becomes selectable when a batch is created."
                  />
                ) : (
                  <table className="glass-table w-full border-collapse">
                    <thead>
                      <tr>
                        <SortableHeaderCell
                          columnKey="name"
                          label="Option Name"
                          style={TABLE_TH_STYLE}
                          sortKey={optionSort.sortKey}
                          sortDir={optionSort.sortDir}
                          onSort={optionSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="description"
                          label="Description"
                          style={TABLE_TH_STYLE}
                          sortKey={optionSort.sortKey}
                          sortDir={optionSort.sortDir}
                          onSort={optionSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="status"
                          label="Status"
                          style={TABLE_TH_STYLE}
                          sortKey={optionSort.sortKey}
                          sortDir={optionSort.sortDir}
                          onSort={optionSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <PlainHeaderCell style={TABLE_TH_RIGHT_STYLE}>Actions</PlainHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOptions.map((opt) => (
                        <tr key={opt.id} className="border-b border-border/70 last:border-0">
                          <td className={cn(TD, "font-semibold text-foreground")}>{opt.name}</td>
                          <td className={cn(TD, "max-w-[380px] truncate text-muted-foreground")} title={opt.description || ""}>
                            {opt.description || "—"}
                          </td>
                          <td className={TD}><StatusPill active={opt.is_active} /></td>
                          <td className={cn(TD, "text-right")}>
                            <div className={ROW_ACTIONS}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOption(opt.id, opt.name)}
                                title="Deactivate Option"
                                aria-label={`Deactivate ${opt.name}`}
                                className="ml-auto h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </FullscreenTable>
            )}

            {/* TAB: STAFF DIRECTORY */}
            {activeTab === "users" && (
              <FullscreenTable
                panelClassName={PANEL_CLASS}
                headerStyle={PANEL_HEADER_STYLE}
                titleStyle={PANEL_TITLE_STYLE}
                title={
                  <TablePanelTitle
                    title="Organization Staff Directory"
                    description="Provision new employees, assign position titles, assign teams (Ops, etc.), and configure reporting managers."
                  />
                }
                toolbar={
                  <TableFilters
                    search={{
                      value: userFilters.search,
                      onChange: userFilters.setSearch,
                      placeholder: "Search staff by name, email, role, team...",
                      width: 256,
                    }}
                    selects={[
                      {
                        key: "role",
                        label: "Role",
                        value: userFilters.getFilter("role"),
                        onChange: (value) => userFilters.setFilter("role", value),
                        options: userFilters.optionsFor("role"),
                        allLabel: "All roles",
                      },
                      {
                        key: "team",
                        label: "Team",
                        value: userFilters.getFilter("team"),
                        onChange: (value) => userFilters.setFilter("team", value),
                        options: userFilters.optionsFor("team"),
                        allLabel: "All teams",
                      },
                      {
                        key: "status",
                        label: "Status",
                        value: userFilters.getFilter("status"),
                        onChange: (value) => userFilters.setFilter("status", value),
                        options: userFilters.optionsFor("status"),
                        allLabel: "All statuses",
                      },
                    ]}
                    sort={{
                      options: USER_SORT_OPTIONS,
                      sortKey: userSort.sortKey,
                      sortDir: userSort.sortDir,
                      onChange: userSort.applySort,
                    }}
                    onClear={userFilters.clearFilters}
                    hasActiveFilters={userFilters.hasActiveFilters}
                    activeFilterCount={userFilters.activeFilterCount}
                  />
                }
                actions={
                  <>
                    <Button variant="outline" onClick={() => handleOpenChangePassword(null)}>
                      <KeyRound className="h-4 w-4 text-amber-600" />
                      <span>Change User Password</span>
                    </Button>
                    <Button onClick={() => setIsCreateUserOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                      <span>Add New User</span>
                    </Button>
                  </>
                }
                footer={
                  paginatedUsers.length === 0 ? undefined : (
                    <PaginationControls
                      currentPage={userPage}
                      totalItems={filteredUsers.length}
                      pageSize={userPageSize}
                      pageSizeOptions={[10, 25, 50, 100]}
                      onPageChange={setUserPage}
                      onPageSizeChange={(newSize) => {
                        setUserPageSize(newSize);
                        setUserPage(1);
                      }}
                    />
                  )
                }
              >
                {paginatedUsers.length === 0 ? (
                  <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="No staff members found"
                    description={userFilters.search ? `No results match “${userFilters.search}”.` : "Provision your first staff account to get started."}
                  />
                ) : (
                  <table className="glass-table w-full border-collapse">
                    <thead>
                      <tr>
                        <SortableHeaderCell
                          columnKey="fullName"
                          label="Full Name"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="email"
                          label="Corporate Email"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="role"
                          label="Assigned Role / Title"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="team"
                          label="Assigned Team (Dept)"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="manager"
                          label="Reports To (Manager)"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="reports"
                          label="Direct Reports"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <SortableHeaderCell
                          columnKey="status"
                          label="Status"
                          style={TABLE_TH_STYLE}
                          sortKey={userSort.sortKey}
                          sortDir={userSort.sortDir}
                          onSort={userSort.toggleSort}
                          activeColor={SORT_ACCENT}
                        />
                        <PlainHeaderCell style={TABLE_TH_RIGHT_STYLE}>Actions</PlainHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((u) => (
                        <tr key={u.id} className="border-b border-border/70 last:border-0">
                          <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{u.full_name}</td>
                          <td className={cn(TD, "text-muted-foreground")}>{u.email}</td>
                          <td className={TD}>
                            <Badge variant="default" className="normal-case tracking-normal">
                              {u.role_detail?.name || u.role}
                            </Badge>
                          </td>
                          <td className={TD}>
                            {u.team_detail ? (
                              <span className="font-semibold text-foreground">{u.team_detail.name}</span>
                            ) : (
                              <span className="text-muted-foreground/60">— Unassigned —</span>
                            )}
                          </td>
                          <td className={cn(TD, u.manager_name ? "text-foreground" : "text-muted-foreground/60")}>
                            {u.manager_name || "— Top Level —"}
                          </td>
                          <td className={TD}>
                            {u.direct_reports_count && u.direct_reports_count > 0 ? (
                              <Badge variant="success" className="normal-case tracking-normal">
                                {u.direct_reports_count} direct report{u.direct_reports_count === 1 ? "" : "s"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/60">0</span>
                            )}
                          </td>
                          <td className={TD}><StatusPill active={u.is_active} /></td>
                          <td className={cn(TD, "text-right")}>
                            <div className={ROW_ACTIONS}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenChangePassword(u)}
                                title="Change User Password"
                                aria-label={`Change password for ${u.full_name}`}
                                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditUser(u)}
                                title="Edit staff member"
                                aria-label={`Edit ${u.full_name}`}
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10 hover:text-primary"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(u)}
                                title="Delete staff member"
                                aria-label={`Delete ${u.full_name}`}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </FullscreenTable>
            )}

            {/* TAB: FMS EXTERNAL SYNC */}
            {activeTab === "fms" && (
              <div className="space-y-6">
                <Panel>
                  <PanelHeading
                    title="FMS External Integration"
                    description="Dispatch real-time delivery logs, hours updates, and faculty synchronization payloads to enterprise FMS."
                  />

                  <div className="px-5 py-5 sm:px-6">
                    {fmsSyncMsg && (
                      <div
                        role="status"
                        className={cn(
                          "mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
                          fmsSyncMsg.type === "success"
                            ? "border-success/25 bg-success-light text-success"
                            : "border-destructive/25 bg-destructive-light text-destructive"
                        )}
                      >
                        {fmsSyncMsg.type === "success" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <span>{fmsSyncMsg.text}</span>
                      </div>
                    )}

                    <form
                      onSubmit={handleDispatchFmsSync}
                      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto] lg:items-end"
                    >
                      <FormField label="Faculty Identifier / ID" required>
                        <input
                          type="text"
                          value={syncFacultyId}
                          onChange={(e) => setSyncFacultyId(e.target.value)}
                          placeholder="e.g. FAC-2026-CORE-001"
                          className="glass-input"
                          required
                        />
                      </FormField>
                      <FormField label="Sync Event Type">
                        <select
                          value={syncEventType}
                          onChange={(e) => setSyncEventType(e.target.value)}
                          className="glass-input"
                        >
                          <option value="HOURS_UPDATE">HOURS_UPDATE</option>
                          <option value="FACULTY_PROFILE">FACULTY_PROFILE</option>
                          <option value="GATE_STATUS">GATE_STATUS</option>
                        </select>
                      </FormField>
                      <Button type="submit" loading={isSyncingFms}>
                        <ArrowRightLeft className="h-4 w-4" />
                        <span>Dispatch FMS Sync</span>
                      </Button>
                    </form>
                  </div>
                </Panel>

                <FullscreenTable
                  panelClassName={PANEL_CLASS}
                  headerStyle={PANEL_HEADER_STYLE}
                  titleStyle={PANEL_TITLE_STYLE}
                  title={<TablePanelTitle title={`Recent FMS Dispatch History (${fmsLogs.length})`} />}
                  toolbar={
                    <TableFilters
                      search={{
                        value: fmsFilters.search,
                        onChange: fmsFilters.setSearch,
                        placeholder: "Search dispatches by faculty, event, status or message...",
                      }}
                      selects={[
                        {
                          key: "eventType",
                          label: "Event Type",
                          value: fmsFilters.getFilter("eventType"),
                          onChange: (value) => fmsFilters.setFilter("eventType", value),
                          options: fmsFilters.optionsFor("eventType"),
                          allLabel: "All event types",
                          width: 175,
                        },
                        {
                          key: "status",
                          label: "Status",
                          value: fmsFilters.getFilter("status"),
                          onChange: (value) => fmsFilters.setFilter("status", value),
                          options: fmsFilters.optionsFor("status"),
                          allLabel: "All statuses",
                        },
                      ]}
                      sort={{
                        options: FMS_SORT_OPTIONS,
                        sortKey: fmsSort.sortKey,
                        sortDir: fmsSort.sortDir,
                        onChange: fmsSort.applySort,
                      }}
                      onClear={fmsFilters.clearFilters}
                      hasActiveFilters={fmsFilters.hasActiveFilters}
                      activeFilterCount={fmsFilters.activeFilterCount}
                    />
                  }
                  actions={
                    <Button variant="secondary" onClick={fetchFmsLogs} disabled={isLoadingFms}>
                      <RefreshCw className={cn("h-4 w-4", isLoadingFms && "animate-spin")} />
                      <span>Refresh Logs</span>
                    </Button>
                  }
                  footer={
                    isLoadingFms || paginatedFmsLogs.length === 0 ? undefined : (
                      <PaginationControls
                        currentPage={fmsLogPage}
                        totalItems={filteredFmsLogs.length}
                        pageSize={fmsLogPageSize}
                        onPageChange={setFmsLogPage}
                        onPageSizeChange={(newSize) => {
                          setFmsLogPageSize(newSize);
                          setFmsLogPage(1);
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
                  ) : (
                    <table className="glass-table w-full border-collapse">
                      <thead>
                        <tr>
                          <SortableHeaderCell
                            columnKey="facultyId"
                            label="Faculty ID"
                            style={TABLE_TH_STYLE}
                            sortKey={fmsSort.sortKey}
                            sortDir={fmsSort.sortDir}
                            onSort={fmsSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="eventType"
                            label="Event Type"
                            style={TABLE_TH_STYLE}
                            sortKey={fmsSort.sortKey}
                            sortDir={fmsSort.sortDir}
                            onSort={fmsSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="status"
                            label="Status"
                            style={TABLE_TH_STYLE}
                            sortKey={fmsSort.sortKey}
                            sortDir={fmsSort.sortDir}
                            onSort={fmsSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="timestamp"
                            label="Timestamp"
                            style={TABLE_TH_STYLE}
                            sortKey={fmsSort.sortKey}
                            sortDir={fmsSort.sortDir}
                            onSort={fmsSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="message"
                            label="Message"
                            style={TABLE_TH_STYLE}
                            sortKey={fmsSort.sortKey}
                            sortDir={fmsSort.sortDir}
                            onSort={fmsSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFmsLogs.map((log) => (
                          <tr key={log.id} className="border-b border-border/70 last:border-0">
                            <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{log.faculty_id}</td>
                            <td className={cn(TD, "font-mono text-xs uppercase text-muted-foreground")}>{log.event_type}</td>
                            <td className={TD}>
                              <Badge variant={log.status === "SUCCESS" ? "success" : "destructive"}>
                                {log.status}
                              </Badge>
                            </td>
                            <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDateTime(log.timestamp)}</td>
                            <td className={cn(TD, "max-w-[320px] truncate text-muted-foreground")} title={log.message || ""}>
                              {log.message || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </FullscreenTable>
              </div>
            )}

            {/* TAB: HIERARCHY TREE */}
            {activeTab === "hierarchy" && (
              <Panel>
                <PanelHeading
                  title="Organization Hierarchy & Reporting Tree"
                  description="Visual organizational tree showing manager reporting lines and team allocations."
                />

                {hierarchy.length === 0 ? (
                  <EmptyState
                    icon={<GitFork className="h-5 w-5" />}
                    title="No reporting hierarchy configured yet"
                    description="Assign a manager to staff members to build the reporting tree."
                  />
                ) : (
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    {hierarchy.map((rootNode) => (
                      <OrgTreeNode key={rootNode.id} node={rootNode} />
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* TAB: COORDINATOR MAPPINGS */}
            {activeTab === "mappings" && (
              <div className="space-y-6">
                <Panel>
                  <PanelHeading
                    title="Assign Coordinator to Manager"
                    description="A coordinator can be mapped to multiple managers. This allows each manager to see that coordinator's batches in their scope."
                  />

                  <div className="px-5 py-5 sm:px-6">
                    {mappingFormError && <ErrorBanner message={mappingFormError} />}

                    <form
                      onSubmit={handleCreateMapping}
                      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
                    >
                      <FormField label="Coordinator" required>
                        <select
                          value={mappingCoordinatorId}
                          onChange={(e) => setMappingCoordinatorId(e.target.value)}
                          className="glass-input"
                          required
                        >
                          <option value="">— Select Coordinator —</option>
                          {coordinatorCandidates.map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Manager" required>
                        <select
                          value={mappingManagerId}
                          onChange={(e) => setMappingManagerId(e.target.value)}
                          className="glass-input"
                          required
                        >
                          <option value="">— Select Manager —</option>
                          {managerCandidates.map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                          ))}
                        </select>
                      </FormField>
                      <Button type="submit" loading={isSubmittingMapping}>
                        <Link2 className="h-4 w-4" />
                        <span>Assign</span>
                      </Button>
                    </form>
                  </div>
                </Panel>

                <FullscreenTable
                  panelClassName={PANEL_CLASS}
                  headerStyle={PANEL_HEADER_STYLE}
                  titleStyle={PANEL_TITLE_STYLE}
                  title={<TablePanelTitle title={`Active Mappings (${mappings.length})`} />}
                  toolbar={
                    <TableFilters
                      search={{
                        value: mappingFilters.search,
                        onChange: mappingFilters.setSearch,
                        placeholder: "Search mappings by coordinator or manager...",
                      }}
                      selects={[
                        {
                          key: "coordinator",
                          label: "Coordinator",
                          value: mappingFilters.getFilter("coordinator"),
                          onChange: (value) => mappingFilters.setFilter("coordinator", value),
                          options: mappingFilters.optionsFor("coordinator"),
                          allLabel: "All coordinators",
                          width: 180,
                        },
                        {
                          key: "manager",
                          label: "Manager",
                          value: mappingFilters.getFilter("manager"),
                          onChange: (value) => mappingFilters.setFilter("manager", value),
                          options: mappingFilters.optionsFor("manager"),
                          allLabel: "All managers",
                          width: 180,
                        },
                      ]}
                      sort={{
                        options: MAPPING_SORT_OPTIONS,
                        sortKey: mappingSort.sortKey,
                        sortDir: mappingSort.sortDir,
                        onChange: mappingSort.applySort,
                      }}
                      onClear={mappingFilters.clearFilters}
                      hasActiveFilters={mappingFilters.hasActiveFilters}
                      activeFilterCount={mappingFilters.activeFilterCount}
                    />
                  }
                  actions={
                    <Button variant="secondary" onClick={fetchMappings} disabled={isLoadingMappings}>
                      <RefreshCw className={cn("h-4 w-4", isLoadingMappings && "animate-spin")} />
                      <span>Refresh</span>
                    </Button>
                  }
                  footer={
                    isLoadingMappings || paginatedMappings.length === 0 ? undefined : (
                      <PaginationControls
                        currentPage={mappingPage}
                        totalItems={filteredMappings.length}
                        pageSize={mappingPageSize}
                        onPageChange={setMappingPage}
                        onPageSizeChange={(newSize) => {
                          setMappingPageSize(newSize);
                          setMappingPage(1);
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
                  ) : (
                    <table className="glass-table w-full border-collapse">
                      <thead>
                        <tr>
                          <SortableHeaderCell
                            columnKey="coordinator"
                            label="Coordinator"
                            style={TABLE_TH_STYLE}
                            sortKey={mappingSort.sortKey}
                            sortDir={mappingSort.sortDir}
                            onSort={mappingSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="manager"
                            label="Mapped Manager"
                            style={TABLE_TH_STYLE}
                            sortKey={mappingSort.sortKey}
                            sortDir={mappingSort.sortDir}
                            onSort={mappingSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <SortableHeaderCell
                            columnKey="assignedAt"
                            label="Assigned On"
                            style={TABLE_TH_STYLE}
                            sortKey={mappingSort.sortKey}
                            sortDir={mappingSort.sortDir}
                            onSort={mappingSort.toggleSort}
                            activeColor={SORT_ACCENT}
                          />
                          <PlainHeaderCell style={TABLE_TH_RIGHT_STYLE}>Actions</PlainHeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMappings.map((m) => (
                          <tr key={m.id} className="border-b border-border/70 last:border-0">
                            <td className={TD}>
                              <div className="font-semibold text-foreground">{m.coordinator_name || "—"}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{m.coordinator_email || ""}</div>
                            </td>
                            <td className={TD}>
                              <div className="font-semibold text-primary">{m.manager_name || "—"}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{m.manager_email || ""}</div>
                            </td>
                            <td className={cn(TD, "whitespace-nowrap text-muted-foreground")}>{formatDate(m.assigned_at)}</td>
                            <td className={cn(TD, "text-right")}>
                              <div className={ROW_ACTIONS}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMapping(m.id, m.coordinator_name || m.coordinator_id)}
                                  title="Remove mapping"
                                  aria-label={`Remove mapping for ${m.coordinator_name || m.coordinator_id}`}
                                  className="ml-auto h-8 gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Remove</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </FullscreenTable>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal: Create Team */}
      <AdminDialog
        open={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        title="Create New Team"
        description="Add a new functional team within the Ops Department."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-team-form" loading={isSubmittingTeam}>
              Create Team
            </Button>
          </>
        }
      >
        <form id="create-team-form" onSubmit={handleCreateTeam} className="space-y-4">
          {teamFormError && <ErrorBanner message={teamFormError} />}
          <FormField label="Team Name" required>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Core Operations, Delivery Team, Academic Ops"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <textarea
              value={newTeamDescription}
              onChange={(e) => setNewTeamDescription(e.target.value)}
              placeholder="Brief summary of team responsibilities..."
              rows={3}
              className="glass-input resize-y"
            />
          </FormField>
        </form>
      </AdminDialog>

      {/* Modal: Edit Team */}
      <AdminDialog
        open={isEditTeamOpen && !!editingTeam}
        onClose={() => setIsEditTeamOpen(false)}
        title={`Edit Team: ${editingTeam?.name ?? ""}`}
        description="Update team title and description within the Ops Department."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsEditTeamOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-team-form" loading={isSubmittingEditTeam}>
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-team-form" onSubmit={handleUpdateTeam} className="space-y-4">
          {editTeamError && <ErrorBanner message={editTeamError} />}
          <FormField label="Team Name" required>
            <input
              type="text"
              value={editTeamName}
              onChange={(e) => setEditTeamName(e.target.value)}
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <textarea
              value={editTeamDescription}
              onChange={(e) => setEditTeamDescription(e.target.value)}
              rows={3}
              className="glass-input resize-y"
            />
          </FormField>
        </form>
      </AdminDialog>

      {/* Modal: Create Role */}
      <AdminDialog
        open={isCreateRoleOpen}
        onClose={() => setIsCreateRoleOpen(false)}
        title="Add Position Title / Role"
        description="Define a new position title and select its system operational permissions."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-role-form" loading={isSubmittingRole}>
              Create Position Title
            </Button>
          </>
        }
      >
        <form id="create-role-form" onSubmit={handleCreateRole} className="space-y-4">
          {roleFormError && <ErrorBanner message={roleFormError} />}
          <FormField label="Role / Position Title Name" required>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Lead Technical Trainer, Senior Operations Lead"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Base System Permission Level" required>
            <select
              value={newRoleSystemRole}
              onChange={(e) => setNewRoleSystemRole(e.target.value)}
              className="glass-input"
              required
            >
              <option value="Coordinator">Coordinator (Operations &amp; Schedule Management)</option>
              <option value="Manager">Manager (Department / Team Leadership)</option>
              <option value="Faculty">Faculty (Trainer / Instructor)</option>
              <option value="Sales">Sales (Client &amp; Account Operations)</option>
              <option value="Admin">Admin (Full Organization Governance)</option>
            </select>
          </FormField>
        </form>
      </AdminDialog>

      {/* Modal: Create Taxonomy Option */}
      <AdminDialog
        open={isCreateOptionOpen}
        onClose={() => setIsCreateOptionOpen(false)}
        title="Add Taxonomy Option"
        description={`Add a new value under ${OPTION_TYPE_LABELS[selectedOptionType]}.`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsCreateOptionOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-option-form" loading={isSubmittingOption}>
              Add Option
            </Button>
          </>
        }
      >
        <form id="create-option-form" onSubmit={handleCreateOption} className="space-y-4">
          {optionFormError && <ErrorBanner message={optionFormError} />}
          <FormField label="Option Name" required>
            <input
              type="text"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder="e.g. Masterclass, Hybrid 2.0"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <input
              type="text"
              value={newOptionDesc}
              onChange={(e) => setNewOptionDesc(e.target.value)}
              placeholder="Short description..."
              className="glass-input"
            />
          </FormField>
        </form>
      </AdminDialog>

      {/* Modal: Create User */}
      <AdminDialog
        open={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Provision New User"
        description="Create an employee account, assign their position role, team (Ops, etc.), and reporting manager."
        maxWidth="sm:max-w-xl"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form" loading={isSubmittingUser}>
              Create User Account
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
          {userFormError && <ErrorBanner message={userFormError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required>
              <input
                type="text"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="e.g. Ananya Sharma"
                className="glass-input"
                required
              />
            </FormField>
            <FormField label="Corporate Email" required>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="name@enterprise-ops.com"
                className="glass-input"
                required
              />
            </FormField>
          </div>
          <FormField label="Assigned Position Title / Role" required>
            <select
              value={newUserRoleId}
              onChange={(e) => setNewUserRoleId(e.target.value)}
              className="glass-input"
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.system_role})</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Assigned Team">
              <select
                value={newUserTeamId}
                onChange={(e) => setNewUserTeamId(e.target.value)}
                className="glass-input"
              >
                <option value="">— No Team Assigned —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Reports To (Manager)">
              <select
                value={newUserReportsToId}
                onChange={(e) => setNewUserReportsToId(e.target.value)}
                className="glass-input"
              >
                <option value="">— No Manager (Top-level Leader) —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role_detail?.name || u.role})</option>
                ))}
              </select>
            </FormField>
          </div>
        </form>
      </AdminDialog>

      {/* Modal: Edit User */}
      <AdminDialog
        open={isEditUserOpen && !!editingUser}
        onClose={() => setIsEditUserOpen(false)}
        title="Edit Staff Member"
        description="Update account details, role, team, reporting manager, or status."
        maxWidth="sm:max-w-xl"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" loading={isSubmittingEditUser}>
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleUpdateUser} className="space-y-4">
          {editUserFormError && <ErrorBanner message={editUserFormError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required>
              <input
                value={editUserFullName}
                onChange={(e) => setEditUserFullName(e.target.value)}
                className="glass-input"
                required
              />
            </FormField>
            <FormField label="Corporate Email" required>
              <input
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="glass-input"
                required
              />
            </FormField>
          </div>
          <FormField label="Assigned Position Title / Role" required>
            <select
              value={editUserRoleId}
              onChange={(e) => setEditUserRoleId(e.target.value)}
              className="glass-input"
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.system_role})</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Assigned Team">
              <select
                value={editUserTeamId}
                onChange={(e) => setEditUserTeamId(e.target.value)}
                className="glass-input"
              >
                <option value="">— No Team Assigned —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Reports To (Manager)">
              <select
                value={editUserReportsToId}
                onChange={(e) => setEditUserReportsToId(e.target.value)}
                className="glass-input"
              >
                <option value="">— No Manager —</option>
                {users
                  .filter((u) => !editingUser || u.id !== editingUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role_detail?.name || u.role})</option>
                  ))}
              </select>
            </FormField>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={editUserIsActive}
              onChange={(e) => setEditUserIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-[hsl(214_88%_27%)]"
            />
            Account is active
          </label>
        </form>
      </AdminDialog>

      {/* Modal: Change Password for All Users */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => {
          setIsChangePasswordOpen(false);
          setPasswordTargetUser(null);
        }}
        targetUser={passwordTargetUser}
        allUsers={users}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
