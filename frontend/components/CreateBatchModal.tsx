"use client";

import React, { useEffect, useState } from "react";
import { api, BatchOption, User } from "@/lib/api";
import { formatDate, calendarDaysBetween } from "@/lib/dateUtils";
import { Info } from "lucide-react";
import { FormModal } from "@/components/forms/modal/FormModal";
import { createBatchSchema, normalizeCodeChars, type CreateBatchInput } from "@/lib/validation/schemas";
import {
  TextField,
  SelectField,
  DateField,
  NumberField,
  TextAreaField,
  ChipArrayField,
} from "@/components/forms/fields";

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated: () => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ isOpen, onClose, onBatchCreated }) => {
  const [options, setOptions] = useState<Record<string, BatchOption[]>>({
    entities: [],
    categories: [],
    modes: [],
    accommodations: [],
  });
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<Record<string, User[]>>({
    sales: [],
    coordinators: [],
    managers: [],
  });

  useEffect(() => {
    if (!isOpen) return;
    setOptionsError(null);
    let isCurrent = true;
    const requests = [
      api.getBatchOptions("entities"),
      api.getBatchOptions("categories"),
      api.getBatchOptions("delivery-modes"),
      api.getBatchOptions("accommodations"),
      api.getAssignableUsers("Sales", "Sales"),
      api.getAssignableUsers("Coordinator"),
      api.getAssignableUsers("Manager"),
    ] as const;
    const labels = [
      "entities",
      "categories",
      "delivery modes",
      "accommodations",
      "Sales contacts",
      "coordinators",
      "managers",
    ];

    Promise.allSettled(requests).then((results) => {
      if (!isCurrent) return;

      setOptions({
        entities: results[0].status === "fulfilled" ? results[0].value : [],
        categories: results[1].status === "fulfilled" ? results[1].value : [],
        modes: results[2].status === "fulfilled" ? results[2].value : [],
        accommodations: results[3].status === "fulfilled" ? results[3].value : [],
      });
      setAssignableUsers({
        sales: results[4].status === "fulfilled" ? results[4].value : [],
        coordinators: results[5].status === "fulfilled" ? results[5].value : [],
        managers: results[6].status === "fulfilled" ? results[6].value : [],
      });

      const failedLabels = results.flatMap((result, index) => {
        if (result.status !== "rejected") return [];
        console.error(`Failed to load create-batch ${labels[index]}:`, result.reason);
        return [labels[index]];
      });
      if (failedLabels.length > 0) {
        setOptionsError(`Could not load ${failedLabels.join(", ")}. Please try again.`);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [isOpen]);

  const handleSubmit = async (data: CreateBatchInput) => {
    const totalEnrollments = Number(data.total_enrollments) || 0;
    const facultyMembers: Array<{ name?: string }> = Array.isArray(data.faculty_members)
      ? data.faculty_members
      : [];

    await api.createBatch({
      batch_id: data.batch_id.trim().toUpperCase(),
      program_name: data.program_name.trim(),
      client_name: data.client_name?.trim(),
      domain: data.domain?.trim(),
      technology: data.technology?.trim(),
      entity_id: data.entity_id?.trim(),
      category_id: data.category_id?.trim(),
      delivery_mode_id: data.delivery_mode_id?.trim(),
      accommodation_id: data.accommodation_id?.trim(),
      sales_spoc_id: data.sales_spoc_id.trim(),
      coordinator_id: data.coordinator_id.trim(),
      primary_manager_id: data.primary_manager_id.trim(),
      delivery_mode: options.modes?.find((m) => m.id === data.delivery_mode_id)?.name || "Online",
      location_city: data.location_city?.trim() || undefined,
      start_date: data.start_date ? new Date(data.start_date).toISOString() : undefined,
      end_date: data.end_date ? new Date(data.end_date).toISOString() : undefined,
      training_days: Number(data.training_days) || 0,
      total_hours: Number(data.total_hours) || 0,
      total_enrollments: totalEnrollments,
      sow_number: data.sow_number?.trim(),
      faculty_assigned_text: facultyMembers.map((f) => f?.name).filter(Boolean).join(", "),
      faculty_members: facultyMembers.filter((f) => f?.name).map((f) => ({ name: f.name })),
      remarks: data.remarks?.trim() || undefined,
    });

    onBatchCreated();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      schema={createBatchSchema}
      title="Create New Batch Request"
      description="Complete all batch details below and submit the request for approval."
      submitLabel="Submit Batch Request"
      size="full"
      render={(form) => (
        <div className="space-y-form-lg p-4">
          {optionsError && (
            <p role="alert" className="text-sm text-destructive">
              {optionsError}
            </p>
          )}
          <section className="space-y-form">
            <SectionHeading title="Program & Client" />
            <div className="grid-form-2">
              <TextField
                name="batch_id"
                label="Batch Identifier / Code"
                placeholder="DEL_PYSPARK_2026_B1"
                required
                sanitize={normalizeCodeChars}
                helperText="Letters, numbers, hyphens, underscores, dots and colons only. Spaces are saved as underscores."
              />
              <TextField
                name="client_name"
                label="Client Account Name"
                placeholder="Deloitte USI, IBM, Capgemini"
                required
              />
              <TextField
                name="program_name"
                label="Curriculum / Program Title"
                placeholder="Enterprise Big Data & PySpark Bootcamp"
                required
                className="md:col-span-2"
              />
              <SelectField
                name="entity_id"
                label="Operating Entity"
                options={options.entities}
                required
                placeholder="Select operating entity"
              />
              <SelectField
                name="category_id"
                label="Training Category"
                options={options.categories}
                required
                placeholder="Select category"
              />
              <TextField
                name="domain"
                label="Technology Domain"
                placeholder="IT/ITES, Cloud & DevOps, Data Science"
                required
              />
              <TextField
                name="technology"
                label="Technology Stack & Modules"
                placeholder="PySpark, Databricks, Scala, Delta Lake"
                required
              />
            </div>
          </section>

          <section className="space-y-form section-divider">
            <SectionHeading title="Schedule & Delivery" />
            <ScheduleFields form={form} options={options} />
          </section>

          <section className="space-y-form section-divider">
            <SectionHeading title="Headcount & Faculty" />
            <NumberField
              name="total_enrollments"
              label="Total Candidate Headcount"
              min={1}
              required
              helperText="Total enrolled corporate students"
            />
            <ChipArrayField
              name="faculty_members"
              label="Proposed Faculty Members"
              placeholder="Dr. Srinivas Rao, Prof. Anita Sharma"
              addButtonLabel="Add Faculty"
              itemLabel={(item) => item.name}
              required
              helperText="At least one faculty member is required to submit the batch"
            />
            <div className="grid-form-3">
              <SelectField
                name="sales_spoc_id"
                label="Sales Account SPOC"
                options={assignableUsers.sales}
                placeholder="Select Sales SPOC"
                getOptionLabel={(u: User) => u.full_name}
                getOptionValue={(u: User) => u.id}
              />
              <SelectField
                name="coordinator_id"
                label="Operations Coordinator"
                options={assignableUsers.coordinators}
                placeholder="Select Coordinator"
                getOptionLabel={(u: User) => u.full_name}
                getOptionValue={(u: User) => u.id}
              />
              <SelectField
                name="primary_manager_id"
                label="Delivery Manager"
                options={assignableUsers.managers}
                placeholder="Select Manager"
                getOptionLabel={(u: User) => u.full_name}
                getOptionValue={(u: User) => u.id}
              />
            </div>
          </section>

          <section className="space-y-form section-divider">
            <SectionHeading title="Commercial & Review" />
            <div className="grid-form-2">
              <TextField
                name="sow_number"
                label="Client SOW / PO Number"
                placeholder="SOW-2026-DEL-089 or PO-98421"
                required
                helperText="Official client agreement, statement of work, or PO reference"
              />
              <TextAreaField
                name="remarks"
                label="Operational Remarks"
                placeholder="Special lab environment, weekend schedule..."
                rows={3}
              />
            </div>

            <PreFlightSummary options={options} assignableUsers={assignableUsers} form={form} />
          </section>
        </div>
      )}
    />
  );
};

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-0.5 bg-primary rounded-full" />
      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
        {title}
      </h3>
    </div>
  );
}

function ScheduleFields({
  form,
  options,
}: {
  form: any;
  options: { modes?: BatchOption[]; accommodations?: BatchOption[] };
}) {
  const deliveryModeId = form.watch("delivery_mode_id");
  const startDate = form.watch("start_date");
  const endDate = form.watch("end_date");
  const selectedMode = options.modes?.find((m) => m.id === deliveryModeId);
  const requiresLocation = ["F2F", "Blended"].includes(selectedMode?.name || "");

  const calendarDays = calendarDaysBetween(startDate, endDate);
  const showCalendarDays = !!startDate && !!endDate;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField
        name="delivery_mode_id"
        label="Delivery Mode"
        options={options.modes || []}
        required
        placeholder="Select delivery mode"
      />
      <TextField
        name="location_city"
        label="Training Venue / City"
        placeholder={requiresLocation ? "Bengaluru, Hyderabad Campus" : "Not applicable for Online"}
        disabled={!requiresLocation}
        required={requiresLocation}
        helperText={
          requiresLocation
            ? "Physical classroom delivery center"
            : "Online delivery requires no physical venue"
        }
      />
      <SelectField
        name="accommodation_id"
        label="Faculty Accommodation"
        options={options.accommodations || []}
        required
        className="md:col-span-2"
        placeholder="Select accommodation type"
      />
      <DateField name="start_date" label="Commencement Date" required />
      <DateField name="end_date" label="Conclusion Date" required min={startDate} />
      {showCalendarDays && (
        <p className="md:col-span-2 text-sm text-muted-foreground">
          Calendar days (inclusive of{" "}
          {startDate ? formatDate(startDate) : "—"} and {endDate ? formatDate(endDate) : "—"}):{" "}
          <strong className="text-foreground">{calendarDays}</strong>
        </p>
      )}
      <NumberField
        name="training_days"
        label="Active Training Days"
        min={0}
        required
        helperText="Suggests total hours (days x 8)"
      />
      <NumberField name="total_hours" label="Total Training Hours" min={0.5} step={0.5} required />
    </div>
  );
}

function PreFlightSummary({
  form,
  options,
  assignableUsers,
}: {
  form: any;
  options: {
    entities?: BatchOption[];
    categories?: BatchOption[];
    modes?: BatchOption[];
    accommodations?: BatchOption[];
  };
  assignableUsers: { sales?: User[]; coordinators?: User[]; managers?: User[] };
}) {
  const data = form.watch();
  const deliveryMode = options.modes?.find((m) => m.id === data.delivery_mode_id)?.name || "Online";
  const requiresLocation = ["F2F", "Blended"].includes(deliveryMode);
  const calendarDays = calendarDaysBetween(data.start_date, data.end_date);

  const facultyMembers: Array<{ name?: string }> = Array.isArray(data.faculty_members)
    ? data.faculty_members
    : [];

  const getEntityName = (id?: string) =>
    options.entities?.find((e: any) => e.id === id)?.name || "Not specified";
  const getCategoryName = (id?: string) =>
    options.categories?.find((c: any) => c.id === id)?.name || "Not specified";
  const getAccommodationName = (id?: string) =>
    options.accommodations?.find((a: any) => a.id === id)?.name || "Not specified";
  const getUserName = (users: User[] | undefined, id?: string) =>
    users?.find((u: User) => u.id === id)?.full_name || "Unassigned";

  return (
    <div className="panel panel-sm border-primary/20">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
          <div className="p-1 bg-primary/10 rounded-lg">
            <Info className="h-4 w-4 text-primary" />
          </div>
          Pre-Flight Submission Summary
        </h4>
        <span className="text-xs text-muted-foreground">Please review before submitting</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="border-l-2 border-primary pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Program & Client</p>
          <p className="font-semibold text-foreground">{data.batch_id || "-"}</p>
          <p className="text-sm text-muted-foreground">
            {data.client_name || "-"} - {data.program_name || "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getEntityName(data.entity_id)} | {getCategoryName(data.category_id)} | {data.domain || "-"}
          </p>
        </div>
        <div className="border-l-2 border-green-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Delivery & Logistics</p>
          <p className="font-semibold text-foreground">
            {deliveryMode} {requiresLocation && data.location_city ? `(${data.location_city})` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.start_date ? formatDate(data.start_date) : "-"} to{" "}
            {data.end_date ? formatDate(data.end_date) : "-"} ({calendarDays} Days)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Training: {data.training_days || 0} Days / {data.total_hours || 0} Hours | Faculty Acc:{" "}
            {getAccommodationName(data.accommodation_id)}
          </p>
        </div>
        <div className="border-l-2 border-purple-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Headcount & Faculty</p>
          <p className="font-semibold text-foreground">{data.total_enrollments || 0} Candidates</p>
          <p className="text-sm text-muted-foreground">
            Faculty: {facultyMembers.length > 0
              ? facultyMembers.map((f) => f?.name).filter(Boolean).join(", ")
              : "Unassigned"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Coord: {getUserName(assignableUsers.coordinators, data.coordinator_id)} | Mgr:{" "}
            {getUserName(assignableUsers.managers, data.primary_manager_id)}
          </p>
        </div>
        <div className="border-l-2 border-amber-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Commercial & Status</p>
          <p className="font-semibold text-foreground">SOW / PO: {data.sow_number || "-"}</p>
          <p className="text-sm text-muted-foreground">
            Initial Status: <strong className="text-amber-600">Requested</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sales: {getUserName(assignableUsers.sales, data.sales_spoc_id)}
          </p>
        </div>
      </div>
      <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-primary">Two-Level Approval &amp; Schedule Readiness:</strong>{" "}
          Creating this batch immediately sends it to{" "}
          <strong className="text-amber-600">Approval 1 Pending</strong> and assigns the configured
          Approver 1 and Approver 2. If rejected, the batch remains editable for correction.
        </div>
      </div>
    </div>
  );
}
