"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Sliders, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import {
  ColumnsMenu, ExportButton, FullscreenTable, SortableHeaderCell, TableFilters
} from "@/components/table";
import type { CsvColumn } from "@/lib/csv";
import { errorMessage } from "@/lib/notify";
import { useTableFilters, type TableFilterField } from "@/hooks/useTableFilters";
import { useTableSort } from "@/hooks/useTableSort";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { SortAccessors, TableAccessor } from "@/lib/tableUtils";
import type { BatchOption } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdminPortal } from "@/components/admin/AdminPortalContext";
import { OPTION_TYPE_KEYS, OPTION_TYPE_LABELS, type OptionTypeKey } from "@/components/admin/optionTypes";
import {
  ACTIONS_COLUMN_STYLE, AdminDialog, EmptyState, ErrorBanner, FormField, LoadingState, NAVBAR_HEIGHT,
  PANEL_CLASS, PanelTitle, ROW_ACTION_BUTTON, RowActions, StatusPill, TABLE_TH_STYLE, TD, ActionsHeaderCell
} from "@/components/admin/ui";

const activeStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");

const SORT_ACCESSORS: SortAccessors<BatchOption> = {
  name: (o) => o.name,
  description: (o) => o.description,
  status: (o) => activeStatusLabel(o.is_active),
};

const SORT_OPTIONS = [
  { key: "name", label: "Option Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
];

const FILTER_FIELDS: readonly TableFilterField<BatchOption>[] = [
  { key: "status", accessor: SORT_ACCESSORS.status },
];

const SEARCH: TableAccessor<BatchOption> = (o) => [o.name, o.description].filter(Boolean).join(" ");

const COLUMNS = [
  { key: "name", label: "Option Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EXPORT_COLUMNS: CsvColumn<BatchOption>[] = [
  { key: "name", label: "Option Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status", value: (o) => activeStatusLabel(o.is_active) },
];

export function TaxonomyTab() {
  const { batchOptions, selectedOptionType, setSelectedOptionType, isLoadingOptions, createOption, deleteOption } =
    useAdminPortal();
  const confirmAction = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sort = useTableSort(batchOptions, SORT_ACCESSORS);
  const filters = useTableFilters(sort.sortedRows, FILTER_FIELDS, SEARCH);
  const filtered = filters.filteredRows;
  const columns = useColumnVisibility<ColumnKey>({ columns: COLUMNS });

  useEffect(() => { setPage(1); }, [filters.filtersVersion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSelectType = (key: OptionTypeKey) => {
    setSelectedOptionType(key);
    setPage(1);
    filters.clearFilters();
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createOption({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      setIsCreateOpen(false);
    } catch (error) {
      setFormError(errorMessage(error, "Failed to create option"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (option: BatchOption) => {
    const confirmed = await confirmAction({
      title: "Deactivate taxonomy option?",
      description: `"${option.name}" will no longer be selectable.`,
      confirmLabel: "Deactivate",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteOption(option);
  };

  const setLabel = OPTION_TYPE_LABELS[selectedOptionType];

  return (
    <>
      <FullscreenTable
        panelClassName={PANEL_CLASS}
        stickyHeader
        stickyTop={NAVBAR_HEIGHT}
        title={
          <PanelTitle
            title={`${setLabel} Management`}
            description="Options configured here become selectable when a batch is created."
            meta={<Badge variant="secondary" size="sm">{filtered.length} of {batchOptions.length}</Badge>}
          />
        }
        toolbar={
          <TableFilters
            search={{
              value: filters.search,
              onChange: filters.setSearch,
              placeholder: "Search options by name or description...",
            }}
            selects={[
              {
                key: "status",
                label: "Status",
                value: filters.getFilter("status"),
                onChange: (value) => filters.setFilter("status", value),
                options: filters.optionsFor("status"),
                allLabel: "All statuses",
              },
            ]}
            sort={{
              options: SORT_OPTIONS,
              sortKey: sort.sortKey,
              sortDir: sort.sortDir,
              onChange: sort.applySort,
            }}
            onClear={filters.clearFilters}
            hasActiveFilters={filters.hasActiveFilters}
            activeFilterCount={filters.activeFilterCount}
          >
            <div className="flex w-full flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Option set
              </span>
              <div
                role="group"
                aria-label="Option set"
                className="flex flex-wrap items-center gap-1.5"
              >
                {OPTION_TYPE_KEYS.map((key) => {
                  const isActive = selectedOptionType === key;
                  return (
                    <Button
                      key={key}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectType(key)}
                      aria-pressed={isActive}
                      className={cn(
                        "h-9 rounded-full px-3.5 text-xs font-semibold",
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {OPTION_TYPE_LABELS[key]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </TableFilters>
        }
        actions={
          <>
            <ColumnsMenu
              columns={COLUMNS}
              hidden={columns.hidden}
              onToggle={columns.toggle}
              onShowAll={columns.showAll}
            />
            <ExportButton filename={`taxonomy-${selectedOptionType}`} columns={EXPORT_COLUMNS} rows={filtered} />
            <Button
              size="sm"
              onClick={() => {
                setNewName("");
                setNewDescription("");
                setFormError(null);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Taxonomy Option</span>
            </Button>
          </>
        }
        footer={
          isLoadingOptions || paginated.length === 0 ? undefined : (
            <PaginationControls
              label={`${setLabel} pages`}
              currentPage={page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )
        }
      >
        {isLoadingOptions ? (
          <LoadingState label={`Loading ${setLabel.toLowerCase()}...`} />
        ) : batchOptions.length === 0 ? (
          <EmptyState
            icon={<Sliders className="h-5 w-5" />}
            title={`No ${setLabel.toLowerCase()} configured`}
            description="Add an option so it becomes selectable when a batch is created."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setNewName("");
                  setFormError(null);
                  setIsCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Taxonomy Option</span>
              </Button>
            }
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={<Sliders className="h-5 w-5" />}
            title="No options match the current filters"
            action={
              <Button size="sm" variant="outline" onClick={filters.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <table className="glass-table table-pin-first-col w-full border-collapse">
            <thead>
              <tr>
                {columns.isVisible("name") && (
                  <SortableHeaderCell
                    columnKey="name"
                    label="Option Name"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("description") && (
                  <SortableHeaderCell
                    columnKey="description"
                    label="Description"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                {columns.isVisible("status") && (
                  <SortableHeaderCell
                    columnKey="status"
                    label="Status"
                    style={TABLE_TH_STYLE}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onSort={sort.toggleSort}
                  />
                )}
                <ActionsHeaderCell />
              </tr>
            </thead>
            <tbody>
              {paginated.map((option) => (
                <tr key={option.id} className="border-b border-border/70 last:border-0">
                  {columns.isVisible("name") && (
                    <td className={cn(TD, "whitespace-nowrap font-semibold text-foreground")}>{option.name}</td>
                  )}
                  {columns.isVisible("description") && (
                    <td
                      className={cn(TD, "max-w-[380px] truncate text-muted-foreground")}
                      title={option.description || ""}
                    >
                      {option.description || "—"}
                    </td>
                  )}
                  {columns.isVisible("status") && (
                    <td className={TD}>
                      <StatusPill active={option.is_active} />
                    </td>
                  )}
                  <td className={cn(TD, "text-right")} style={ACTIONS_COLUMN_STYLE}>
                    <RowActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(option)}
                        title="Deactivate option"
                        aria-label={`Deactivate ${option.name}`}
                        className={cn(ROW_ACTION_BUTTON, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FullscreenTable>

      <AdminDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Taxonomy Option"
        description={`Add a new value under ${setLabel}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-option-form" loading={isSubmitting}>
              Add Option
            </Button>
          </>
        }
      >
        <form id="create-option-form" onSubmit={handleCreate} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}
          <FormField label="Option Name" required>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Masterclass, Hybrid 2.0"
              className="glass-input"
              required
            />
          </FormField>
          <FormField label="Description (Optional)">
            <input
              type="text"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Short description..."
              className="glass-input"
            />
          </FormField>
        </form>
      </AdminDialog>
    </>
  );
}