"use client";

import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { FieldValues, FieldPath } from "react-hook-form";
import { Plus, X, UserCheck } from "lucide-react";
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
  const { control, register, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const isMaxItemsReached = !!maxItems && fields.length >= maxItems;
  const errorMessage = (errors[name as string]?.message as string) || undefined;

  const handleAdd = (value: string) => {
    const items = value.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    items.forEach(item => append({ name: item } as any));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, inputValue: string) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      handleAdd(inputValue);
    }
  };

  return (
    <div className={cn(className)}>
      <Label htmlFor={`${name}-input`}>
        {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
      </Label>
      
      <div className="flex">
        <Controller
          name={`${name}.newItem` as any}
          control={control}
          rules={{ required: false }}
          render={({ field }) => (
            <Input
              id={`${name}-input`}
              {...field}
              placeholder={placeholder}
              onKeyDown={(e) => handleKeyDown(e, field.value)}
              className="flex-1"
              disabled={isMaxItemsReached}
            />
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const input = document.getElementById(`${name}-input`) as HTMLInputElement;
            if (input?.value.trim()) handleAdd(input.value);
          }}
          disabled={isMaxItemsReached}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>

      {fields.length > 0 ? (
        <div className="flex flex-wrap">
          {fields.map((field: any, index) => (
            <Badge
              key={field.id}
              variant="secondary"
              className={cn("gap-1.5", "bg-primary/10 border-primary/25 text-primary")}
            >
              {itemIcon && <span>{itemIcon}</span>}
              <span className="font-medium">{itemLabel(field.value as { name: string })}</span>
              <Controller
                name={`${name}.${index}.remove` as any}
                control={control}
                render={({ field: _ }) => (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    aria-label={`Remove ${itemLabel(field.value as { name: string })}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              />
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No items added yet.</p>
      )}

      {maxItems && fields.length >= maxItems && (
        <p className="text-xs text-muted-foreground">Maximum {maxItems} items reached.</p>
      )}

      {helperText && !errorMessage && <p className="text-sm text-muted-foreground">{helperText}</p>}
      {errorMessage && <p id={`${name}-error`} className="text-sm text-destructive" role="alert">{errorMessage}</p>}
    </div>
  );
}