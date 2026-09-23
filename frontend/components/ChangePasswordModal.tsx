"use client";

import React, { useState } from "react";
import { api, User } from "@/lib/api";
import { Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, X, KeyRound } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If targetUser is provided, admin is resetting that user's password.
  // If null or undefined, the current logged-in user is changing their own password.
  targetUser?: User | null;
  allUsers?: User[];
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  allUsers,
  onSuccess,
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(targetUser || (allUsers && allUsers.length > 0 ? allUsers[0] : null));

  // Sync selected user when targetUser or allUsers change
  React.useEffect(() => {
    if (targetUser) {
      setSelectedUser(targetUser);
    } else if (allUsers && allUsers.length > 0) {
      setSelectedUser(allUsers[0]);
    } else {
      setSelectedUser(null);
    }
  }, [targetUser, allUsers]);

  const isAdminMode = !!selectedUser || !!targetUser;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pwd = "";
    // Ensure at least 1 uppercase, 1 lowercase, 1 number, 1 special char
    pwd += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pwd += "abcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 25)];
    pwd += "23456789"[Math.floor(Math.random() * 8)];
    pwd += "!@#$%&*"[Math.floor(Math.random() * 7)];
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    const shuffled = pwd.split("").sort(() => 0.5 - Math.random()).join("");
    setNewPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowNew(true);
    setShowConfirm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (!isAdminMode && !currentPassword) {
      setError("Please provide your current password.");
      return;
    }

    setIsLoading(true);
    try {
      if (isAdminMode) {
        const activeUser = selectedUser || targetUser;
        if (!activeUser) {
          setError("Please select a target user.");
          setIsLoading(false);
          return;
        }
        await api.adminChangeUserPassword(activeUser.id, newPassword);
        setSuccessMsg(`Password for ${activeUser.full_name || activeUser.email} updated successfully!`);
      } else {
        await api.changePassword(currentPassword, newPassword);
        setSuccessMsg("Your password has been changed successfully!");
      }

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    }}>
      <div className="glass-panel" style={{
        width: "100%",
        maxWidth: 480,
        background: "#ffffff",
        borderRadius: 20,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        overflow: "hidden",
        border: "1px solid rgba(226, 232, 240, 0.9)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fafafa"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#e8f2fb",
              color: "#0b5cab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
                {isAdminMode ? "Change User Password" : "Change My Password"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                {isAdminMode
                  ? "Admin security override for user account"
                  : "Update your personal login credentials"}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Selection / Card in Admin Mode */}
        {isAdminMode && (
          <div style={{
            margin: "16px 24px 0",
            padding: "12px 16px",
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {allUsers && allUsers.length > 1 && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
                  Select Staff Member
                </label>
                <select
                  value={selectedUser?.id || ""}
                  onChange={(e) => {
                    const u = allUsers.find((x) => x.id === e.target.value);
                    if (u) setSelectedUser(u);
                  }}
                  className="glass-input"
                  style={{ width: "100%", fontSize: "0.85rem", fontWeight: 600 }}
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}) — {u.role_detail?.name || u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedUser && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>
                    {selectedUser.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {selectedUser.email}
                  </div>
                </div>
                <div style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "#e8f2fb",
                  color: "#0b5cab"
                }}>
                  {selectedUser.role_detail?.name || selectedUser.role}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#16a34a",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Password (only in self-service mode) */}
          {!isAdminMode && (
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Current Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="glass-input"
                  style={{ width: "100%", paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 4
                  }}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                New Password *
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0b5cab",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 6px"
                }}
              >
                <Sparkles size={13} />
                <span>Generate Strong Password</span>
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                className="glass-input"
                style={{ width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4
                }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Confirm New Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={8}
                required
                className="glass-input"
                style={{ width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              style={{ padding: "8px 16px", borderRadius: 10 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #0b5cab 0%, #0d74c8 100%)",
                fontWeight: 600,
              }}
            >
              {isLoading ? "Saving..." : isAdminMode ? "Update User Password" : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
