"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Shield, Layers } from "lucide-react";
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
      borderBottom: "1px solid rgba(160, 190, 223, 0.7)",
      background: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(10px)",
      position: "sticky",
      top: 0,
      zIndex: 40,
      padding: "12px 24px",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)"
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0b5cab 0%, #0d74c8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 20px rgba(11, 92, 171, 0.2)"
            }}>
              <Layers size={20} color="#ffffff" />
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
                Enterprise Operations Hub
              </h1>
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1, margin: 0 }}>
                Operations & Batch Execution Platform
              </p>
            </div>
          </Link>

          {/* Governance navigation is the only admin destination. */}
          {isAdmin && (
            <nav style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
              <Link
                href="/admin"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 13px",
                  borderRadius: 6,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: pathname.startsWith("/admin") ? "#0b5cab" : "var(--text-muted)",
                  background: pathname.startsWith("/admin") ? "#e8f2fb" : "transparent",
                  border: pathname.startsWith("/admin") ? "1px solid #bae6fd" : "1px solid transparent",
                  transition: "all 0.15s"
                }}
              >
                <Shield size={16} />
                <span>Admin & Governance</span>
              </Link>
            </nav>
          )}
        </div>

        {/* User Profile & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>

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
