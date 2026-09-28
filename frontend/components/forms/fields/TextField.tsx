"use client";

import { forwardRef } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
                  "pr-10",
                  leftIcon && "pl-10",
                  rightIcon && "pr-10",
                  errorMessage && "border-destructive focus:ring-destructive",
                  disabled && "bg-muted"
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
        {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

TextField.displayName = "TextField";