"use client";

import { forwardRef } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface TextFieldProps<T extends FieldValues> extends Omit<ControllerProps<T>, "name" | "control" | "rules" | "render"> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "url" | "tel" | "password";
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rules?: ControllerProps<T>["rules"];
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps<any>>(
  ({ name, label, placeholder, type = "text", required, disabled, helperText, className, leftIcon, rightIcon, error: propError, ...props }, ref) => {
    const { formState: { errors }, control } = useFormContext();
    const errorMessage = (propError || errors[name as string]?.message) as string | undefined;

    return (
      <div className={cn(className)}>
        <Label htmlFor={name as string}>
          {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
        </Label>
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          <Controller
            name={name}
            control={control}
            rules={{ required: required ? "Required" : false, ...props.rules }}
            render={({ field }) => (
              <Input
                id={name as string}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  "peer",
                  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors",
                  "placeholder:text-muted-foreground/70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  leftIcon && "pl-10",
                  rightIcon && "pr-10",
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
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
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

TextField.displayName = "TextField";