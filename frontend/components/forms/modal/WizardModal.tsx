"use client";

import { useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodTypeAny, ZodRawShape } from "zod";
import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormErrorBanner } from "@/components/forms/feedback/FormErrorBanner";
import { FormProvider } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface StepConfig<T extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  icon?: ReactNode;
  schema: ZodTypeAny;
  render: (form: UseFormReturn<any>) => ReactNode;
}

interface WizardModalProps<TData extends ZodTypeAny> {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<TData>) => Promise<void>;
  steps: StepConfig[];
  schema: TData;
  initialData?: Partial<z.infer<TData>>;
  title: string;
  submitLabel?: string;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export function WizardModal<TData extends ZodTypeAny>({
  isOpen,
  onClose,
  onSubmit,
  steps,
  schema,
  initialData,
  title,
  submitLabel = "Submit",
  loading,
  size = "xl",
}: WizardModalProps<TData>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<z.infer<TData>>({
    resolver: zodResolver(schema) as any,
    defaultValues: initialData as any,
    mode: "onBlur",
  });

  const validateStep = async (stepIndex: number): Promise<boolean> => {
    const stepSchema = steps[stepIndex].schema;
    const values = form.getValues();
    try {
      await stepSchema.parseAsync(values);
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.issues.forEach(e => form.setError(e.path.join(".") as any, { message: e.message }));
      }
      return false;
    }
  };

  const handleNext = async () => {
    if (await validateStep(currentStep)) {
      setCurrentStep(s => Math.min(steps.length - 1, s + 1));
      setSubmitError(null);
    }
  };

  const handlePrev = () => {
    setCurrentStep(s => Math.max(0, s - 1));
    setSubmitError(null);
  };

  const handleFinalSubmit = async (data: z.infer<TData>) => {
    for (let i = 0; i < steps.length; i++) {
      if (!(await validateStep(i))) {
        setCurrentStep(i);
        return;
      }
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(sizeClasses[size], "max-h-[90vh] p-0")}>
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b bg-muted/30">
          <ol className="flex items-center gap-2 overflow-x-auto pb-2" role="list" aria-label="Form steps">
            {steps.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={i > currentStep}
                  onClick={() => i < currentStep && setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : i < currentStep
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground",
                    i > currentStep && "cursor-not-allowed opacity-50"
                  )}
                  aria-current={i === currentStep ? "step" : undefined}
                >
                  {i < currentStep ? <Check className="h-4 w-4" /> : (
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
                {i < steps.length - 1 && (
                  <span className={cn("h-0.5 flex-1 max-w-20", i < currentStep ? "bg-green-500" : "bg-muted")} />
                )}
              </li>
            ))}
          </ol>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleFinalSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1">
              {submitError && <FormErrorBanner message={submitError} />}
              {step.render(form)}
            </div>

            <DialogFooter className="border-t flex justify-between gap-4">
              {currentStep > 0 ? (
                <Button type="button" variant="outline" onClick={handlePrev} disabled={isSubmitting}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}

              <div className="flex-1 flex justify-end gap-3">
                {currentStep < steps.length - 1 ? (
                  <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                    Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting || loading}>
                    {isSubmitting ? "Submitting..." : submitLabel}
                    <Check className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}