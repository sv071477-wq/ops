"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Layers, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { user, login, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) {
      const targetRoute = user.role?.toLowerCase() === "admin" ? "/admin" : "/";
      if (typeof window !== "undefined") {
        window.location.href = targetRoute;
      } else {
        router.push(targetRoute);
      }
    }
  }, [user, isAuthLoading, router]);

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
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md mx-auto relative z-10">
        {/* Brand Card */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md mb-4">
            <Layers size={28} color="#ffffff" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Operations Hub Login
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to manage batches, faculty utilization, and quality checkpoints
          </p>
        </div>

        {/* Login Form Container */}
        <div className="glass-panel">
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive p-4 mb-4">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-foreground">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={cn(
                    "w-full h-10 rounded-lg border border-input bg-background pl-10 pr-3 text-sm transition-colors",
                    "placeholder:text-muted-foreground/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={cn(
                    "w-full h-10 rounded-lg border border-input bg-background pl-10 pr-14 text-sm transition-colors",
                    "placeholder:text-muted-foreground/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3 mt-2"
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
