"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeView: "batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty";
  setActiveView: (view: "batches" | "manager_board" | "approvals" | "finance" | "analytics" | "faculty") => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onOpenCreateBatch?: () => void;
  pendingApprovalsCount?: number;
  onFilterCategory?: (category: string) => void;
  activeCategoryFilter?: string;
}

export function DashboardLayout({
  children,
  activeView,
  setActiveView,
  searchQuery,
  setSearchQuery,
  onOpenCreateBatch,
  pendingApprovalsCount,
  onFilterCategory,
  activeCategoryFilter,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCreateBatch={onOpenCreateBatch}
        pendingApprovalsCount={pendingApprovalsCount}
        onFilterCategory={onFilterCategory}
        activeCategoryFilter={activeCategoryFilter}
      />
      <main className={cn(
        "lg:ml-0 transition-all duration-300",
        "flex-1 min-w-0"
      )}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}