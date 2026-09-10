"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Shield, Layers, PlusCircle, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  onOpenCreateModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateModal }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";

  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "#ffffff",
      position: "sticky",
      top: 0,
      zIndex: 40,
      padding: "12px 24px"
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href={isAdmin ? "/admin" : "/"} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              background: "#0b5cab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "none"
            }}>
              {isAdmin ? <Shield size={20} color="#ffffff" /> : <Layers size={20} color="#ffffff" />}
            </div>
            <div>
              <h1 style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
                color: "var(--text-main)",
                margin: 0
              }}>
                {isAdmin ? "Enterprise Admin Portal" : "Enterprise Operations Hub"}
              </h1>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1, margin: 0 }}>
                {isAdmin ? "Organization Governance & Staff Management" : "Operations & Batch Execution Platform"}
              </p>
            </div>
          </Link>

          {/* Navigation Links for Non-Admin Operations */}
          {!isAdmin && (
            <nav style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "#0b5cab",
                  background: "#e8f2fb",
                  transition: "all 0.15s"
                }}
              >
                <LayoutDashboard size={16} />
                <span>Operations Dashboard</span>
              </Link>
            </nav>
          )}
        </div>

        {/* Actions & User Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* New Batch is only for Operations staff (Coordinator, Sales, Manager) - never for strictly Admin */}
          {!isAdmin && onOpenCreateModal && (
            <button
              onClick={onOpenCreateModal}
              className="btn btn-primary"
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
            >
              <PlusCircle size={16} />
              <span>New Batch</span>
            </button>
          )}

          {/* User Pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f7f9fb",
            border: "1px solid var(--border-subtle)",
            padding: "6px 12px",
            borderRadius: 6
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: "#e8f2fb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b5cab",
              fontSize: "0.8rem",
              fontWeight: 700
            }}>
              {user.full_name ? user.full_name.charAt(0) : "U"}
            </div>
            <div>
              <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.2 }}>
                {user.full_name ? user.full_name.split(" ")[0] : "User"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#0b5cab", fontWeight: 600 }}>
                {user.role_detail?.name || user.role}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Logout"
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-dim)",
              width: 36,
              height: 36,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#f43f5e";
              e.currentTarget.style.color = "#f43f5e";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--text-dim)";
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
