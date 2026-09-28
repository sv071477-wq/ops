"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldErrorProps {
  name: string;
  error?: string;
  className?: string;
}

export function FieldError({ name, error, className }: FieldErrorProps) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className={cn("flex items-center gap-1.5 text-sm text-destructive", className)} role="alert">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{error}</span>
    </p>
  );
}