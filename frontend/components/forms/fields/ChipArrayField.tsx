"use client";

import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { FieldValues, FieldPath } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ChipArrayFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  addButtonLabel?: string;
  itemLabel?: (item: { name: string }) => string;
  itemIcon?: React.ReactNode;
  maxItems?: number;
  className?: string;
  required?: boolean;
  helperText?: string;
}

export function ChipArrayField<T extends FieldValues>({
  name,
  label,
  placeholder = "Type and press Enter or click Add",
  addButtonLabel = "Add",
  itemLabel = (item) => item.name,
  itemIcon,
  maxItems,
  className,
  required,
  helperText,
}: ChipArrayFieldProps<T>) {
  const { control, formState: { errors }, watch, setValue } = useFormContext();
  const { fields, remove } = useFieldArray({ control, name });
  const [draft, setDraft] = useState("");
  const isMaxItemsReached = !!maxItems && fields.length >= maxItems;
  const errorMessage = (errors[name as string]?.message as string) || undefined;

  const handleAdd = (value: string) => {
    const items = value.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    const newItems = items.map(item => ({ name: item }));
    const currentValues = watch(name) || [];
    setValue(name, [...currentValues.filter(Boolean), ...newItems] as any, { shouldValidate: true });
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      handleAdd(draft);
    }
  };

  return (
    <div className={cn(className)}>
      <Label htmlFor={`${name}-input`}>
        {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
      </Label>

      <div className="flex">
        <Input
          id={`${name}-input`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 rounded-r-none",
            errorMessage && "border-destructive focus:ring-destructive"
          )}
          disabled={isMaxItemsReached}
          aria-invalid={errorMessage ? "true" : "false"}
          aria-describedby={errorMessage ? `${name}-error` : helperText ? `${name}-helper` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-l-none border-l-0"
          onClick={() => handleAdd(draft)}
          disabled={isMaxItemsReached || !draft.trim()}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>

      {fields.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {fields.map((field: any, index) => {
            const value = ((field?.value ?? field) || {}) as { name?: string };
            const labelText = itemLabel(value as { name: string }) || value.name || "Item";
            return (
              <Badge
                key={field.id}
                variant="secondary"
                className={cn("gap-1.5 px-3 py-1", "bg-primary/10 border-primary/25 text-primary")}
              >
                {itemIcon && <span className="flex-shrink-0">{itemIcon}</span>}
                <span className="font-medium">{labelText}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded p-0.5 transition-colors"
                  aria-label={`Remove ${labelText}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic mt-2">No items added yet.</p>
      )}

      {maxItems && fields.length >= maxItems && (
        <p className="text-xs text-muted-foreground mt-1">Maximum {maxItems} items reached.</p>
      )}

      {helperText && !errorMessage && <p id={`${name}-helper`} className="text-sm text-muted-foreground mt-1">{helperText}</p>}
      {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive mt-1" role="alert">{errorMessage}</p>}
    </div>
  );
}