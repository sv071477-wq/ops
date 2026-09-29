"use client";

import { toast } from "@/components/ui/use-toast";

type ToastVariant = "default" | "destructive" | "success" | "info";

interface NotifyOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export function notify({ title, description, variant = "default" }: NotifyOptions) {
  toast({ title, description, variant });
}

/**
 * Extracts a human-readable message from whatever a rejected value happens to
 * be. Prefers the typed `message` produced by the API client, then a plain
 * string, and always falls back to something non-empty so the UI never shows a
 * blank toast.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function notifySuccess(title: string, description?: string) {
  notify({ title, description, variant: "success" });
}

export function notifyError(title: string, err?: unknown, fallback?: string) {
  notify({
    title,
    description: err === undefined ? undefined : errorMessage(err, fallback),
    variant: "destructive",
  });
}

export function notifyInfo(title: string, description?: string) {
  notify({ title, description, variant: "info" });
}
