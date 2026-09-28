"use client";

import { forwardRef } from "react";
import { Controller, ControllerProps, FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SelectOption {
  id: string;
  name: string;
  label?: string;
}

interface SelectFieldProps<T extends FieldValues, TOption extends SelectOption = SelectOption> extends Omit<ControllerProps<T>, "name" | "control" | "rules" | "render"> {
  name: FieldPath<T>;
  label: string;
  options: TOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  allowClear?: boolean;
  getOptionLabel?: (option: TOption) => string;
  getOptionValue?: (option: TOption) => string;
  rules?: ControllerProps<T>["rules"];
}

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps<any, any>>(
  ({ name, label, options = [], placeholder, required, disabled, helperText, className, error: propError, allowClear, getOptionLabel = (o) => o.name, getOptionValue = (o) => o.id, ...props }, ref) => {
    const { formState: { errors }, control, watch } = useFormContext();
    const errorMessage = (propError || errors[name as string]?.message) as string | undefined;
    const value = watch(name as string);

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
            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
              <SelectTrigger
                ref={ref}
                id={name as string}
                disabled={disabled}
                error={!!errorMessage}
                className={cn(disabled && "bg-muted")}
                aria-invalid={errorMessage ? "true" : "false"}
                aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-helper` : undefined}
                {...props}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {allowClear && (
                  <SelectItem value="" disabled>
                    {placeholder || "Clear selection"}
                  </SelectItem>
                )}
                {options.map((option) => (
                  <SelectItem key={getOptionValue(option)} value={getOptionValue(option)}>
                    {getOptionLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

SelectField.displayName = "SelectField";