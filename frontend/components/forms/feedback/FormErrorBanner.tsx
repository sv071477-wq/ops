"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function FormErrorBanner({ message, onDismiss, className }: FormErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive",
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}
    </div>
  );
}