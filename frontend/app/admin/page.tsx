"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft, Briefcase, Building2, FileText, GitFork, Layers, Link2, Network, RefreshCw, Shield, Sliders,
  Tag, UserCheck, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import {
  AdminPortalProvider, type AdminPortalValue
} from "@/components/admin/AdminPortalContext";
import { OPTION_TYPE_LABELS, type OptionTypeKey } from "@/components/admin/optionTypes";
import { StatCard } from "@/components/admin/ui";
import { TeamsTab } from "@/components/admin/tabs/TeamsTab";
import { RolesTab } from "@/components/admin/tabs/RolesTab";
import { TaxonomyTab } from "@/components/admin/tabs/TaxonomyTab";
import { UsersTab } from "@/components/admin/tabs/UsersTab";
import { FmsTab } from "@/components/admin/tabs/FmsTab";
import { HierarchyTab } from "@/components/admin/tabs/HierarchyTab";
import { MappingsTab } from "@/components/admin/tabs/MappingsTab";
import {
  api, type AuditLog, type BatchOption, type CoordinatorMappingRecord, type FmsSyncLog, type Role, type Team, type User,
  type UserHierarchyNode
} from "@/lib/api";
import { errorMessage, notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type AdminTabKey = "teams" | "roles" | "options" | "users" | "fms" | "hierarchy" | "mappings" | "audit-logs";

interface AdminTab {
  key: AdminTabKey;
  label: string;
  icon: React.ElementType;
}

const TABS: AdminTab[] = [
  { key: "teams", label: "Ops Teams", icon: Layers },
  { key: "roles", label: "Roles & Titles", icon: Tag },
  { key: "options", label: "Batch Taxonomy", icon: Sliders },
  { key: "users", label: "Staff Directory", icon: Users },
  { key: "fms", label: "FMS External Sync", icon: ArrowRightLeft },
  { key: "hierarchy", label: "Hierarchy Tree", icon: GitFork },
  { key: "mappings", label: "Coordinator Mappings", icon: Link2 },
  { key: "audit-logs", label: "Audit Logs", icon: FileText },
];

const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();

export default function AdminPortalPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTabKey>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<UserHierarchyNode[]>([]);
  const [approvalConfig, setApprovalConfig] = useState({ approver1Id: "", approver2Id: "" });

  const [selectedOptionType, setSelectedOptionTypeState] = useState<OptionTypeKey>("categories");
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);

  const [fmsLogs, setFmsLogs] = useState<FmsSyncLog[]>([]);
  const [mappings, setMappings] = useState<CoordinatorMappingRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingFms, setIsLoadingFms] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [isSavingApprovers, setIsSavingApprovers] = useState(false);
  const [isAssigningCoordinator, setIsAssigningCoordinator] = useState(false);
  const [isDispatchingFms, setIsDispatchingFms] = useState(false);
  const [fmsSyncMessage, setFmsSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    } else if (!isAuthLoading && user && norm(user.role) !== "admin") {
      router.replace("/");
    }
  }, [user, isAuthLoading, router]);

  const fetchCoreData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTeams, fetchedRoles, fetchedUsers, fetchedHierarchy, config] = await Promise.all([
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
      if (config) {
        setApprovalConfig({
          approver1Id: config.approver_1_id || "",
          approver2Id: config.approver_2_id || "",
        });
      }
    } catch (error) {
      notifyError("Failed to load admin data", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBatchOptions = useCallback(async (optionType: OptionTypeKey) => {
    setIsLoadingOptions(true);
    try {
      setBatchOptions(await api.getBatchOptions(optionType));
    } catch (error) {
      notifyError("Failed to load taxonomy options", error);
      setBatchOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const fetchFmsLogs = useCallback(async () => {
    setIsLoadingFms(true);
    try {
      // The table paginates locally, so pull a full page-set rather than the
      // API's 50-row default.
      setFmsLogs(await api.getFmsLogs(0, 200));
    } catch (error) {
      notifyError("Failed to load FMS logs", error);
      setFmsLogs([]);
    } finally {
      setIsLoadingFms(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      setAuditLogs(await api.getAuditLogs(0, 200));
    } catch (error) {
      notifyError("Failed to load audit logs", error);
      setAuditLogs([]);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    setIsLoadingMappings(true);
    try {
      setMappings(await api.listCoordinatorMappings());
    } catch (error) {
      notifyError("Failed to load coordinator mappings", error);
      setMappings([]);
    } finally {
      setIsLoadingMappings(false);
    }
  }, []);

  const isAdmin = Boolean(user && norm(user.role) === "admin");

  useEffect(() => {
    if (!isAdmin) return;
    fetchCoreData();
    // The mapping badge on the tab bar must be right on first paint.
    fetchMappings();
  }, [isAdmin, fetchCoreData, fetchMappings]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "options") fetchBatchOptions(selectedOptionType);
    else if (activeTab === "fms") fetchFmsLogs();
    else if (activeTab === "mappings") fetchMappings();
    else if (activeTab === "audit-logs") fetchAuditLogs();
  }, [isAdmin, activeTab, selectedOptionType, fetchBatchOptions, fetchFmsLogs, fetchMappings, fetchAuditLogs]);

  const setSelectedOptionType = useCallback((optionType: OptionTypeKey) => {
    setSelectedOptionTypeState(optionType);
  }, []);

  const refreshActiveTab = useCallback(() => {
    if (activeTab === "options") fetchBatchOptions(selectedOptionType);
    else if (activeTab === "fms") fetchFmsLogs();
    else if (activeTab === "mappings") fetchMappings();
    else if (activeTab === "audit-logs") fetchAuditLogs();
    else fetchCoreData();
  }, [activeTab, selectedOptionType, fetchBatchOptions, fetchFmsLogs, fetchMappings, fetchAuditLogs, fetchCoreData]);

  const managerCount = useMemo(
    () => users.filter((user) => user.is_manager || (user.direct_reports_count ?? 0) > 0).length,
    [users]
  );
  const opsTeamCount = useMemo(
    () => teams.filter((team) => norm(team.department) === "ops").length,
    [teams]
  );

  const approverCandidates = useMemo(
    () =>
      users.filter(
        (candidate) =>
          candidate.is_active && (norm(candidate.role) === "admin" || norm(candidate.role) === "manager")
      ),
    [users]
  );
  const coordinatorCandidates = useMemo(
    () => users.filter((candidate) => norm(candidate.role) === "coordinator" && candidate.is_active),
    [users]
  );
  const managerCandidates = useMemo(
    () =>
      users.filter(
        (candidate) => (norm(candidate.role) === "manager" || norm(candidate.role) === "admin") && candidate.is_active
      ),
    [users]
  );

  const createTeam = useCallback(
    async (payload: { name: string; department: string; description?: string }) => {
      try {
        await api.createTeam({ ...payload, is_active: true });
        notifySuccess("Team created");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to create team", error);
        throw error;
      }
    },
    [fetchCoreData]
  );

  const updateTeam = useCallback(
    async (team: Team, payload: { name: string; department: string; description?: string }) => {
      try {
        await api.updateTeam(team.id, payload);
        notifySuccess("Team updated");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to update team", error);
        throw error;
      }
    },
    [fetchCoreData]
  );

  const deleteTeam = useCallback(
    async (team: Team) => {
      try {
        await api.deleteTeam(team.id);
        notifySuccess("Team deleted");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to delete team", error);
      }
    },
    [fetchCoreData]
  );

  const createRole = useCallback(
    async (payload: { name: string; system_role: string }) => {
      try {
        await api.createRole({ ...payload, is_active: true });
        notifySuccess("Position title created");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to create position title", error);
        throw error;
      }
    },
    [fetchCoreData]
  );

  const deleteRole = useCallback(
    async (role: Role) => {
      try {
        await api.deleteRole(role.id);
        notifySuccess("Position title deleted");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to delete position title", error);
      }
    },
    [fetchCoreData]
  );

  const createOption = useCallback(
    async (payload: { name: string; description?: string }) => {
      try {
        if (selectedOptionType === "faculty-types") {
          await api.createFacultyType(payload);
        } else if (selectedOptionType === "verticals") {
          await api.createVertical(payload);
        } else {
          await api.createBatchOption(selectedOptionType, payload);
        }
        notifySuccess(`${OPTION_TYPE_LABELS[selectedOptionType].replace(/s$/, "")} option added`);
        await fetchBatchOptions(selectedOptionType);
      } catch (error) {
        notifyError("Failed to create option", error);
        throw error;
      }
    },
    [selectedOptionType, fetchBatchOptions]
  );

  const deleteOption = useCallback(
    async (option: BatchOption) => {
      try {
        if (selectedOptionType === "faculty-types") {
          await api.deleteFacultyType(option.id);
        } else if (selectedOptionType === "verticals") {
          await api.deleteVertical(option.id);
        } else {
          await api.deleteBatchOption(selectedOptionType, option.id);
        }
        notifySuccess("Option deactivated");
        await fetchBatchOptions(selectedOptionType);
      } catch (error) {
        notifyError("Failed to deactivate option", error);
      }
    },
    [selectedOptionType, fetchBatchOptions]
  );

  const createUser = useCallback(
    async (payload: {
      email: string;
      full_name: string;
      role_id?: string;
      team_id?: string;
      manager_id?: string;
    }) => {
      try {
        await api.adminCreateUser({ ...payload, is_active: true, send_welcome_email: true });
        notifySuccess("Staff account created");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to provision user", error);
        throw error;
      }
    },
    [fetchCoreData]
  );

  const updateUser = useCallback(
    async (
      target: User,
      payload: {
        email: string;
        full_name: string;
        role_id: string | null;
        team_id: string | null;
        manager_id: string | null;
        is_active: boolean;
      }
    ) => {
      try {
        await api.updateUser(target.id, payload);
        notifySuccess("Staff member updated");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to update staff member", error);
        throw error;
      }
    },
    [fetchCoreData]
  );

  const deleteUser = useCallback(
    async (target: User) => {
      if (target.id === user?.id) {
        notifyError("You cannot delete your own admin account.");
        return;
      }
      try {
        await api.deleteUser(target.id);
        notifySuccess("Staff member deleted");
        await fetchCoreData();
      } catch (error) {
        notifyError("Failed to delete staff member", error);
      }
    },
    [fetchCoreData, user?.id]
  );

  const saveApprovers = useCallback(async (approver1Id: string, approver2Id: string) => {
    setIsSavingApprovers(true);
    try {
      await api.updateApprovalConfiguration({ approver_1_id: approver1Id, approver_2_id: approver2Id });
      setApprovalConfig({ approver1Id, approver2Id });
      notifySuccess("Approval levels saved");
    } finally {
      setIsSavingApprovers(false);
    }
  }, []);

  const assignCoordinator = useCallback(
    async (coordinatorId: string, managerId: string) => {
      setIsAssigningCoordinator(true);
      try {
        await api.assignCoordinator({ coordinator_id: coordinatorId, manager_id: managerId });
        notifySuccess("Coordinator mapped to manager");
        await fetchMappings();
      } catch (error) {
        notifyError("Failed to create mapping", error);
        throw error;
      } finally {
        setIsAssigningCoordinator(false);
      }
    },
    [fetchMappings]
  );

  const deleteMapping = useCallback(
    async (mapping: CoordinatorMappingRecord) => {
      try {
        await api.deleteCoordinatorMapping(mapping.id);
        notifySuccess("Mapping removed");
        await fetchMappings();
      } catch (error) {
        notifyError("Failed to remove mapping", error);
      }
    },
    [fetchMappings]
  );

  const dispatchFmsSync = useCallback(
    async (facultyId: string, eventType: string) => {
      setIsDispatchingFms(true);
      setFmsSyncMessage(null);
      try {
        await api.syncFacultyFms(facultyId, eventType);
        setFmsSyncMessage({ type: "success", text: `Successfully dispatched ${eventType} to external FMS.` });
        await fetchFmsLogs();
      } catch (error) {
        setFmsSyncMessage({ type: "error", text: errorMessage(error, "FMS sync dispatch failed") });
      } finally {
        setIsDispatchingFms(false);
      }
    },
    [fetchFmsLogs]
  );

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.key === activeTab);
    let nextIndex = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextKey = TABS[nextIndex].key;
    setActiveTab(nextKey);
    tabRefs.current[nextKey]?.focus();
  };

  const portalValue: AdminPortalValue = {
    teams,
    roles,
    users,
    hierarchy,
    batchOptions,
    fmsLogs,
    mappings,
    approval: approvalConfig,
    selectedOptionType,
    isLoading,
    isLoadingOptions,
    isLoadingFms,
    isLoadingMappings,
    refresh: fetchCoreData,
    refreshOptions: () => fetchBatchOptions(selectedOptionType),
    refreshFms: fetchFmsLogs,
    refreshMappings: fetchMappings,
    setSelectedOptionType,
    approverCandidates,
    coordinatorCandidates,
    managerCandidates,
    createTeam,
    updateTeam,
    deleteTeam,
    createRole,
    deleteRole,
    createOption,
    deleteOption,
    createUser,
    updateUser,
    deleteUser,
    saveApprovers,
    isSavingApprovers,
    assignCoordinator,
    isAssigningCoordinator,
    deleteMapping,
    dispatchFmsSync,
    isDispatchingFms,
    fmsSyncMessage,
    clearFmsSyncMessage: () => setFmsSyncMessage(null),
  };

  // Audit Logs Tab Component
  function AuditLogsTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Audit Logs</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={isLoadingAuditLogs}
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingAuditLogs && "animate-spin")} aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </div>

        {isLoadingAuditLogs ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="ml-3 text-sm text-muted-foreground">Loading audit logs...</span>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No audit logs found.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Event Type</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">User</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">IP Address</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Details</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 font-mono text-xs">{log.event_type}</td>
                      <td className="p-4">{log.user_id ? `User ID: ${log.user_id.slice(0, 8)}...` : "N/A"}</td>
                      <td className="p-4">{log.user_email || "N/A"}</td>
                      <td className="p-4 font-mono text-xs">{log.ip_address || "N/A"}</td>
                      <td className="p-4 max-w-xs truncate">{log.details || "N/A"}</td>
                      <td className="p-4 whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isAuthLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Verifying Administrator Privileges...</span>
        </div>
      </div>
    );
  }

  const tabCounts: Partial<Record<AdminTabKey, number>> = {
    teams: teams.length,
    roles: roles.length,
    users: users.length,
    hierarchy: hierarchy.length,
    mappings: mappings.length,
    "audit-logs": auditLogs.length,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <header className="flex flex-col gap-6 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-primary">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Administration &amp; Governance
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Enterprise Governance &amp; Taxonomy Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Manage Ops teams, position titles, batch taxonomy options, staff directory, and FMS integrations.
              </p>
            </div>

            <Button variant="outline" onClick={refreshActiveTab} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", (isLoading || isLoadingOptions || isLoadingFms || isLoadingMappings) && "animate-spin")} aria-hidden="true" />
              <span>Refresh</span>
            </Button>
          </header>

          <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Configured Teams"
              value={teams.length}
              hint={`${opsTeamCount} in Ops department`}
              tone="info"
              onClick={() => setActiveTab("teams")}
            />
            <StatCard
              icon={<Briefcase className="h-5 w-5" />}
              label="Configured Roles"
              value={roles.length}
              hint="Dynamic position titles"
              tone="primary"
              onClick={() => setActiveTab("roles")}
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Registered Staff"
              value={users.length}
              hint="Active and inactive accounts"
              tone="violet"
              onClick={() => setActiveTab("users")}
            />
            <StatCard
              icon={<UserCheck className="h-5 w-5" />}
              label="Managers / Leads"
              value={managerCount}
              hint="With direct reports"
              tone="success"
              onClick={() => setActiveTab("users")}
            />
            <StatCard
              icon={<Network className="h-5 w-5" />}
              label="Reporting Trees"
              value={hierarchy.length}
              hint="Root leadership branches"
              tone="warning"
              onClick={() => setActiveTab("hierarchy")}
            />
          </div>

          <div className="mb-6 overflow-x-auto pb-1 scrollbar-thin">
            <nav
              role="tablist"
              aria-label="Administration sections"
              onKeyDown={handleTabKeyDown}
              className="inline-flex min-w-full items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                const count = tabCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    ref={(node) => {
                      tabRefs.current[tab.key] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`admin-tab-${tab.key}`}
                    aria-selected={isActive}
                    aria-controls={`admin-panel-${tab.key}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {typeof count === "number" && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold",
                          isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <AdminPortalProvider value={portalValue}>
            <div
              role="tabpanel"
              id={`admin-panel-${activeTab}`}
              aria-labelledby={`admin-tab-${activeTab}`}
              tabIndex={-1}
              className="space-y-6 pb-10 focus-visible:outline-none"
            >
              {activeTab === "teams" && <TeamsTab />}
              {activeTab === "roles" && <RolesTab />}
              {activeTab === "options" && <TaxonomyTab />}
              {activeTab === "users" && <UsersTab />}
              {activeTab === "fms" && <FmsTab />}
              {activeTab === "hierarchy" && <HierarchyTab />}
              {activeTab === "mappings" && <MappingsTab />}
              {activeTab === "audit-logs" && <AuditLogsTab />}
            </div>
          </AdminPortalProvider>
        </div>
      </main>
    </div>
  );
}