"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api, Role, User, UserHierarchyNode } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import {
  Shield, Users, Tag, UserPlus, Plus, Trash2, CheckCircle2,
  AlertCircle, RefreshCw, GitFork, Briefcase
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
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        maxWidth: 750,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

  const [activeTab, setActiveTab] = useState<"roles" | "users" | "hierarchy">("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<UserHierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  // Form States for Role Creation
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSystemRole, setNewRoleSystemRole] = useState("Coordinator");
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Form States for User Creation
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState("");
  const [newUserReportsToId, setNewUserReportsToId] = useState<string>("");
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

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
      const [fetchedRoles, fetchedUsers, fetchedHierarchy] = await Promise.all([
        api.getRoles(),
        api.getUsers().catch(() => []),
        api.getHierarchy().catch(() => []),
      ]);
      setRoles(fetchedRoles);
      setUsers(fetchedUsers);
      setHierarchy(fetchedHierarchy);

      if (fetchedRoles.length > 0 && !newUserRoleId) setNewUserRoleId(fetchedRoles[0].id);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role?.toLowerCase() === "admin") {
      fetchData();
    }
  }, [user]);

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

  // Handle Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setIsSubmittingUser(true);

    try {
      await api.createUser({
        email: newUserEmail.trim().toLowerCase(),
        full_name: newUserFullName.trim(),
        password: newUserPassword,
        role_id: newUserRoleId || undefined,
        manager_id: newUserReportsToId || undefined,
        is_active: true,
      });
      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserPassword("");
      setNewUserReportsToId("");
      setIsCreateUserOpen(false);
      await fetchData();
    } catch (err: any) {
      setUserFormError(err.message || "Failed to provision user");
    } finally {
      setIsSubmittingUser(false);
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ maxWidth: 1400, margin: "0 auto", width: "100%", padding: "28px 24px", flex: 1 }}>
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
              Organization & Role Governance Center
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Manage position titles, provision enterprise staff, and configure hierarchical reporting lines.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28
        }}>
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
              Total employee accounts
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Identified Managers / Leads
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
              {managerCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Users with team reports
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
              Root Reporting Branches
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#9333ea", marginTop: 4 }}>
              {hierarchy.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
              Top-level department leaders
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 24,
          gap: 8
        }}>
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
              cursor: "pointer"
            }}
          >
            <Tag size={18} />
            <span>Organization Roles & Titles</span>
            <span style={{
              background: activeTab === "roles" ? "#e8f2fb" : "#f1f5f9",
              color: activeTab === "roles" ? "#0b5cab" : "var(--text-dim)",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: "0.75rem"
            }}>
              {roles.length}
            </span>
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
              cursor: "pointer"
            }}
          >
            <Users size={18} />
            <span>Staff Directory & Provisioning</span>
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
              cursor: "pointer"
            }}
          >
            <GitFork size={18} />
            <span>Organization Hierarchy Tree</span>
          </button>
        </div>

        {/* Tab 1: Organization Roles & Titles */}
        {activeTab === "roles" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20
            }}>
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

            {/* Roles Table */}
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
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: "#e8f2fb",
                          color: "#0b5cab"
                        }}>
                          {r.system_role}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: r.is_active ? "#16a34a" : "#94a3b8",
                          fontSize: "0.8rem",
                          fontWeight: 600
                        }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: r.is_active ? "#16a34a" : "#94a3b8"
                          }} />
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => handleDeleteRole(r.id, r.name)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#f43f5e",
                            cursor: "pointer",
                            padding: "6px",
                            borderRadius: 4
                          }}
                          title="Delete Role"
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

        {/* Tab 2: Staff Directory & User Provisioning */}
        {activeTab === "users" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20
            }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Organization Staff Directory
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                  Provision new employees, assign position titles, and configure direct reporting managers.
                </p>
              </div>

              <button
                onClick={() => setIsCreateUserOpen(true)}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <UserPlus size={16} />
                <span>Add New User</span>
              </button>
            </div>

            {/* Users Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <th style={{ padding: "12px 16px" }}>Full Name</th>
                    <th style={{ padding: "12px 16px" }}>Corporate Email</th>
                    <th style={{ padding: "12px 16px" }}>Assigned Role / Title</th>
                    <th style={{ padding: "12px 16px" }}>Reports To (Manager)</th>
                    <th style={{ padding: "12px 16px" }}>Direct Reports</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        No staff members registered. Click <strong>Add New User</strong> to provision accounts.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                          {u.full_name}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-muted)" }}>
                          {u.email}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "#e8f2fb",
                            color: "#0b5cab",
                            border: "1px solid #bfdbfe"
                          }}>
                            {u.role_detail?.name || u.role}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: u.manager_name ? "var(--text-main)" : "var(--text-dim)", fontSize: "0.825rem" }}>
                          {u.manager_name || "— Top Level —"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {u.direct_reports_count && u.direct_reports_count > 0 ? (
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 10,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: "#f0fdf4",
                              color: "#16a34a",
                              border: "1px solid #bbf7d0"
                            }}>
                              {u.direct_reports_count} direct report(s)
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>0</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: u.is_active ? "#16a34a" : "#94a3b8",
                            fontSize: "0.8rem",
                            fontWeight: 600
                          }}>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: u.is_active ? "#16a34a" : "#94a3b8"
                            }} />
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Organization Hierarchy Tree */}
        {activeTab === "hierarchy" && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Organization Hierarchy & Reporting Tree
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 20px 0" }}>
              Visual organizational tree showing manager reporting lines. Higher-level managers automatically see all nested sub-teams.
            </p>

            {hierarchy.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#f8fafc",
                borderRadius: 6,
                border: "1px dashed var(--border-subtle)",
                color: "var(--text-muted)"
              }}>
                <GitFork size={32} style={{ margin: "0 auto 12px auto", color: "var(--text-dim)" }} />
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No Reporting Hierarchy Configured Yet</div>
                <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  Add users and assign their <strong>Reports To (Manager)</strong> in the Staff Directory to view the tree.
                </div>
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
      </main>

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
          zIndex: 50,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 480, padding: 24 }}>
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
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  {isSubmittingRole ? "Creating..." : "Create Position Title"}
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
          zIndex: 50,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 520, padding: 24 }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
              Provision New User
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Create an employee account, assign their position title, and set their reporting manager.
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
                  Initial Password * (minimum 8 characters)
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input"
                  style={{ width: "100%" }}
                  minLength={8}
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
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  {isSubmittingUser ? "Creating..." : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
