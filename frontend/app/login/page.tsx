"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layers, Lock, Mail, ArrowRight, Shield, UserCheck, Briefcase, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setIsLoading(true);
    try {
      await login(demoEmail, demoPass);
    } catch (err: any) {
      setError(err.message || "Failed to login with demo credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative"
    }}>
      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 10 }}>
        {/* Brand Card */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 6,
            background: "#0b5cab",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "none",
            marginBottom: 16
          }}>
            <Layers size={28} color="#ffffff" />
          </div>
          <h1 style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--text-main)"
          }}>
            Operations Hub Login
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 6 }}>
            Sign in to manage batches, faculty utilization, and quality checkpoints
          </p>
        </div>

        {/* Login Form Container */}
        <div className="glass-panel" style={{ padding: "32px" }}>
          {error && (
            <div style={{
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#fb7185",
              padding: "12px 16px",
              borderRadius: 12,
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Corporate Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={18} color="var(--text-dim)" style={{ position: "absolute", left: 14, top: 12 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@enterprise-ops.com"
                  className="glass-input"
                  style={{ paddingLeft: 42 }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="var(--text-dim)" style={{ position: "absolute", left: 14, top: 12 }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="glass-input"
                  style={{ paddingLeft: 42 }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: 8 }}
            >
              <span>{isLoading ? "Signing in..." : "Sign In to Platform"}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick Demo Login Switcher */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Sparkles size={14} color="#38bdf8" />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                1-Click Demo Personas
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@enterprise-ops.com", "Admin@12345")}
                className="btn btn-secondary"
                style={{ padding: "8px 10px", fontSize: "0.775rem", justifyContent: "flex-start", gap: 8 }}
              >
                <Shield size={14} color="#a855f7" />
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, color: "#d8b4fe" }}>Admin</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Full System Access</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("manager@enterprise-ops.com", "Manager@12345")}
                className="btn btn-secondary"
                style={{ padding: "8px 10px", fontSize: "0.775rem", justifyContent: "flex-start", gap: 8 }}
              >
                <UserCheck size={14} color="#38bdf8" />
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, color: "#7dd3fc" }}>Manager</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Approvals & Gates</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("coordinator@enterprise-ops.com", "Coord@12345")}
                className="btn btn-secondary"
                style={{ padding: "8px 10px", fontSize: "0.775rem", justifyContent: "flex-start", gap: 8 }}
              >
                <Layers size={14} color="#f59e0b" />
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, color: "#fcd34d" }}>Coordinator</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Batch Creation</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("sales@enterprise-ops.com", "Sales@12345")}
                className="btn btn-secondary"
                style={{ padding: "8px 10px", fontSize: "0.775rem", justifyContent: "flex-start", gap: 8 }}
              >
                <Briefcase size={14} color="#10b981" />
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, color: "#6ee7b7" }}>Sales SPOC</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Client Request</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
