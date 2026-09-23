"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, Bell, Calendar, Zap, Layers, Settings, HelpCircle,
  Plus, ChevronsUpDown, Shield, LogOut, KeyRound, Check, X,
  ExternalLink, Sparkles
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface SidebarProps {
  activeView: "batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty";
  setActiveView: (view: "batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty") => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onOpenCreateBatch?: () => void;
  pendingApprovalsCount?: number;
  onFilterCategory?: (category: string) => void;
  activeCategoryFilter?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  searchQuery = "",
  setSearchQuery,
  onOpenCreateBatch,
  pendingApprovalsCount = 0,
  onFilterCategory,
  activeCategoryFilter = "ALL",
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isFinance = user?.team_name?.trim().toLowerCase() === "finance";
  const isApprover = user?.is_configured_approver === true;
  const canCreateBatch = !isAdmin && user?.team_name?.trim().toLowerCase() === "delivery";
  const isManager = (user?.direct_reports_count ?? 0) > 0 || user?.is_manager || user?.role?.toLowerCase() === "manager" || isAdmin;
  const canSeeManagerBoard = !isFinance && isManager;
  const canSeeAnalytics = !isFinance && isManager;

  // Keyboard shortcut listener (⌘1, ⌘2, ⌘3, ⌘4 or Ctrl+1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          searchInputRef.current?.focus();
        } else if (e.key === "2") {
          e.preventDefault();
          if (isFinance) {
            setActiveView("finance");
          } else {
            setActiveView("batches");
          }
        } else if (e.key === "3") {
          e.preventDefault();
          if (isFinance) {
            setActiveView("batches");
          } else if (canSeeManagerBoard) {
            setActiveView("manager_board");
          } else if (isApprover) {
            setActiveView("approvals");
          }
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveView("faculty");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveView, isFinance, canSeeManagerBoard, isApprover]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Display user initial or custom avatar
  const userInitial = user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U";
  const userDisplayName = user?.full_name || "Operations User";
  const userDisplayEmail = user?.email || "user@enterprise-ops.com";
  const teamLabel = user?.team_name ? `${user.team_name} Team` : "Operations";
  const roleLabel = user?.role_detail?.name || user?.role || "Staff";

  return (
    <>
      <aside
        style={{
          width: 256,
          flexShrink: 0,
          background: "#ffffff",
          borderRadius: 20,
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignSelf: "stretch",
          minHeight: "calc(100vh - 32px)",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          userSelect: "none",
        }}
      >
        {/* TOP HEADER: Brand / Team Selector */}
        <div style={{ position: "relative" }} ref={workspaceMenuRef}>
          <button
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              background: isWorkspaceMenuOpen ? "#f8fafc" : "transparent",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              outline: "none",
              transition: "background 0.15s ease",
            }}
            onMouseOver={(e) => {
              if (!isWorkspaceMenuOpen) e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseOut={(e) => {
              if (!isWorkspaceMenuOpen) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Logo emblem */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0b5cab 0%, #0284c7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 2px 6px rgba(11, 92, 171, 0.3)",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <Layers size={18} strokeWidth={2.5} />
              </div>

              <div style={{ textAlign: "left" }}>
                <div
                  style={{
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Enterprise Ops
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#64748b",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    marginTop: 2,
                  }}
                >
                  {teamLabel} • {roleLabel}
                </div>
              </div>
            </div>

            <ChevronsUpDown size={14} color="#94a3b8" />
          </button>

          {/* Workspace Menu Popover */}
          {isWorkspaceMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 6,
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                zIndex: 60,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Active Workspace
              </div>
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "#f1f5f9",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Enterprise Ops</span>
                <span style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 700 }}>Active</span>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsWorkspaceMenuOpen(false);
                    router.push("/admin");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#0b5cab",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Shield size={14} />
                  <span>Admin & Governance</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* SEARCH BAR with ⌘1 shortcut badge - clean layout without overlap */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "0 8px 0 10px",
            height: 38,
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
        >
          <Search size={15} color="#94a3b8" style={{ marginRight: 8, flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            style={{
              width: "100%",
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "0.82rem",
              color: "#0f172a",
              padding: "0 6px 0 0",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery?.("")}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* TOP ACTION: Add New Batch */}
        <button
          onClick={onOpenCreateBatch}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 36,
            borderRadius: 10,
            border: "1px solid #bfdbfe",
            outline: "none",
            background: "#eff6ff",
            color: "#0b5cab",
            fontWeight: 600,
            fontSize: "0.84rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#0b5cab";
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.borderColor = "#0b5cab";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#eff6ff";
            e.currentTarget.style.color = "#0b5cab";
            e.currentTarget.style.borderColor = "#bfdbfe";
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Add New Batch</span>
        </button>

        {/* PRIMARY NAVIGATION ITEMS: Tailored to user role and backend features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* FOR FINANCE TEAM: Finance Review is the primary view */}
          {isFinance && (
            <button
              onClick={() => setActiveView("finance")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                outline: "none",
                background: activeView === "finance" ? "#f4f4f5" : "transparent",
                color: activeView === "finance" ? "#0f172a" : "#475569",
                fontWeight: activeView === "finance" ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (activeView !== "finance") e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (activeView !== "finance") e.currentTarget.style.background = "transparent";
              }}
            >
              <Layers size={17} color={activeView === "finance" ? "#0f172a" : "#64748b"} />
              <span>Finance Review</span>
            </button>
          )}

          {/* Active Batches (Batch Operations Hub) */}
          <button
            onClick={() => setActiveView("batches")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              outline: "none",
              background: activeView === "batches" ? "#f4f4f5" : "transparent",
              color: activeView === "batches" ? "#0f172a" : "#475569",
              fontWeight: activeView === "batches" ? 700 : 500,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseOver={(e) => {
              if (activeView !== "batches") e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseOut={(e) => {
              if (activeView !== "batches") e.currentTarget.style.background = "transparent";
            }}
          >
            <Layers size={17} color={activeView === "batches" ? "#0f172a" : "#64748b"} />
            <span>Active Batches</span>
          </button>

          {/* Approval Queue (Multi-Level Governance Signoffs) */}
          {isApprover && (
            <button
              onClick={() => setActiveView("approvals")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                outline: "none",
                background: activeView === "approvals" ? "#f4f4f5" : "transparent",
                color: activeView === "approvals" ? "#0f172a" : "#475569",
                fontWeight: activeView === "approvals" ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (activeView !== "approvals") e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (activeView !== "approvals") e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={17} color={activeView === "approvals" ? "#0f172a" : "#64748b"} />
                <span>Approval Queue</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "#ffffff",
                    background: "#0b5cab",
                    padding: "2px 6px",
                    borderRadius: 10,
                  }}
                >
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}

          {/* Manager Level Control Board (For non-finance managers & leadership) */}
          {canSeeManagerBoard && (
            <button
              onClick={() => setActiveView("manager_board")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                outline: "none",
                background: activeView === "manager_board" ? "#f4f4f5" : "transparent",
                color: activeView === "manager_board" ? "#0f172a" : "#475569",
                fontWeight: activeView === "manager_board" ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (activeView !== "manager_board") e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (activeView !== "manager_board") e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Bell size={17} color={activeView === "manager_board" ? "#0f172a" : "#64748b"} />
                {/* Show alert dot only when there are actual pending approvals/alerts */}
                {pendingApprovalsCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -3,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#ef4444",
                      boxShadow: "0 0 0 1.5px #ffffff",
                    }}
                  />
                )}
              </div>
              <span>Manager Board</span>
            </button>
          )}

          {/* Faculty Directory & Utilization */}
          <button
            onClick={() => setActiveView("faculty")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              outline: "none",
              background: activeView === "faculty" ? "#f4f4f5" : "transparent",
              color: activeView === "faculty" ? "#0f172a" : "#475569",
              fontWeight: activeView === "faculty" ? 700 : 500,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseOver={(e) => {
              if (activeView !== "faculty") e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseOut={(e) => {
              if (activeView !== "faculty") e.currentTarget.style.background = "transparent";
            }}
          >
            <Calendar size={17} color={activeView === "faculty" ? "#0f172a" : "#64748b"} />
            <span>Faculty Utilization</span>
          </button>

          {/* Team Analytics & MBR (For managers and leadership) */}
          {canSeeAnalytics && (
            <button
              onClick={() => setActiveView("analytics")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                outline: "none",
                background: activeView === "analytics" ? "#f4f4f5" : "transparent",
                color: activeView === "analytics" ? "#0f172a" : "#475569",
                fontWeight: activeView === "analytics" ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (activeView !== "analytics") e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (activeView !== "analytics") e.currentTarget.style.background = "transparent";
              }}
            >
              <Zap size={17} color={activeView === "analytics" ? "#0f172a" : "#64748b"} />
              <span>Team Analytics</span>
            </button>
          )}

          {/* Finance Review for Non-Finance Users who have access */}
          {!isFinance && (isAdmin || isManager) && (
            <button
              onClick={() => setActiveView("finance")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                outline: "none",
                background: activeView === "finance" ? "#f4f4f5" : "transparent",
                color: activeView === "finance" ? "#0f172a" : "#475569",
                fontWeight: activeView === "finance" ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (activeView !== "finance") e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (activeView !== "finance") e.currentTarget.style.background = "transparent";
              }}
            >
              <Layers size={17} color={activeView === "finance" ? "#0f172a" : "#64748b"} />
              <span>Finance Review</span>
            </button>
          )}
        </div>

        {/* SPACER - Pushes user profile footer to bottom */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* BOTTOM USER PROFILE CARD (Matches Sandra Marx in reference image) */}
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: 10,
            position: "relative",
          }}
          ref={userMenuRef}
        >
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 6px",
              background: isUserMenuOpen ? "#f8fafc" : "transparent",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseOver={(e) => {
              if (!isUserMenuOpen) e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseOut={(e) => {
              if (!isUserMenuOpen) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {/* User Avatar with soft pastel background */}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)",
                  color: "#831843",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: "0 2px 4px rgba(244, 114, 182, 0.2)",
                }}
              >
                {userInitial}
              </div>

              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userDisplayName}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#94a3b8",
                    lineHeight: 1.2,
                    marginTop: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userDisplayEmail}
                </div>
              </div>
            </div>

            <ChevronsUpDown size={14} color="#94a3b8" style={{ flexShrink: 0, marginLeft: 4 }} />
          </button>

          {/* User Popover Dropdown */}
          {isUserMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                right: 0,
                marginBottom: 8,
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)",
                zIndex: 70,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>
                  {user?.full_name}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  {user?.role_detail?.name || user?.role} • {user?.team_name || "Ops"}
                </div>
              </div>

              {/* Change Password option */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#0f172a",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <KeyRound size={15} color="#0b5cab" />
                <span>Change My Password</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push("/admin");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Shield size={15} color="#0b5cab" />
                  <span>Admin Portal</span>
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#ef4444",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#fef2f2")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

    </>
  );
};
