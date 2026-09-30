"use client";

import { useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodTypeAny } from "zod";
import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormErrorBanner } from "@/components/forms/feedback/FormErrorBanner";
import { FormProvider } from "react-hook-form";
import { cn } from "@/lib/utils";

type InferSchema<T extends ZodTypeAny> = z.infer<T>;

interface FormModalProps<T extends ZodTypeAny> {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InferSchema<T>) => Promise<void>;
  schema: T;
  render: (form: UseFormReturn<InferSchema<T>>) => ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  initialData?: Partial<InferSchema<T>>;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function FormModal<T extends ZodTypeAny>({
  isOpen,
  onClose,
  onSubmit,
  schema,
  render,
  title,
  description,
  submitLabel = "Submit",
  initialData,
  loading,
  size = "lg",
}: FormModalProps<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<InferSchema<T>>({
    resolver: zodResolver(schema) as any,
    defaultValues: initialData as any,
    mode: "onBlur",
  });

  const handleSubmit = async (data: InferSchema<T>) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      let message = "Submission failed. Please check your inputs and try again.";

      if (err?.detail) {
        if (Array.isArray(err.detail)) {
          message = err.detail.map((d: any) => d.msg || d.message || String(d)).join(" | ");
        } else if (typeof err.detail === "string") {
          message = err.detail;
        } else if (err.detail?.msg) {
          message = err.detail.msg;
        }
      } else if (err?.message) {
        message = err.message;
      }

      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(sizeClasses[size], "max-h-[90vh] p-0 flex flex-col")}>
        <DialogHeader className="border-b p-6 shrink-0">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-muted-foreground mt-1">{description}</DialogDescription>}
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="modal-scroll-content flex-1">
              {submitError && <FormErrorBanner message={submitError} className="mb-4" />}
              {render(form)}
            </div>

            <DialogFooter className="border-t p-4 shrink-0 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || loading}>
                {isSubmitting ? "Submitting..." : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}