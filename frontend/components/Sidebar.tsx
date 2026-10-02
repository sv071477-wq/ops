"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell, Calendar, Zap, Layers, Settings, HelpCircle,
  Plus, ChevronsUpDown, Shield, LogOut, KeyRound, Check,
  ExternalLink, Sparkles, ChevronLeft, Menu, X as XIcon
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { useIsMobile, useIsTablet } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export type DashboardView =
  | "my_batches"
  | "active_batches"
  | "manager_board"
  | "approvals"
  | "finance"
  | "analytics"
  | "faculty";

interface SidebarProps {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  onOpenCreateBatch?: () => void;
  pendingApprovalsCount?: number;
  onFilterCategory?: (category: string) => void;
  activeCategoryFilter?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onOpenCreateBatch,
  pendingApprovalsCount = 0,
  onFilterCategory,
  activeCategoryFilter = "ALL",
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isFinance = user?.team_name?.trim().toLowerCase() === "finance" || user?.role?.toLowerCase() === "finance";
  const isApprover = user?.is_configured_approver === true;
  const canCreateBatch = !isAdmin && user?.team_name?.trim().toLowerCase() === "delivery";
  const isManager = (user?.direct_reports_count ?? 0) > 0 || user?.is_manager || user?.role?.toLowerCase() === "manager" || isAdmin;
  const canSeeManagerBoard = !isFinance && isManager;
  const canSeeAnalytics = !isFinance && isManager;
  // My Batches is the landing view for Delivery staff, which is exactly the
  // audience that creates batches and needs the schedule UI.
  const canSeeMyBatches = !isFinance && !isAdmin;

  // Handle responsive behavior
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
      setIsCollapsed(false);
    } else if (isTablet) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [isMobile, isTablet]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "2") {
          e.preventDefault();
          setActiveView("my_batches");
        } else if (e.key === "3") {
          e.preventDefault();
          if (isFinance) {
            setActiveView("finance");
          } else if (canSeeManagerBoard) {
            setActiveView("manager_board");
          } else if (isApprover) {
            setActiveView("approvals");
          }
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveView("active_batches");
        } else if (e.key === "5") {
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

  const navItems = [
    ...(isFinance ? [{
      id: "finance",
      label: "Finance Review",
      icon: Layers,
      badge: null,
    }] : []),
    ...(canSeeMyBatches ? [{
      id: "my_batches",
      label: "My Batches",
      icon: Layers,
      badge: null,
    }] : []),
    {
      id: "active_batches",
      label: "Active Batches",
      icon: Layers,
      badge: null,
    },
    ...(isApprover ? [{
      id: "approvals",
      label: "Approval Queue",
      icon: Check,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    }] : []),
    ...(canSeeManagerBoard ? [{
      id: "manager_board",
      label: "Manager Board",
      icon: Bell,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    }] : []),
    {
      id: "faculty",
      label: "Faculty Utilization",
      icon: Calendar,
      badge: null,
    },
    ...(canSeeAnalytics ? [{
      id: "analytics",
      label: "Team Analytics",
      icon: Zap,
      badge: null,
    }] : []),
  ];

  const sidebarWidth = isMobile ? 0 : isCollapsed ? 72 : 256;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "sidebar h-screen flex flex-col overflow-y-auto transition-all duration-300",
          isMobile
            ? "fixed inset-y-0 left-0 z-50 w-72 transform"
            : "relative transform",
          isMobile
            ? (isSidebarOpen ? "translate-x-0" : "-translate-x-full")
            : "",
          !isMobile && isCollapsed ? "w-20" : !isMobile ? "w-64" : "",
        )}
        style={{
          width: isMobile ? 288 : sidebarWidth,
        }}
      >
        {/* Top Header: Brand / Team Selector */}
        <div style={{ position: "relative" }} ref={workspaceMenuRef}>
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3 rounded-xl p-2.5 font-medium transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground",
              !isCollapsed && "justify-start",
              isCollapsed && "justify-center",
              isWorkspaceMenuOpen ? "bg-accent/50" : "",
            )}
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            aria-haspopup="true"
            aria-expanded={isWorkspaceMenuOpen}
          >
            <div className="flex items-center gap-2.5">
              {/* Logo emblem */}
              <div
                className="flex items-center justify-center text-white flex-shrink-0"
                style={{
                  width: isCollapsed ? 28 : 32,
                  height: isCollapsed ? 28 : 32,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0b5cab 0%, #0284c7 100%)",
                  boxShadow: "0 2px 6px rgba(11, 92, 171, 0.3)",
                  transition: "width 0.3s, height 0.3s",
                }}
              >
                <Layers size={isCollapsed ? 16 : 18} strokeWidth={2.5} />
              </div>

              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">
                    Enterprise Ops
                  </div>
                  <div className="text-xs text-muted-foreground font-medium truncate">
                    {teamLabel} • {roleLabel}
                  </div>
                </div>
              )}
            </div>
          </Button>

          {/* Workspace Menu Popover */}
          {isWorkspaceMenuOpen && !isCollapsed && (
            <div
              className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-lg z-50 p-2 animate-fade-in"
              role="menu"
            >
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Workspace
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted">
                <span className="font-medium text-sm">Enterprise Ops</span>
                <span className="text-xs text-success font-semibold">Active</span>
              </div>

              {isAdmin && (
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-all",
                    "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    setIsWorkspaceMenuOpen(false);
                    router.push("/admin");
                  }}
                  role="menuitem"
                >
                  <Shield size={14} className="text-primary" />
                  <span>Admin & Governance</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Add New Batch Button */}
        {canCreateBatch && onOpenCreateBatch && (
          <div className={cn("p-3", isCollapsed && "px-2")}>
            <Button
              variant="default"
              className={cn(
                "w-full gap-2 transition-all",
                isCollapsed && "justify-center p-2",
              )}
              style={{
                background: "linear-gradient(135deg, #0b5cab 0%, #0284c7 100%)",
              }}
              onClick={onOpenCreateBatch}
              aria-label="Add New Batch"
            >
              <Plus size={isCollapsed ? 18 : 15} strokeWidth={isCollapsed ? 2.5 : 2} className="text-white" />
              {!isCollapsed && <span className="font-semibold text-sm text-white">Add New Batch</span>}
            </Button>
          </div>
        )}

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "relative w-full gap-3 rounded-xl font-medium text-sm transition-all duration-200",
                  isCollapsed ? "justify-center p-2.5" : "justify-start px-3 py-2.5",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:translate-x-0.5",
                )}
                onClick={() => {
                  setActiveView(item.id as any);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                {isActive && !isCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-primary rounded-r-full" />
                )}
                <Icon
                  size={isCollapsed ? 20 : 17}
                  strokeWidth={isCollapsed ? 2.5 : 2}
                  className={cn(
                    "flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden="true"
                />
                {!isCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-primary-foreground bg-primary rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Collapse Toggle (Tablet) / Close Button (Mobile) */}
        {(!isMobile && isTablet) || isMobile ? (
          <div className={cn("p-3 border-t border-border", isCollapsed && "px-2")}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-xl transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
                !isCollapsed && "justify-end",
              )}
              onClick={() => {
                if (isMobile) {
                  setIsSidebarOpen(false);
                } else {
                  setIsCollapsed(!isCollapsed);
                }
              }}
              aria-label={isMobile ? "Close sidebar" : isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
            >
              {isMobile ? (
                <XIcon size={18} className="text-muted-foreground" />
              ) : (
                <ChevronLeft size={18} className="text-muted-foreground" />
              )}
            </Button>
          </div>
        ) : null}

        {/* Bottom User Profile Card */}
        <div
          className={cn("border-t border-border p-3", isCollapsed && "px-2")}
        >
          <div className="w-full gap-3 rounded-xl font-medium transition-all duration-200" style={{ display: "flex", flexDirection: isCollapsed ? "column" : "row", alignItems: "center" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-pink-200 to-pink-400 text-pink-900 font-semibold text-sm">
              {userInitial}
            </div>
            {!isCollapsed && (
              <div className="text-left min-w-0 flex-1">
                <div className="font-semibold text-foreground text-sm truncate">
                  {userDisplayName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {userDisplayEmail}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons - Always visible above profile */}
          {!isCollapsed && (
            <div className="mt-3 space-y-2 w-full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-all hover:bg-accent hover:text-accent-foreground"
                onClick={() => setIsChangePasswordOpen(true)}
              >
                <KeyRound size={15} className="text-primary" />
                <span>Change My Password</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm text-destructive transition-all hover:bg-destructive/10"
                onClick={logout}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Toggle Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open sidebar"
          aria-expanded={isSidebarOpen}
        >
          <Menu size={24} className="text-foreground" />
        </Button>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};