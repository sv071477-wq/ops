"use client";

import { createContext, useContext } from "react";
import type { BatchOption, CoordinatorMappingRecord, FmsSyncLog, Role, Team, User, UserHierarchyNode } from "@/lib/api";
import type { OptionTypeKey } from "@/components/admin/optionTypes";

export interface AdminPortalValue {
  teams: Team[];
  roles: Role[];
  users: User[];
  hierarchy: UserHierarchyNode[];
  batchOptions: BatchOption[];
  fmsLogs: FmsSyncLog[];
  mappings: CoordinatorMappingRecord[];

  approval: { approver1Id: string; approver2Id: string };

  selectedOptionType: OptionTypeKey;

  isLoading: boolean;
  isLoadingOptions: boolean;
  isLoadingFms: boolean;
  isLoadingMappings: boolean;

  refresh: () => Promise<void>;
  refreshOptions: () => Promise<void>;
  refreshFms: () => Promise<void>;
  refreshMappings: () => Promise<void>;

  setSelectedOptionType: (optionType: OptionTypeKey) => void;

  approverCandidates: User[];
  coordinatorCandidates: User[];
  managerCandidates: User[];

  createTeam: (payload: { name: string; department: string; description?: string }) => Promise<void>;
  updateTeam: (team: Team, payload: { name: string; department: string; description?: string }) => Promise<void>;
  deleteTeam: (team: Team) => Promise<void>;

  createRole: (payload: { name: string; system_role: string }) => Promise<void>;
  deleteRole: (role: Role) => Promise<void>;

  createOption: (payload: { name: string; description?: string }) => Promise<void>;
  deleteOption: (option: BatchOption) => Promise<void>;

  createUser: (payload: {
    email: string;
    full_name: string;
    role_id?: string;
    team_id?: string;
    manager_id?: string;
  }) => Promise<void>;
  updateUser: (
    user: User,
    payload: {
      email: string;
      full_name: string;
      role_id: string | null;
      team_id: string | null;
      manager_id: string | null;
      is_active: boolean;
    }
  ) => Promise<void>;
  deleteUser: (user: User) => Promise<void>;

  saveApprovers: (approver1Id: string, approver2Id: string) => Promise<void>;
  isSavingApprovers: boolean;

  assignCoordinator: (coordinatorId: string, managerId: string) => Promise<void>;
  isAssigningCoordinator: boolean;
  deleteMapping: (mapping: CoordinatorMappingRecord) => Promise<void>;

  dispatchFmsSync: (facultyId: string, eventType: string) => Promise<void>;
  isDispatchingFms: boolean;
  fmsSyncMessage: { type: "success" | "error"; text: string } | null;
  clearFmsSyncMessage: () => void;
}

const AdminPortalContext = createContext<AdminPortalValue | null>(null);

export const AdminPortalProvider = AdminPortalContext.Provider;

export function useAdminPortal(): AdminPortalValue {
  const value = useContext(AdminPortalContext);
  if (!value) throw new Error("useAdminPortal must be used inside the admin portal");
  return value;
}