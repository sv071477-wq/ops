"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, Bell, Calendar, Zap, Layers, Settings, HelpCircle,
  Plus, ChevronsUpDown, Shield, LogOut, KeyRound, Check, X,
  ExternalLink, Sparkles, ChevronLeft, Menu, X as XIcon
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile, useIsTablet } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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

  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLAsideElement>(null);

  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isFinance = user?.team_name?.trim().toLowerCase() === "finance" || user?.role?.toLowerCase() === "finance";
  const isApprover = user?.is_configured_approver === true;
  const canCreateBatch = !isAdmin && user?.team_name?.trim().toLowerCase() === "delivery";
  const isManager = (user?.direct_reports_count ?? 0) > 0 || user?.is_manager || user?.role?.toLowerCase() === "manager" || isAdmin;
  const canSeeManagerBoard = !isFinance && isManager;
  const canSeeAnalytics = !isFinance && isManager;

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

  const navItems = [
    ...(isFinance ? [{
      id: "finance",
      label: "Finance Review",
      icon: Layers,
      badge: null,
    }] : []),
    {
      id: "batches",
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
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col",
          "shadow-xl",
          isMobile ? "w-72 transform" : isCollapsed ? "w-[72px]" : "w-[256px]",
          isMobile && !isSidebarOpen ? "-translate-x-full" : "translate-x-0",
          "lg:relative lg:translate-x-0"
        )}
        style={{ width: sidebarWidth }}
        aria-label="Main navigation"
      >
        {/* Top Header: Brand / Team Selector */}
        <div style={{ position: "relative" }} ref={workspaceMenuRef}>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 p-2"
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            aria-expanded={isWorkspaceMenuOpen}
            aria-haspopup="true"
          >
            {!isCollapsed && (
              <>
                {/* Logo emblem */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #0b5cab 0%, #0284c7 100%)",
                    boxShadow: "0 2px 6px rgba(11, 92, 171, 0.3)",
                  }}
                >
                  <Layers size={18} strokeWidth={2.5} className="text-white" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">
                    Enterprise Ops
                  </div>
                  <div className="text-xs text-muted-foreground font-medium truncate">
                    {teamLabel} • {roleLabel}
                  </div>
                </div>
              </>
            )}
            {isCollapsed && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{
                background: "linear-gradient(135deg, #0b5cab 0%, #0284c7 100%)",
                boxShadow: "0 2px 6px rgba(11, 92, 171, 0.3)",
              }}>
                <Layers size={18} strokeWidth={2.5} className="text-white" />
              </div>
            )}
            {!isCollapsed && <ChevronsUpDown size={14} className="text-muted-foreground ml-auto" />}
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
                  className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm"
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

        {/* Search Bar */}
        <div className={cn("p-3 border-b border-border", isCollapsed && "px-2")}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={isCollapsed ? "" : "Search batches..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              className={cn(
                "pl-9 h-9 text-sm",
                isCollapsed && "w-9",
              )}
              aria-label="Search batches"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery?.("")}
                aria-label="Clear search"
              >
                <X size={14} className="text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {/* Add New Batch Button */}
        {canCreateBatch && onOpenCreateBatch && (
          <div className={cn("p-3", isCollapsed && "px-2")}>
            <Button
              variant="default"
              className={cn(
                "w-full justify-center gap-2",
                isCollapsed && "p-2",
                "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              )}
              onClick={onOpenCreateBatch}
              aria-label="Add New Batch"
            >
              <Plus size={15} strokeWidth={2.5} />
              {!isCollapsed && <span className="font-semibold text-sm">Add New Batch</span>}
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
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  isCollapsed && "p-2 justify-center",
                  isActive && "bg-primary/10 text-primary border-primary/20",
                  !isActive && "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                onClick={() => {
                  setActiveView(item.id as any);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon size={17} className={cn("flex-shrink-0", isActive && "text-primary")} aria-hidden="true" />
                {!isCollapsed && (
                  <span className="font-medium text-sm truncate">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-primary-foreground bg-primary rounded-full">
                    {item.badge}
                  </span>
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
              className={cn("w-full justify-center", !isCollapsed && "justify-end")}
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
              ) : isCollapsed ? (
                <ChevronLeft size={18} className="text-muted-foreground" />
              ) : (
                <ChevronLeft size={18} className="text-muted-foreground" />
              )}
            </Button>
          </div>
        ) : null}

        {/* Bottom User Profile Card */}
        <div
          className={cn("border-t border-border p-3", isCollapsed && "px-2")}
          ref={userMenuRef}
        >
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              isCollapsed && "p-2 justify-center"
            )}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
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
            {!isCollapsed && <ChevronsUpDown size={14} className="text-muted-foreground ml-auto" />}
          </Button>

          {/* User Popover Dropdown */}
          {isUserMenuOpen && !isCollapsed && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-xl shadow-lg z-50 p-2 animate-slide-in-bottom"
              role="menu"
            >
              <div className="px-2 py-2 border-b border-border">
                <div className="font-semibold text-sm text-foreground">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {user?.role_detail?.name || user?.role} • {user?.team_name || "Ops"}
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                role="menuitem"
              >
                <KeyRound size={15} className="text-primary" />
                <span>Change My Password</span>
              </Button>

              {isAdmin && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push("/admin");
                  }}
                  role="menuitem"
                >
                  <Shield size={15} className="text-primary" />
                  <span>Admin Portal</span>
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 py-1.5 rounded-lg text-sm text-destructive"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                role="menuitem"
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