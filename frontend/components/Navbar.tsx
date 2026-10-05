"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Shield, Layers } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The brand mark's gradient, resolved from the design tokens and shared with the
 * sign-in page so both surfaces render the identical emblem instead of two
 * hardcoded colour pairs that drift apart.
 */
export const BRAND_GRADIENT =
  "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)";

/**
 * Compact 64px banner. `NAVBAR_HEIGHT` in `@/components/ui/panel` mirrors this
 * height because every sticky table parks itself just below it.
 */
export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";
  const isAdminRoute = pathname.startsWith("/admin");
  const fullName = user.full_name || "User";
  const roleLabel = user.role_detail?.name || user.role || "User";

  return (
    <header
      aria-label="Site header"
      className="sticky top-0 z-40 border-b border-border/70 bg-card/80 shadow-sm backdrop-blur-md"
    >
      <div className="mx-auto flex min-h-16 max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 sm:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span
              style={{ backgroundImage: BRAND_GRADIENT }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-primary"
            >
              <Layers className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <h1 className="truncate font-display text-sm font-bold tracking-tight text-foreground sm:text-base">
                <span className="sm:hidden">Enterprise Ops</span>
                <span className="hidden sm:inline">Enterprise Operations Hub</span>
              </h1>
              <p className="hidden truncate text-xs leading-tight text-muted-foreground lg:block">
                Operations &amp; Batch Execution Platform
              </p>
            </span>
          </Link>

          {/* Governance navigation is the only admin destination. */}
          {isAdmin && (
            <nav aria-label="Governance" className="shrink-0">
              <Link
                href="/admin"
                aria-current={isAdminRoute ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isAdminRoute
                    ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Admin &amp; Governance</span>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold uppercase text-primary"
            >
              {fullName.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-24 truncate text-[0.8rem] font-semibold text-foreground sm:max-w-40">
                {fullName}
              </span>
              <span className="max-w-24 truncate text-[0.7rem] font-semibold text-primary sm:max-w-40">
                {roleLabel}
              </span>
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
};
