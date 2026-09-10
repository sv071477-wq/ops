"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User as UserIcon, Shield, Layers, PlusCircle, CheckCircle } from "lucide-react";
import Link from "next/navigation";

interface NavbarProps {
  onOpenCreateModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateModal }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <Layers size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
              color: "var(--text-main)"
            }}>
              Enterprise Operations Hub
            </h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1 }}>
              3-Workflow Batch & Governance Platform
            </p>
          </div>
        </div>

        {/* Actions & User Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {onOpenCreateModal && (user.role === "Coordinator" || user.role === "Sales" || user.role === "Admin" || user.role === "Manager") && (
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
              color: "#38bdf8",
              fontSize: "0.8rem",
              fontWeight: 700
            }}>
              {user.full_name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.2 }}>
                {user.full_name.split(" ")[0]}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: 600 }}>
                {user.role}
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
              borderRadius: 10,
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
