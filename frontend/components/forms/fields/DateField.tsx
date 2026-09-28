"use client";

import { forwardRef } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DateFieldProps<T extends FieldValues> extends Omit<ControllerProps<T>, "name" | "control" | "rules" | "render"> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  min?: string;
  max?: string;
  rules?: ControllerProps<T>["rules"];
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps<any>>(
  ({ name, label, placeholder, required, disabled, helperText, className, error: propError, min, max, ...props }, ref) => {
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
              type="date"
              placeholder={placeholder}
              disabled={disabled}
              min={min}
              max={max}
              className={cn(errorMessage && "border-destructive focus:ring-destructive", disabled && "bg-muted")}
              aria-invalid={errorMessage ? "true" : "false"}
              aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-helper` : undefined}
              {...field}
              {...props}
            />
          )}
        />
        {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

DateField.displayName = "DateField";