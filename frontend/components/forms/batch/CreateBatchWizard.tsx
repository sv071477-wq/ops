"use client";

import React, { useEffect, useState } from "react";
import { api, BatchOption, User } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";
import { Building, Calendar, Users, ShieldCheck, GraduationCap, Plus, X, ChevronLeft, ChevronRight, Check, Info } from "lucide-react";
import { WizardModal } from "@/components/forms/modal/WizardModal";
import type { StepConfig } from "@/components/forms/modal/WizardModal";
import { 
  createBatchSchema, 
  programClientSchema, 
  scheduleDeliverySchema, 
  headcountFacultySchema, 
  commercialReviewSchema,
  type CreateBatchInput 
} from "@/lib/validation/schemas";
import { 
  TextField, 
  SelectField, 
  DateField, 
  NumberField, 
  TextAreaField,
  ChipArrayField 
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [assignableUsers, setAssignableUsers] = useState<Record<string, User[]>>({
    sales: [],
    coordinators: [],
    managers: [],
  });

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      api.getBatchOptions("entities"),
      api.getBatchOptions("categories"),
      api.getBatchOptions("delivery-modes"),
      api.getBatchOptions("accommodations"),
      api.getAssignableUsers("Sales"),
      api.getAssignableUsers("Coordinator"),
      api.getAssignableUsers("Manager"),
    ]).then(([entities, categories, modes, accommodations, sales, coordinators, managers]) => {
      setOptions({ entities, categories, modes, accommodations });
      setAssignableUsers({ sales, coordinators, managers });
    }).catch((err) => console.error("Failed to load options:", err));
  }, [isOpen]);

  const steps: StepConfig[] = [
    {
      name: "programClient",
      title: "Program & Client",
      icon: <Building className="h-4 w-4" />,
      schema: programClientSchema,
      render: (form: any) => (
        <div className="grid gap-6 md:grid-cols-2">
          <TextField name="batch_id" label="Batch Identifier / Code" placeholder="DEL_PYSPARK_2026_B1" required helperText="Unique client batch code (e.g. CLIENT_TECH_YEAR_B#)" />
          <TextField name="client_name" label="Client Account Name" placeholder="Deloitte USI, IBM, Capgemini" required />
          <TextField name="program_name" label="Curriculum / Program Title" placeholder="Enterprise Big Data & PySpark Bootcamp" required className="md:col-span-2" />
          <SelectField name="entity_id" label="Operating Entity" options={options.entities} required placeholder="Select operating entity" />
          <SelectField name="category_id" label="Training Category" options={options.categories} required placeholder="Select category" />
          <TextField name="domain" label="Technology Domain" placeholder="IT/ITES, Cloud & DevOps, Data Science" required />
          <TextField name="technology" label="Technology Stack & Modules" placeholder="PySpark, Databricks, Scala, Delta Lake" required />
        </div>
      ),
    },
    {
      name: "scheduleDelivery",
      title: "Schedule & Delivery",
      icon: <Calendar className="h-4 w-4" />,
      schema: scheduleDeliverySchema,
      render: (form: any) => {
        const deliveryMode = form.watch("delivery_mode_id");
        const selectedMode = options.modes?.find(m => m.id === deliveryMode);
        const requiresLocation = ["F2F", "Blended"].includes(selectedMode?.name || "");
        return (
          <div className="grid gap-6 md:grid-cols-2">
            <SelectField 
              name="delivery_mode_id" 
              label="Delivery Mode" 
              options={options.modes} 
              required 
            />
            <TextField
              name="location_city"
              label="Training Venue / City"
              placeholder={requiresLocation ? "Bengaluru, Hyderabad Campus" : "Not applicable for Online"}
              disabled={!requiresLocation}
              required={requiresLocation}
              helperText={requiresLocation ? "Physical classroom delivery center" : "Online delivery requires no physical venue"}
            />
            <SelectField name="accommodation_id" label="Faculty Accommodation" options={options.accommodations} required className="md:col-span-2" />
            <DateField name="start_date" label="Commencement Date" required />
            <DateField name="end_date" label="Conclusion Date" required min={form.watch("start_date")} />
            <NumberField name="training_days" label="Active Training Days" min={0} required helperText="Suggests total hours (days × 8)" />
            <NumberField name="total_hours" label="Total Training Hours" min={0.5} step={0.5} required />
          </div>
        );
      },
    },
    {
      name: "headcountFaculty",
      title: "Headcount & Faculty",
      icon: <Users className="h-4 w-4" />,
      schema: headcountFacultySchema,
      render: (form: any) => (
        <div className="space-y-6">
          <NumberField name="total_enrollments" label="Total Candidate Headcount" min={1} required helperText="Total enrolled corporate students" />
          
          <ChipArrayField
            name="faculty_members"
            label="Proposed Faculty Members"
            placeholder="Dr. Srinivas Rao, Prof. Anita Sharma"
            addButtonLabel="Add Faculty"
            itemIcon={<GraduationCap className="h-3.5 w-3.5" />}
            itemLabel={(item) => item.name}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <SelectField 
              name="sales_spoc_id" 
              label="Sales Account SPOC" 
              options={assignableUsers.sales} 
              placeholder="Select Sales SPOC"
              getOptionLabel={(u) => u.full_name}
              getOptionValue={(u) => u.id}
            />
            <SelectField 
              name="coordinator_id" 
              label="Operations Coordinator" 
              options={assignableUsers.coordinators} 
              placeholder="Select Coordinator"
              getOptionLabel={(u) => u.full_name}
              getOptionValue={(u) => u.id}
            />
            <SelectField 
              name="primary_manager_id" 
              label="Delivery Manager" 
              options={assignableUsers.managers} 
              placeholder="Select Manager"
              getOptionLabel={(u) => u.full_name}
              getOptionValue={(u) => u.id}
            />
          </div>
        </div>
      ),
    },
    {
      name: "commercialReview",
      title: "Review & SOW / PO",
      icon: <ShieldCheck className="h-4 w-4" />,
      schema: commercialReviewSchema,
      render: (form: any) => (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="sow_number" label="Client SOW / PO Number" placeholder="SOW-2026-DEL-089 or PO-98421" required helperText="Official client agreement, statement of work, or PO reference" />
            <TextAreaField name="remarks" label="Operational Remarks" placeholder="Special lab environment, weekend schedule..." rows={3} />
          </div>

          {/* Pre-flight Summary */}
          <PreFlightSummary form={form} options={options} assignableUsers={assignableUsers} />
        </div>
      ),
    },
  ];

  const handleSubmit = async (data: CreateBatchInput) => {
    const payload: any = {
      ...data,
      batch_id: data.batch_id.trim().toUpperCase(),
      program_name: data.program_name.trim(),
      client_name: data.client_name?.trim(),
      domain: data.domain?.trim(),
      technology: data.technology?.trim(),
      sow_number: data.sow_number?.trim(),
      remarks: data.remarks?.trim(),
      faculty_assigned_text: data.faculty_members.map(f => f.name).join(", "),
      total_enrollments: Number(data.total_enrollments),
      residential_enrollments: 0,
      non_residential_enrollments: Number(data.total_enrollments),
      training_days: Number(data.training_days),
      total_hours: Number(data.total_hours),
      calendar_days: data.start_date && data.end_date 
        ? Math.max(0, Math.round((new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000))
        : 0,
      start_date: data.start_date ? new Date(data.start_date).toISOString() : undefined,
      end_date: data.end_date ? new Date(data.end_date).toISOString() : undefined,
      delivery_mode: options.modes?.find(m => m.id === data.delivery_mode_id)?.name || "Online",
      location_city: data.location_city?.trim(),
    };

    await api.createBatch(payload);
    onBatchCreated();
  };

  return (
    <WizardModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      schema={createBatchSchema}
      steps={steps}
      title="Create New Batch Request"
      submitLabel="Submit Batch Request"
      size="full"
    />
  );
};

// Pre-flight Summary Component
function PreFlightSummary({ form, options, assignableUsers }: { form: any; options: { entities?: BatchOption[]; categories?: BatchOption[]; modes?: BatchOption[]; accommodations?: BatchOption[] }; assignableUsers: { sales?: User[]; coordinators?: User[]; managers?: User[] } }) {
  const data = form.getValues();
  const deliveryMode = options.modes?.find(m => m.id === data.delivery_mode_id)?.name || "Online";
  const requiresLocation = ["F2F", "Blended"].includes(deliveryMode);
  const calendarDays = data.start_date && data.end_date
    ? Math.max(0, Math.round((new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000))
    : 0;

  const getEntityName = (id?: string) => options.entities?.find((e: any) => e.id === id)?.name || "Not specified";
  const getCategoryName = (id?: string) => options.categories?.find((c: any) => c.id === id)?.name || data.category || "Not specified";
  const getAccommodationName = (id?: string) => options.accommodations?.find((a: any) => a.id === id)?.name || "Not specified";
  const getUserName = (users: User[] | undefined, id?: string) => users?.find((u: User) => u.id === id)?.full_name || "Unassigned";

  return (
    <div className="bg-muted/50 border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">Pre-Flight Submission Summary</h4>
        <span className="text-xs text-muted-foreground">Please review before submitting</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="border-l-2 border-primary pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Program & Client</p>
          <p className="font-semibold text-foreground">{data.batch_id}</p>
          <p className="text-sm text-muted-foreground">{data.client_name} — {data.program_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {getEntityName(data.entity_id)} • {getCategoryName(data.category_id)} • {data.domain}
          </p>
        </div>
        <div className="border-l-2 border-green-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Delivery & Logistics</p>
          <p className="font-semibold text-foreground">
            {deliveryMode} {requiresLocation ? `(${data.location_city})` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(data.start_date)} to {formatDate(data.end_date)} ({calendarDays} Days)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Training: {data.training_days} Days / {data.total_hours} Hours • Faculty Acc: {getAccommodationName(data.accommodation_id)}
          </p>
        </div>
        <div className="border-l-2 border-purple-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Headcount & Faculty</p>
          <p className="font-semibold text-foreground">{data.total_enrollments} Candidates</p>
          <p className="text-sm text-muted-foreground">
            Faculty: {data.faculty_members.length > 0 ? data.faculty_members.map((f: any) => f.name).join(", ") : "Unassigned"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Coord: {getUserName(assignableUsers.coordinators, data.coordinator_id)} • Mgr: {getUserName(assignableUsers.managers, data.primary_manager_id)}
          </p>
        </div>
        <div className="border-l-2 border-amber-500 pl-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Commercial & Status</p>
          <p className="font-semibold text-foreground">SOW / PO: {data.sow_number}</p>
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
          <strong className="text-primary">Two-Level Approval & Schedule Readiness:</strong>
          {" "}Creating this batch immediately sends it to <strong className="text-amber-600">Approval 1 Pending</strong> and assigns the configured Approver 1 and Approver 2. If rejected, the batch remains editable for correction.
        </div>
      </div>
    </div>
  );
}