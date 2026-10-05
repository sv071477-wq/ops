"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserHierarchyNode } from "@/lib/api";
import { cn } from "@/lib/utils";

interface OrgTreeNodeProps {
  node: UserHierarchyNode;
  depth?: number;
  query: string;
  isSelfMatch: (node: UserHierarchyNode) => boolean;
}

function matches(node: UserHierarchyNode, query: string): boolean {
  if (!query) return false;
  const term = query.toLowerCase();
  return (
    node.full_name.toLowerCase().includes(term) ||
    node.email.toLowerCase().includes(term) ||
    (node.role_name || node.role).toLowerCase().includes(term) ||
    (node.team_name || "").toLowerCase().includes(term)
  );
}

/**
 * A reporting line stays visible when it matches the search itself or when it is
 * an ancestor of a match, so searching for an employee keeps the chain of
 * managers above them on screen.
 */
function keepSubtree(node: UserHierarchyNode, query: string): boolean {
  if (!query) return true;
  if (matches(node, query)) return true;
  return node.direct_reports.some((child) => keepSubtree(child, query));
}

export function countHierarchyMatches(roots: UserHierarchyNode[], query: string): number {
  const term = query.trim().toLowerCase();
  if (!term) return 0;
  const walk = (node: UserHierarchyNode): number => {
    const self =
      node.full_name.toLowerCase().includes(term) ||
      node.email.toLowerCase().includes(term) ||
      (node.role_name || node.role).toLowerCase().includes(term) ||
      (node.team_name || "").toLowerCase().includes(term)
        ? 1
        : 0;
    return self + node.direct_reports.reduce((total, child) => total + walk(child), 0);
  };
  return roots.reduce((total, root) => total + walk(root), 0);
}

export function OrgTreeNode({ node, depth = 0, query, isSelfMatch }: OrgTreeNodeProps) {
  const hasChildren = node.direct_reports.length > 0;
  const isManager = hasChildren || ["manager", "admin"].includes(node.role?.toLowerCase());
  const [collapsed, setCollapsed] = useState(false);

  const visibleChildren = useMemo(
    () => (query ? node.direct_reports.filter((child) => keepSubtree(child, query)) : node.direct_reports),
    [node.direct_reports, query]
  );

  // A search always expands the tree so every match is reachable.
  const expanded = !collapsed || Boolean(query);

  return (
    <div
      className="relative"
      style={{ marginTop: depth > 0 ? 12 : 0, marginLeft: depth > 0 ? 28 : 0 }}
    >
      {depth > 0 && <span className="absolute -left-4 top-6 h-px w-4 bg-border" aria-hidden="true" />}

      <div
        className={cn(
          "flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors sm:px-5",
          isSelfMatch(node)
            ? "border-warning/60 bg-warning/10"
            : isManager
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
            aria-hidden="true"
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
              {node.team_name && (
                <Badge variant="info" size="sm">
                  {node.team_name}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{node.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasChildren ? (
            <>
              <Badge variant="success" size="sm">
                Manages {node.direct_reports.length} direct report{node.direct_reports.length === 1 ? "" : "s"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setCollapsed((value) => !value)}
                disabled={Boolean(query)}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} reports of ${node.full_name}`}
                title={query ? "Clear the search to collapse branches" : undefined}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/70">Individual contributor</span>
          )}
        </div>
      </div>

      {hasChildren && expanded && visibleChildren.length > 0 && (
        <div className="ml-3.5 border-l-2 border-border pl-4 sm:ml-4">
          {visibleChildren.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} query={query} isSelfMatch={isSelfMatch} />
          ))}
        </div>
      )}
    </div>
  );
}