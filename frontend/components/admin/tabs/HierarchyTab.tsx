"use client";

import React, { useMemo, useState } from "react";
import { GitFork, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countHierarchyMatches, OrgTreeNode } from "@/components/admin/OrgTreeNode";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import type { UserHierarchyNode } from "@/lib/api";
import {
  CountBadge, EmptyState, LoadingState, PANEL_CLASS, Panel, PanelBody, PanelHeading
} from "@/components/admin/ui";

export function HierarchyTab() {
  const { hierarchy, isLoading } = useAdminPortal();
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const isSelfMatch = React.useCallback(
    (node: UserHierarchyNode) => {
      if (!trimmedQuery) return false;
      const term = trimmedQuery.toLowerCase();
      return (
        node.full_name.toLowerCase().includes(term) ||
        node.email.toLowerCase().includes(term) ||
        (node.role_name || node.role).toLowerCase().includes(term) ||
        (node.team_name || "").toLowerCase().includes(term)
      );
    },
    [trimmedQuery]
  );

  const matchCount = useMemo(
    () => countHierarchyMatches(hierarchy, trimmedQuery),
    [hierarchy, trimmedQuery]
  );

  return (
    <Panel className={PANEL_CLASS}>
      <PanelHeading
        title="Organization Hierarchy & Reporting Tree"
        description="Reporting lines and team allocations across the organization."
        meta={<CountBadge value={hierarchy.length} label="root branches" />}
        actions={
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, title, team..."
              aria-label="Search the reporting tree"
              className="glass-input h-9 pl-9 pr-9 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear hierarchy search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading reporting hierarchy..." />
      ) : hierarchy.length === 0 ? (
        <EmptyState
          icon={<GitFork className="h-5 w-5" />}
          title="No reporting hierarchy configured yet"
          description="Assign a manager to staff members to build the reporting tree."
        />
      ) : trimmedQuery && matchCount === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title={`No one matches “${trimmedQuery}”`}
          description="Search by name, corporate email, position title, or team."
          action={
            <Button size="sm" variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <PanelBody className="space-y-4">
          {trimmedQuery && (
            <p className="text-xs font-medium text-muted-foreground">
              {matchCount} match{matchCount === 1 ? "" : "es"} · branches above a match stay visible
            </p>
          )}
          {hierarchy.map((rootNode) => (
            <OrgTreeNode key={rootNode.id} node={rootNode} query={trimmedQuery} isSelfMatch={isSelfMatch} />
          ))}
        </PanelBody>
      )}
    </Panel>
  );
}