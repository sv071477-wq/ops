"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  api, Role, Team, User, UserHierarchyNode, BatchOption, FmsSyncLog, CoordinatorMappingRecord
} from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { Navbar } from "@/components/Navbar";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import {
  Shield, Users, Tag, UserPlus, Plus, Trash2, CheckCircle2,
  AlertCircle, RefreshCw, GitFork, Briefcase, Layers, Building2,
  Sliders, ArrowRightLeft, Check, Sparkles, Database, Edit2, Link2, KeyRound
} from "lucide-react";

// Recursive Org Tree Node Component
const OrgTreeNode: React.FC<{ node: UserHierarchyNode; depth?: number }> = ({ node, depth = 0 }) => {
  const hasChildren = node.direct_reports && node.direct_reports.length > 0;
  const isManager = hasChildren || node.role?.toLowerCase() === "manager" || node.role?.toLowerCase() === "admin";

  return (
    <div style={{ marginLeft: depth > 0 ? 24 : 0, marginTop: 12, position: "relative" }}>
      {depth > 0 && (
        <div style={{
          position: "absolute",
          left: -14,
          top: 20,
          width: 14,
          height: 2,
          background: "var(--border-subtle)"
        }} />
      )}

      <div style={{
        background: isManager ? "#ffffff" : "#f8fafc",
        border: `1px solid ${isManager ? "#0b5cab" : "var(--border-subtle)"}`,
        borderLeft: isManager ? "4px solid #0b5cab" : "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        flexWrap: "wrap",
        gap: 12,
        width: "100%",
        maxWidth: "100%",
        boxShadow: isManager ? "0 1px 3px rgba(0,0,0,0.05)" : "none"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            background: isManager ? "#e8f2fb" : "#f1f5f9",
            color: isManager ? "#0b5cab" : "#64748b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.85rem"
          }}>
            {node.full_name ? node.full_name.charAt(0) : "U"}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>
                {node.full_name}
              </span>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: isManager ? "#e8f2fb" : "#f1f5f9",
                color: isManager ? "#0b5cab" : "#64748b"
              }}>
                {node.role_name || node.role}
              </span>
              {node.team_name && (
                <span style={{
                  fontSize: "0.725rem",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd"
                }}>
                  {node.team_name}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              {node.email}
            </div>
          </div>
        </div>

        <div>
          {hasChildren ? (
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 10,
              background: "#f0fdf4",
              color: "#16a34a",
              border: "1px solid #bbf7d0"
            }}>
              Manages {node.direct_reports.length} direct report(s)
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Individual Contributor
            </span>
          )}
        </div>
      </div>

      {hasChildren && (
        <div style={{
          borderLeft: "2px solid #e2e8f0",
          marginLeft: 16,
          paddingLeft: 4
        }}>
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

  const [activeTab, setActiveTab] = useState<"teams" | "roles" | "options" | "users" | "fms" | "hierarchy" | "mappings">("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<UserHierarchyNode[]>([]);
  const [approver1Id, setApprover1Id] = useState("");
  const [approver2Id, setApprover2Id] = useState("");
  const [isSavingApprovers, setIsSavingApprovers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Batch Taxonomy Options state
  const [selectedOptionType, setSelectedOptionType] = useState<"categories" | "delivery-modes" | "accommodations" | "entities">("categories");
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
  const [editUserPassword, setEditUserPassword] = useState("");
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
      alert("Approval levels saved");
    } catch (err: any) {
      alert(err.message || "Failed to save approvers");
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
      setMappingFormError(err.message || "Failed to create mapping");
    } finally {
      setIsSubmittingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string, name: string) => {
    if (!confirm(`Remove mapping for "${name}"?`)) return;
    try {
      await api.deleteCoordinatorMapping(mappingId);
      await fetchMappings();
    } catch (err: any) {
      alert(err.message || "Failed to remove mapping");
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
      setTeamFormError(err.message || "Failed to create team");
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  // Handle Delete Team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"? Any assigned users will become unassigned from this team.`)) return;
    try {
      await api.deleteTeam(teamId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete team");
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
      setEditTeamError(err.message || "Failed to update team");
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
      setRoleFormError(err.message || "Failed to create role");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Handle Delete Role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return;
    try {
      await api.deleteRole(roleId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete role");
    }
  };

  // Handle Add Batch Option
  const handleCreateOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setOptionFormError(null);
    setIsSubmittingOption(true);

    try {
      await api.createBatchOption(selectedOptionType, {
        name: newOptionName.trim(),
        description: newOptionDesc.trim() || undefined,
      });
      setNewOptionName("");
      setNewOptionDesc("");
      setIsCreateOptionOpen(false);
      await fetchBatchOptions();
    } catch (err: any) {
      setOptionFormError(err.message || "Failed to create option");
    } finally {
      setIsSubmittingOption(false);
    }
  };

  // Handle Delete Batch Option
  const handleDeleteOption = async (optionId: string, optionName: string) => {
    if (!confirm(`Are you sure you want to deactivate "${optionName}"?`)) return;
    try {
      await api.deleteBatchOption(selectedOptionType, optionId);
      await fetchBatchOptions();
    } catch (err: any) {
      alert(err.message || "Failed to delete option");
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
      setFmsSyncMsg({ type: "error", text: err.message || "FMS Sync dispatch failed" });
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
      await api.createUser({
        email: newUserEmail.trim().toLowerCase(),
        full_name: newUserFullName.trim(),
        password: "",
        role_id: newUserRoleId || undefined,
        team_id: newUserTeamId || undefined,
        manager_id: newUserReportsToId || undefined,
        is_active: true,
      });
      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserReportsToId("");
      setIsCreateUserOpen(false);
      await fetchData();
    } catch (err: any) {
      setUserFormError(err.message || "Failed to provision user");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenEditUser = (staffUser: User) => {
    setEditingUser(staffUser);
    setEditUserEmail(staffUser.email);
    setEditUserFullName(staffUser.full_name);
    setEditUserPassword("");
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
      setEditUserFormError(err.message || "Failed to update staff member");
    } finally {
      setIsSubmittingEditUser(false);
    }
  };

  const handleDeleteUser = async (staffUser: User) => {
    if (staffUser.id === user?.id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!confirm(`Delete staff member "${staffUser.full_name}"? This permanently removes their account.`)) return;

    try {
      await api.deleteUser(staffUser.id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete staff member");
    }
  };

  if (isAuthLoading || !user || user.role?.toLowerCase() !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <RefreshCw className="animate-spin" size={32} color="#0b5cab" />
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Verifying Administrator Privileges...</span>
        </div>
      </div>
    );
  }

  const managerCount = users.filter((u) => u.is_manager || (u.direct_reports_count && u.direct_reports_count > 0)).length;
  const opsTeamCount = teams.filter((t) => (t.department || "").toLowerCase() === "ops").length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ width: "100%", padding: "28px 24px", flex: 1, margin: 0, display: "block" }}>
        {/* Header Title */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "#e8f2fb",
                color: "#0b5cab",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}>
                <Shield size={14} />
                ADMINISTRATION & GOVERNANCE
              </div>
            </div>
            <h1 style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color: "var(--text-main)",
              marginTop: 6
            }}>
              Enterprise Governance & Taxonomy Center
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Manage Ops teams, position titles, batch taxonomy options, staff directory, and FMS integrations.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28
        }}>
          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Configured Teams
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0284c7", marginTop: 4 }}>
              {teams.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Delivery • Sales • Finance
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Configured Roles
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0b5cab", marginTop: 4 }}>
              {roles.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Dynamic position titles
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Registered Staff
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-main)", marginTop: 4 }}>
              {users.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Active employees
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Managers / Leads
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
              {managerCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              With direct reports
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Reporting Trees
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#9333ea", marginTop: 4 }}>
              {hierarchy.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Root leadership branches
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 24,
          gap: 8,
          overflowX: "auto"
        }}>
          <button
            onClick={() => setActiveTab("teams")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "teams" ? "2px solid #0284c7" : "2px solid transparent",
              color: activeTab === "teams" ? "#0284c7" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <Layers size={18} />
            <span>Ops Teams</span>
            <span style={{
              background: activeTab === "teams" ? "#e0f2fe" : "#f1f5f9",
              color: activeTab === "teams" ? "#0284c7" : "var(--text-dim)",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: "0.75rem"
            }}>
              {teams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "roles" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "roles" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <Tag size={18} />
            <span>Organization Roles & Titles</span>
          </button>

          <button
            onClick={() => setActiveTab("options")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "options" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "options" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <Sliders size={18} />
            <span>Batch Taxonomy & Options</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "users" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "users" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <Users size={18} />
            <span>Staff Directory</span>
            <span style={{
              background: activeTab === "users" ? "#e8f2fb" : "#f1f5f9",
              color: activeTab === "users" ? "#0b5cab" : "var(--text-dim)",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: "0.75rem"
            }}>
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("fms")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "fms" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "fms" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <ArrowRightLeft size={18} />
            <span>FMS External Sync</span>
          </button>

          <button
            onClick={() => setActiveTab("hierarchy")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "hierarchy" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "hierarchy" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <GitFork size={18} />
            <span>Hierarchy Tree</span>
          </button>

          <button
            onClick={() => setActiveTab("mappings")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderBottom: activeTab === "mappings" ? "2px solid #7c3aed" : "2px solid transparent",
              color: activeTab === "mappings" ? "#7c3aed" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.9rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <Link2 size={18} />
            <span>Coordinator Mappings</span>
            <span style={{
              background: activeTab === "mappings" ? "#ede9fe" : "#f1f5f9",
              color: activeTab === "mappings" ? "#7c3aed" : "var(--text-dim)",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: "0.75rem"
            }}>
              {mappings.length}
            </span>
          </button>
        </div>

        {/* TAB 1: OPS TEAMS */}
        {activeTab === "teams" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 12
            }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Ops Teams Management
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Functional delivery, sales, and finance teams operating within the Operations Department.
                </p>
              </div>

              <button
                onClick={() => setIsCreateTeamOpen(true)}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={16} />
                <span>Create New Team</span>
              </button>
            </div>

            {/* Teams Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <th style={{ padding: "12px 16px" }}>Team Name</th>
                    <th style={{ padding: "12px 16px" }}>Description</th>
                    <th style={{ padding: "12px 16px" }}>Active Members</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Created At</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        No teams created yet. Click <strong>Create New Team</strong> to add operational teams.
                      </td>
                    </tr>
                  ) : (
                    teams.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                          {t.name}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: "0.825rem", maxWidth: 280 }}>
                          {t.description || "—"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: (t.member_count || 0) > 0 ? "#f0fdf4" : "#f8fafc",
                            color: (t.member_count || 0) > 0 ? "#16a34a" : "#94a3b8",
                            border: (t.member_count || 0) > 0 ? "1px solid #bbf7d0" : "1px solid #e2e8f0"
                          }}>
                            {t.member_count || 0} member(s)
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: t.is_active ? "#16a34a" : "#94a3b8",
                            fontSize: "0.8rem",
                            fontWeight: 600
                          }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.is_active ? "#16a34a" : "#94a3b8" }} />
                            {t.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {formatDate(t.created_at)}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              onClick={() => handleOpenEditTeam(t)}
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid var(--border-subtle)",
                                color: "#0b5cab",
                                cursor: "pointer",
                                padding: "6px 8px",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: "0.775rem",
                                fontWeight: 600
                              }}
                              title="Edit Team"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(t.id, t.name)}
                              style={{
                                background: "transparent",
                                border: "1px solid transparent",
                                color: "#f43f5e",
                                cursor: "pointer",
                                padding: "6px",
                                borderRadius: 4
                              }}
                              title="Delete Team"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ROLES & APPROVAL CONFIG */}
        {activeTab === "roles" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Roles & Position Titles
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Create and manage the official organizational titles recognized in the platform.
                </p>
              </div>

              <button
                onClick={() => setIsCreateRoleOpen(true)}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={16} />
                <span>Add Position Title</span>
              </button>
            </div>

            <div style={{ border: "1px solid var(--border-subtle)", padding: 16, marginBottom: 24, background: "#f8fafc", borderRadius: 6 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--text-main)" }}>Batch Approval Configuration</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Approver 1
                  <select value={approver1Id} onChange={(e) => setApprover1Id(e.target.value)} className="glass-input" style={{ display: "block", marginTop: 6, width: "100%" }}>
                    <option value="">Select approver 1</option>
                    {users.filter((u) => u.is_active && (u.role === "Admin" || u.role === "Manager")).map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                  </select>
                </label>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Approver 2
                  <select value={approver2Id} onChange={(e) => setApprover2Id(e.target.value)} className="glass-input" style={{ display: "block", marginTop: 6, width: "100%" }}>
                    <option value="">Select approver 2</option>
                    {users.filter((u) => u.is_active && (u.role === "Admin" || u.role === "Manager")).map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                  </select>
                </label>
                <button onClick={handleSaveApprovers} disabled={isSavingApprovers} className="btn btn-primary">
                  {isSavingApprovers ? "Saving..." : "Save Approvers"}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <th style={{ padding: "12px 16px" }}>Position Title / Role Name</th>
                    <th style={{ padding: "12px 16px" }}>Base System Capability</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Created At</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                        {r.name}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: "#e8f2fb", color: "#0b5cab" }}>
                          {r.system_role}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: r.is_active ? "#16a34a" : "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.is_active ? "#16a34a" : "#94a3b8" }} />
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        {formatDate(r.created_at)}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button onClick={() => handleDeleteRole(r.id, r.name)} style={{ background: "transparent", border: "none", color: "#f43f5e", cursor: "pointer", padding: "6px" }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BATCH TAXONOMY & DYNAMIC OPTIONS */}
        {activeTab === "options" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Batch Taxonomy & Option Management
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Configure predefined categories, delivery modes, accommodations, and legal entities.
                </p>
              </div>

              <button
                onClick={() => setIsCreateOptionOpen(true)}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={16} />
                <span>Add Taxonomy Option</span>
              </button>
            </div>

            {/* Sub-tabs for option types */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              {[
                { key: "categories", label: "Categories" },
                { key: "delivery-modes", label: "Delivery Modes" },
                { key: "accommodations", label: "Accommodations" },
                { key: "entities", label: "Legal Entities" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedOptionType(tab.key as any)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: selectedOptionType === tab.key ? "#0b5cab" : "#f1f5f9",
                    color: selectedOptionType === tab.key ? "#ffffff" : "#475569",
                    fontWeight: 600,
                    fontSize: "0.825rem",
                    cursor: "pointer"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isLoadingOptions ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                <RefreshCw className="animate-spin" size={24} color="#0b5cab" style={{ margin: "0 auto 8px" }} />
                <div>Loading taxonomy options...</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      <th style={{ padding: "12px 16px" }}>Option Name</th>
                      <th style={{ padding: "12px 16px" }}>Description</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchOptions.map((opt) => (
                      <tr key={opt.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                          {opt.name}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)" }}>
                          {opt.description || "—"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ color: opt.is_active ? "#16a34a" : "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>
                            {opt.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => handleDeleteOption(opt.id, opt.name)}
                            style={{ background: "transparent", border: "none", color: "#f43f5e", cursor: "pointer", padding: "6px" }}
                            title="Deactivate Option"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STAFF DIRECTORY */}
        {activeTab === "users" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Organization Staff Directory
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Provision new employees, assign position titles, assign teams (Ops, etc.), and configure reporting managers.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => handleOpenChangePassword(null)}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <KeyRound size={16} color="#d97706" />
                  <span>Change User Password</span>
                </button>

                <button
                  onClick={() => setIsCreateUserOpen(true)}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <UserPlus size={16} />
                  <span>Add New User</span>
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <th style={{ padding: "12px 16px" }}>Full Name</th>
                    <th style={{ padding: "12px 16px" }}>Corporate Email</th>
                    <th style={{ padding: "12px 16px" }}>Assigned Role / Title</th>
                    <th style={{ padding: "12px 16px" }}>Assigned Team (Dept)</th>
                    <th style={{ padding: "12px 16px" }}>Reports To (Manager)</th>
                    <th style={{ padding: "12px 16px" }}>Direct Reports</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                        {u.full_name}
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-muted)" }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: "#e8f2fb", color: "#0b5cab" }}>
                          {u.role_detail?.name || u.role}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {u.team_detail ? (
                          <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.85rem" }}>
                            {u.team_detail.name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>— Unassigned —</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: u.manager_name ? "var(--text-main)" : "var(--text-dim)", fontSize: "0.825rem" }}>
                        {u.manager_name || "— Top Level —"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {u.direct_reports_count && u.direct_reports_count > 0 ? (
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: "0.75rem", fontWeight: 700, background: "#f0fdf4", color: "#16a34a" }}>
                            {u.direct_reports_count} direct report(s)
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: u.is_active ? "#16a34a" : "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.is_active ? "#16a34a" : "#94a3b8" }} />
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => handleOpenChangePassword(u)}
                          title="Change User Password"
                          aria-label={`Change password for ${u.full_name}`}
                          style={{ background: "transparent", border: "none", color: "#d97706", cursor: "pointer", padding: 6 }}
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          title="Edit staff member"
                          aria-label={`Edit ${u.full_name}`}
                          style={{ background: "transparent", border: "none", color: "#0b5cab", cursor: "pointer", padding: 6 }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete staff member"
                          aria-label={`Delete ${u.full_name}`}
                          style={{ background: "transparent", border: "none", color: "#f43f5e", cursor: "pointer", padding: 6 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: FMS EXTERNAL SYNC */}
        {activeTab === "fms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Sync trigger panel */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                FMS (Faculty Management System) External Integration
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 16px 0" }}>
                Dispatch real-time delivery logs, hours updates, and faculty synchronization payloads to enterprise FMS.
              </p>

              {fmsSyncMsg && (
                <div style={{
                  background: fmsSyncMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${fmsSyncMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                  color: fmsSyncMsg.type === "success" ? "#16a34a" : "#f43f5e",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: "0.85rem",
                  marginBottom: 16
                }}>
                  {fmsSyncMsg.text}
                </div>
              )}

              <form onSubmit={handleDispatchFmsSync} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Faculty Identifier / ID *
                  </label>
                  <input
                    type="text"
                    value={syncFacultyId}
                    onChange={(e) => setSyncFacultyId(e.target.value)}
                    placeholder="e.g. FAC-2026-CORE-001"
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  />
                </div>

                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Sync Event Type
                  </label>
                  <select
                    value={syncEventType}
                    onChange={(e) => setSyncEventType(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                  >
                    <option value="HOURS_UPDATE">HOURS_UPDATE</option>
                    <option value="FACULTY_PROFILE">FACULTY_PROFILE</option>
                    <option value="GATE_STATUS">GATE_STATUS</option>
                  </select>
                </div>

                <button type="submit" disabled={isSyncingFms} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ArrowRightLeft size={16} />
                  <span>{isSyncingFms ? "Dispatching..." : "Dispatch FMS Sync"}</span>
                </button>
              </form>
            </div>

            {/* Sync logs table */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Recent FMS Dispatch History ({fmsLogs.length})
                </h3>
                <button onClick={fetchFmsLogs} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                  Refresh Logs
                </button>
              </div>

              {isLoadingFms ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                  <RefreshCw className="animate-spin" size={20} color="#0b5cab" style={{ margin: "0 auto 6px" }} />
                  <div>Loading sync logs...</div>
                </div>
              ) : fmsLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                  No FMS sync dispatches recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px" }}>Faculty ID</th>
                        <th style={{ padding: "10px 14px" }}>Event Type</th>
                        <th style={{ padding: "10px 14px" }}>Status</th>
                        <th style={{ padding: "10px 14px" }}>Timestamp</th>
                        <th style={{ padding: "10px 14px" }}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fmsLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{log.faculty_id}</td>
                          <td style={{ padding: "10px 14px" }}>{log.event_type}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: log.status === "SUCCESS" ? "#f0fdf4" : "#fef2f2",
                              color: log.status === "SUCCESS" ? "#16a34a" : "#f43f5e"
                            }}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                            {log.message || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: HIERARCHY TREE */}
        {activeTab === "hierarchy" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Organization Hierarchy & Reporting Tree
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 20px 0" }}>
              Visual organizational tree showing manager reporting lines and team allocations.
            </p>

            {hierarchy.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", background: "#f8fafc", borderRadius: 6, color: "var(--text-muted)" }}>
                <GitFork size={32} style={{ margin: "0 auto 12px auto", color: "var(--text-dim)" }} />
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No Reporting Hierarchy Configured Yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {hierarchy.map((rootNode) => (
                  <OrgTreeNode key={rootNode.id} node={rootNode} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: COORDINATOR MAPPINGS */}
        {activeTab === "mappings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Add Mapping Form */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Assign Coordinator to Manager
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 20px 0" }}>
                A coordinator can be mapped to multiple managers. This allows each manager to see that coordinator's batches in their scope.
              </p>

              {mappingFormError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#f43f5e", padding: "10px 14px", borderRadius: 6, fontSize: "0.85rem", marginBottom: 16 }}>
                  <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
                  {mappingFormError}
                </div>
              )}

              <form onSubmit={handleCreateMapping} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label">Coordinator *</label>
                  <select
                    value={mappingCoordinatorId}
                    onChange={(e) => setMappingCoordinatorId(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  >
                    <option value="">— Select Coordinator —</option>
                    {users.filter(u => u.role === "Coordinator" && u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label">Manager *</label>
                  <select
                    value={mappingManagerId}
                    onChange={(e) => setMappingManagerId(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  >
                    <option value="">— Select Manager —</option>
                    {users.filter(u => (u.role === "Manager" || u.role === "Admin") && u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={isSubmittingMapping} className="btn btn-primary" style={{ height: 40, whiteSpace: "nowrap" }}>
                  <Link2 size={15} />
                  <span>{isSubmittingMapping ? "Assigning..." : "Assign"}</span>
                </button>
              </form>
            </div>

            {/* Existing Mappings Table */}
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Active Mappings ({mappings.length})
                </h3>
                <button onClick={fetchMappings} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>
              {isLoadingMappings ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                  <RefreshCw className="animate-spin" size={22} color="#7c3aed" style={{ margin: "0 auto 8px auto" }} />
                  <div style={{ fontSize: "0.85rem" }}>Loading mappings...</div>
                </div>
              ) : mappings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  <Link2 size={28} style={{ margin: "0 auto 10px auto", color: "var(--text-dim)" }} />
                  <div style={{ fontWeight: 600 }}>No coordinator-manager mappings configured yet.</div>
                  <div style={{ fontSize: "0.8rem", marginTop: 4 }}>Use the form above to add the first mapping.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                        <th style={{ padding: "12px 16px" }}>Coordinator</th>
                        <th style={{ padding: "12px 16px" }}>Mapped Manager</th>
                        <th style={{ padding: "12px 16px" }}>Assigned On</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{m.coordinator_name || "—"}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{m.coordinator_email || ""}</div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#0b5cab" }}>{m.manager_name || "—"}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{m.manager_email || ""}</div>
                          </td>
                          <td style={{ padding: "14px 16px", color: "var(--text-dim)", fontSize: "0.82rem" }}>
                            {formatDate(m.assigned_at)}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteMapping(m.id, m.coordinator_name || m.coordinator_id)}
                              className="btn"
                              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "5px 10px", fontSize: "0.775rem", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Create Team */}
      {isCreateTeamOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 480, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Create New Team
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Add a new functional team within the Ops Department.
            </p>

            {teamFormError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
              }}>
                <AlertCircle size={16} />
                <span>{teamFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeam} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Team Name *
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Core Operations, Delivery Team, Academic Ops"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="Brief summary of team responsibilities..."
                  className="glass-input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsCreateTeamOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingTeam} className="btn btn-primary">
                  {isSubmittingTeam ? "Creating..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Team */}
      {isEditTeamOpen && editingTeam && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 480, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Edit Team: {editingTeam.name}
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Update team title and description within the Ops Department.
            </p>

            {editTeamError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
              }}>
                <AlertCircle size={16} />
                <span>{editTeamError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTeam} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Team Name *
                </label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  value={editTeamDescription}
                  onChange={(e) => setEditTeamDescription(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsEditTeamOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingEditTeam} className="btn btn-primary">
                  {isSubmittingEditTeam ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Role */}
      {isCreateRoleOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 480, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Add Position Title / Role
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Define a new position title and select its system operational permissions.
            </p>

            {roleFormError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
              }}>
                <AlertCircle size={16} />
                <span>{roleFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRole} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Role / Position Title Name *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Lead Technical Trainer, Senior Operations Lead"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Base System Permission Level *
                </label>
                <select
                  value={newRoleSystemRole}
                  onChange={(e) => setNewRoleSystemRole(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                >
                  <option value="Coordinator">Coordinator (Operations & Schedule Management)</option>
                  <option value="Manager">Manager (Department / Team Leadership)</option>
                  <option value="Faculty">Faculty (Trainer / Instructor)</option>
                  <option value="Sales">Sales (Client & Account Operations)</option>
                  <option value="Admin">Admin (Full Organization Governance)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsCreateRoleOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingRole} className="btn btn-primary">
                  {isSubmittingRole ? "Creating..." : "Create Position Title"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Taxonomy Option */}
      {isCreateOptionOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 460, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Add Taxonomy Option
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Add a new value under <strong>{selectedOptionType === "categories" ? "Categories" : selectedOptionType === "delivery-modes" ? "Delivery Modes" : selectedOptionType === "accommodations" ? "Accommodations" : "Legal Entities"}</strong>.
            </p>

            {optionFormError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: "0.85rem",
                marginBottom: 16
              }}>
                {optionFormError}
              </div>
            )}

            <form onSubmit={handleCreateOption} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Option Name *
                </label>
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  placeholder="e.g. Masterclass, Hybrid 2.0"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newOptionDesc}
                  onChange={(e) => setNewOptionDesc(e.target.value)}
                  placeholder="Short description..."
                  className="glass-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsCreateOptionOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingOption} className="btn btn-primary">
                  {isSubmittingOption ? "Saving..." : "Add Option"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {isCreateUserOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 520, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Provision New User
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Create an employee account, assign their position role, team (Ops, etc.), and reporting manager.
            </p>

            {userFormError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16
              }}>
                <AlertCircle size={16} />
                <span>{userFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Corporate Email *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name@enterprise-ops.com"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Assigned Position Title / Role *
                </label>
                <select
                  value={newUserRoleId}
                  onChange={(e) => setNewUserRoleId(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.system_role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Assigned Team
                </label>
                <select
                  value={newUserTeamId}
                  onChange={(e) => setNewUserTeamId(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                >
                  <option value="">— No Team Assigned —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Reports To (Manager) — Optional
                </label>
                <select
                  value={newUserReportsToId}
                  onChange={(e) => setNewUserReportsToId(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                >
                  <option value="">— No Manager (Top-level Leader / Direct to Admin) —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role_detail?.name || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsCreateUserOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingUser} className="btn btn-primary">
                  {isSubmittingUser ? "Creating..." : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {isEditUserOpen && editingUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 520, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Edit Staff Member
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Update account details, role, team, reporting manager, or status.
            </p>

            {editUserFormError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#f43f5e", padding: "10px 14px", borderRadius: 6, fontSize: "0.85rem", marginBottom: 16 }}>
                <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
                {editUserFormError}
              </div>
            )}

            <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label">Full Name *</label>
                <input value={editUserFullName} onChange={(e) => setEditUserFullName(e.target.value)} className="glass-input" style={{ width: "100%" }} required />
              </div>
              <div>
                <label className="form-label">Corporate Email *</label>
                <input type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} className="glass-input" style={{ width: "100%" }} required />
              </div>
              <div>
                <label className="form-label">Assigned Position Title / Role *</label>
                <select value={editUserRoleId} onChange={(e) => setEditUserRoleId(e.target.value)} className="glass-input" style={{ width: "100%" }} required>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.system_role})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Assigned Team</label>
                <select value={editUserTeamId} onChange={(e) => setEditUserTeamId(e.target.value)} className="glass-input" style={{ width: "100%" }}>
                  <option value="">— No Team Assigned —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Reports To (Manager)</label>
                <select value={editUserReportsToId} onChange={(e) => setEditUserReportsToId(e.target.value)} className="glass-input" style={{ width: "100%" }}>
                  <option value="">— No Manager —</option>
                  {users.filter((u) => u.id !== editingUser.id).map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role_detail?.name || u.role})</option>)}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-main)" }}>
                <input type="checkbox" checked={editUserIsActive} onChange={(e) => setEditUserIsActive(e.target.checked)} />
                Account is active
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setIsEditUserOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmittingEditUser} className="btn btn-primary">
                  {isSubmittingEditUser ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

