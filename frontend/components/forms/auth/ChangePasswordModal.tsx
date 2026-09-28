"use client";

import React, { useState } from "react";
import { api, User } from "@/lib/api";
import { Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, X, KeyRound } from "lucide-react";
import { FormModal } from "@/components/forms/modal/FormModal";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/schemas";
import { TextField, PasswordField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isAdminMode = !!selectedUser || !!targetUser;

  const handleGeneratePassword = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pwd = "";
    pwd += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pwd += "abcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 25)];
    pwd += "23456789"[Math.floor(Math.random() * 8)];
    pwd += "!@#$%&*"[Math.floor(Math.random() * 7)];
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    const shuffled = pwd.split("").sort(() => 0.5 - Math.random()).join("");
    return shuffled;
  };

  const handleSubmit = async (data: ChangePasswordInput) => {
    setIsLoading(true);
    try {
      if (isAdminMode) {
        const activeUser = selectedUser || targetUser;
        if (!activeUser) {
          throw new Error("Please select a target user.");
        }
        await api.adminChangeUserPassword(activeUser.id, data.new_password);
      } else {
        await api.changePassword(data.current_password!, data.new_password);
      }
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1400);
    } catch (err: any) {
      throw new Error(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      schema={changePasswordSchema}
      title={isAdminMode ? "Change User Password" : "Change My Password"}
      description={isAdminMode ? "Admin security override for user account" : "Update your personal login credentials"}
      submitLabel={isAdminMode ? "Update User Password" : "Change Password"}
      loading={isLoading}
      size="md"
      render={(form) => (
        <>
          {/* User Selection in Admin Mode */}
          {isAdminMode && allUsers && allUsers.length > 1 && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Select Staff Member</label>
              <select
                value={selectedUser?.id || ""}
                onChange={(e) => {
                  const u = allUsers.find((x) => x.id === e.target.value);
                  if (u) setSelectedUser(u);
                }}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email}) — {u.role_detail?.name || u.role}
                  </option>
                ))}
              </select>
              {selectedUser && (
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedUser.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <Badge variant="secondary">{selectedUser.role_detail?.name || selectedUser.role}</Badge>
                </div>
              )}
            </div>
          )}

          {!isAdminMode && (
            <PasswordField
              name="current_password"
              label="Current Password *"
              placeholder="Enter current password"
              required
            />
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold">New Password *</label>
              <button
                type="button"
                onClick={() => {
                  const generated = handleGeneratePassword();
                  form.setValue("new_password", generated);
                  form.setValue("confirm_password", generated);
                  setShowNew(true);
                  setShowConfirm(true);
                }}
                className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Sparkles className="h-4 w-4" />
                Generate Strong Password
              </button>
            </div>
            
            <PasswordField
              name="new_password"
              label=""
              placeholder="At least 8 characters"
              required
              showToggle
            />

            <PasswordField
              name="confirm_password"
              label="Confirm New Password *"
              placeholder="Re-enter new password"
              required
              showToggle
            />
          </div>
        </>
      )}
    />
  );
};