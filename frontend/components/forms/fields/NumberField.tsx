"use client";

import { forwardRef } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface NumberFieldProps<T extends FieldValues> extends Omit<ControllerProps<T>, "name" | "control" | "rules" | "render"> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  rules?: ControllerProps<T>["rules"];
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps<any>>(
  ({ name, label, placeholder, required, disabled, helperText, className, error: propError, min, max, step, ...props }, ref) => {
    const { formState: { errors }, control } = useFormContext();
    const errorMessage = (propError || errors[name as string]?.message) as string | undefined;

    return (
      <div className={cn(className)}>
        <Label htmlFor={name as string}>
          {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
        </Label>
        <Controller
          name={name}
          control={control}
          rules={{ required: required ? "Required" : false, ...props.rules }}
          render={({ field }) => (
            <Input
              id={name as string}
              type="number"
              placeholder={placeholder}
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              className={cn(
                "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors",
                "placeholder:text-muted-foreground/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                errorMessage && "border-destructive focus-visible:ring-destructive",
                disabled && "bg-muted cursor-not-allowed"
              )}
              aria-invalid={errorMessage ? "true" : "false"}
              aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-helper` : undefined}
              {...field}
              {...props}
            />
          )}
        />
        {errorMessage && (
          <p id={`${name}-error`} className="text-sm text-destructive mt-1 flex items-center gap-1" role="alert">
            <AlertCircle className="h-3 w-3" />
            {errorMessage}
          </p>
        )}
        {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground mt-1">{helperText}</p>}
      </div>
    );
  }
);

NumberField.displayName = "NumberField";