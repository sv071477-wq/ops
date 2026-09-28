"use client";

import { forwardRef, useState } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
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
                className={cn("pr-12", errorMessage && "border-destructive focus:ring-destructive", disabled && "bg-muted")}
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";