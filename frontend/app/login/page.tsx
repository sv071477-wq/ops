"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layers, Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";

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
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || "Unable to sign in. Verify your email and password and try again.");
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
                  placeholder="name@company.com"
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
                  placeholder="Enter your password"
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
              <span>{isLoading ? "Signing in..." : "Sign in"}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
