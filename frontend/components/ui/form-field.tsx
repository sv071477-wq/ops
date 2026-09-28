"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  id?: string;
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, required, error, helperText, id, className, children, ...props }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');
    const errorId = `${fieldId}-error`;
    const helperId = `${fieldId}-helper`;

    return (
      <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
        <label
          htmlFor={fieldId}
          className={cn(
            "block text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, {
            id: fieldId,
            "aria-invalid": error ? "true" : "false",
            "aria-describedby": error ? errorId : helperText ? helperId : undefined,
          });
        })}
        {error && (
          <p id={errorId} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    >
      {children}
    </label>
  )
);
FormLabel.displayName = "FormLabel";

export const FormError = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-destructive", className)}
      role="alert"
      {...props}
    >
      {children}
    </p>
  )
);
FormError.displayName = "FormError";

export const FormHelperText = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
);
FormHelperText.displayName = "FormHelperText";