"use client";

import { forwardRef, useState } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordFieldProps<T extends FieldValues> extends Omit<ControllerProps<T>, "name" | "control" | "rules" | "render"> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  showToggle?: boolean;
  rules?: ControllerProps<T>["rules"];
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps<any>>(
  ({ name, label, placeholder, required, disabled, helperText, className, error: propError, showToggle = true, ...props }, ref) => {
    const { formState: { errors }, control } = useFormContext();
    const errorMessage = (propError || errors[name as string]?.message) as string | undefined;
    const [show, setShow] = useState(false);

    return (
      <div className={cn(className)}>
        <Label htmlFor={name as string}>
          {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
        </Label>
        <div className="relative">
          <Controller
            name={name}
            control={control}
            rules={{ required: required ? "Required" : false, ...props.rules }}
            render={({ field }) => (
              <Input
                id={name as string}
                type={show ? "text" : "password"}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors",
                  "placeholder:text-muted-foreground/70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "pr-12",
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
          {showToggle && (
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded p-1 transition-colors"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
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

PasswordField.displayName = "PasswordField";