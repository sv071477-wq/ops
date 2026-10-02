import { z } from "zod";

// ─────────────────────────────────────────────
// Primitive reusable validators
// ─────────────────────────────────────────────
const nonEmptyString = z.string().min(1, "Required");
const optionalString = z.string().optional().nullable();
const positiveInt = z.coerce.number().int().min(0);
const positiveIntRequired = z.coerce.number().int().min(1, "Must be ≥ 1");
const emailSchema = z.string().email("Invalid email").optional().nullable();

// ─────────────────────────────────────────────
// Identifier / reference-code charset
// Letters, numbers, hyphens, underscores, dots and colons only. Shared so the
// zod rule and the live input filter in the form can never drift apart.
// ─────────────────────────────────────────────
export const CODE_CHARSET_MESSAGE = "Only letters, numbers, hyphens, underscores, dots, colons";
export const CODE_CHARSET_REGEX = /^[A-Za-z0-9_\-.:]+$/;
const NON_CODE_CHARS = /[^A-Za-z0-9_\-.:]/g;

/**
 * Normalizes typed/pasted text into the allowed set, live:
 *  - leading whitespace is dropped
 *  - a whitespace run becomes a single underscore, so
 *    "DLTE_AI Strategist _Sep26_B29" reads as "DLTE_AI_Strategist_Sep26_B29"
 *  - every other unsupported character is removed
 *  - underscore runs are collapsed so the above never doubles up
 * Trailing whitespace is deliberately turned into an underscore rather than
 * dropped, so a space typed mid-entry still becomes the separator once the
 * next character arrives. The zod rule and the submit handler trim the
 * final value.
 */
export const normalizeCodeChars = (value: string): string =>
  value
    .replace(/^\s+/, "")
    .replace(/\s+/g, "_")
    .replace(NON_CODE_CHARS, "")
    .replace(/_{2,}/g, "_");

/** Trims, then enforces the code charset. */
export const codeStringSchema = (min: number, max: number, messages?: { min?: string; max?: string }) =>
  z
    .string()
    .trim()
    .min(min, messages?.min ?? `Must be at least ${min} characters`)
    .max(max, messages?.max ?? `Must be at most ${max} characters`)
    .regex(CODE_CHARSET_REGEX, CODE_CHARSET_MESSAGE);

// Batch ID format: CLIENT_TECH_YEAR_BATCHNUM
const batchIdSchema = codeStringSchema(3, 50, { min: "Too short", max: "Too long" });

// Today's date at midnight for validation
const today = new Date();
today.setHours(0, 0, 0, 0);

// ─────────────────────────────────────────────
// Step 1: Program & Client
// ─────────────────────────────────────────────
export const programClientSchema = z.object({
  batch_id: batchIdSchema,
  client_name: nonEmptyString,
  program_name: nonEmptyString.min(3, "Program title too short"),
  entity_id: nonEmptyString,
  category_id: nonEmptyString,
  domain: nonEmptyString.min(2, "Domain required"),
  technology: nonEmptyString.min(2, "Technology stack required"),
});

// ─────────────────────────────────────────────
// Step 2: Schedule & Delivery
// ─────────────────────────────────────────────
export const scheduleDeliverySchema = z.object({
  delivery_mode_id: nonEmptyString,
  location_city: z.string().optional(),
  accommodation_id: nonEmptyString,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  training_days: positiveInt,
  total_hours: z.coerce.number().min(0.5, "Hours must be ≥ 0.5"),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: "End date must be after start date", path: ["end_date"] }
).refine(
  (data) => new Date(data.start_date) >= today,
  { message: "Start date cannot be in the past", path: ["start_date"] }
);

// ─────────────────────────────────────────────
// Step 3: Headcount & Faculty
// ─────────────────────────────────────────────
export const facultyChipSchema = z.object({
  name: z.string().min(1).max(100),
});

export const headcountFacultySchema = z.object({
  total_enrollments: positiveIntRequired,
  faculty_members: z.array(facultyChipSchema).min(1, "At least one faculty required"),
  sales_spoc_id: nonEmptyString,
  coordinator_id: nonEmptyString,
  primary_manager_id: nonEmptyString,
});

// ─────────────────────────────────────────────
// Step 4: Commercial & Review
// ─────────────────────────────────────────────
export const commercialReviewSchema = z.object({
  sow_number: nonEmptyString,
  remarks: z.string().max(2000).optional().nullable(),
});

// ─────────────────────────────────────────────
// Full Create Batch Schema (composed)
// ─────────────────────────────────────────────
export const createBatchSchema = z.object({
  // Step 1: Program & Client
  batch_id: batchIdSchema,
  client_name: nonEmptyString,
  program_name: nonEmptyString.min(3, "Program title too short"),
  entity_id: nonEmptyString,
  category_id: nonEmptyString,
  domain: nonEmptyString.min(2, "Domain required"),
  technology: nonEmptyString.min(2, "Technology stack required"),
  
  // Step 2: Schedule & Delivery
  delivery_mode_id: nonEmptyString,
  location_city: z.string().optional(),
  accommodation_id: nonEmptyString,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  training_days: positiveIntRequired,
  total_hours: z.coerce.number().min(0.5, "Hours must be ≥ 0.5"),
  
  // Step 3: Headcount & Faculty
  total_enrollments: positiveIntRequired,
  faculty_members: z.array(facultyChipSchema).min(1, "At least one faculty required"),
  sales_spoc_id: nonEmptyString,
  coordinator_id: nonEmptyString,
  primary_manager_id: nonEmptyString,
  
  // Step 4: Commercial & Review
  sow_number: nonEmptyString,
  remarks: z.string().max(2000).optional().nullable(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: "End date must be after start date", path: ["end_date"] }
).refine(
  (data) => new Date(data.start_date) >= today,
  { message: "Start date cannot be in the past", path: ["start_date"] }
);

// ─────────────────────────────────────────────
// Other Form Schemas
// ─────────────────────────────────────────────
export const approveBatchSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reject_reason: z.string().min(3, "Reason required (min 3 chars)").optional(),
}).refine(
  (data) => data.decision === "approve" || (data.reject_reason?.length ?? 0) >= 3,
  { message: "Rejection reason required", path: ["reject_reason"] }
);

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password required").optional(),
  new_password: z.string().min(8, "Min 8 characters").max(128),
  confirm_password: z.string(),
}).refine(
  (data) => data.new_password === data.confirm_password,
  { message: "Passwords must match", path: ["confirm_password"] }
);

// ─────────────────────────────────────────────
// Edit Batch Schema (for BatchDetailDrawer)
// ─────────────────────────────────────────────
export const editBatchSchema = z.object({
  program_name: nonEmptyString.min(3),
  client_name: nonEmptyString,
  sow_number: optionalString,
  domain: optionalString,
  technology: optionalString,
  delivery_mode_id: optionalString,
  location_city: optionalString,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  training_days: positiveInt,
  total_hours: z.coerce.number().min(0.5),
  total_enrollments: positiveIntRequired,
  faculty_assigned_text: optionalString,
  remarks: optionalString,
});

// ─────────────────────────────────────────────
// Lifecycle Status Schema
// ─────────────────────────────────────────────
export const lifecycleStatusSchema = z.object({
  status: z.enum(["OnHold", "Cancelled", "Resume", "Upcoming", "Ongoing", "Approved", "Pending for Closure", "Completed"]),
  reason: z.string().min(3, "Reason required (min 3 chars)"),
});

// ─────────────────────────────────────────────
// Session Logging Schema (Faculty Utilization)
// ─────────────────────────────────────────────
export const logUtilizationSchema = z.object({
  training_session_id: z.string().uuid().optional(),
  faculty_name: nonEmptyString,
  date_of_training: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time (HH:MM)"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time (HH:MM)"),
  topic: nonEmptyString,
  no_of_hours: z.coerce.number().min(0.5).max(24),
  venue: optionalString,
  location_city: optionalString,
  mode_of_delivery: z.enum(["Online", "F2F", "Blended", "Hybrid"]),
  status: z.enum(["Completed", "Cancelled", "Not Conducted", "Scheduled", "InProgress", "Rescheduled"]),
  feedback_submitted: z.boolean().default(false),
  feedback_rating: z.coerce.number().min(1).max(5).optional().nullable(),
  feedback_notes: optionalString,
  vertical: optionalString,
  program_type_id: optionalString,
  outcome_reason: optionalString,
}).refine(
  (data) => data.status !== "Cancelled" && data.status !== "Not Conducted" || (data.outcome_reason?.length ?? 0) >= 3,
  { message: "Outcome reason required when cancelled/not conducted", path: ["outcome_reason"] }
).refine(
  (data) => data.status !== "Completed" || !!data.training_session_id,
  { message: "Training session ID is required when status is Completed", path: ["training_session_id"] }
);

// ─────────────────────────────────────────────
// Scheduled Session Schema
// ─────────────────────────────────────────────
export const scheduledSessionSchema = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time (HH:MM)").optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time (HH:MM)").optional(),
  duration_hours: z.coerce.number().min(0.5).max(24),
  module: nonEmptyString,
  trainer_name: optionalString,
});

// ─────────────────────────────────────────────
// Gate 1 Feedback Schema
// ─────────────────────────────────────────────
export const gate1Schema = z.object({
  rating: z.coerce.number().min(1).max(5),
  topic_feedback: z.string().min(3, "Min 3 characters"),
  total_students_present: positiveIntRequired,
});

// ─────────────────────────────────────────────
// Gate 2 Closure Schema
// ─────────────────────────────────────────────
export const gate2Schema = z.object({
  nps_score: z.coerce.number().min(-100).max(100),
  average_feedback_score: z.coerce.number().min(1).max(5),
  retrospective_notes: optionalString,
});

// Type exports - exact match to API payloads
export type ProgramClientInput = z.infer<typeof programClientSchema>;
export type ScheduleDeliveryInput = z.infer<typeof scheduleDeliverySchema>;
export type HeadcountFacultyInput = z.infer<typeof headcountFacultySchema>;
export type CommercialReviewInput = z.infer<typeof commercialReviewSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type ApproveBatchInput = z.infer<typeof approveBatchSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EditBatchInput = z.infer<typeof editBatchSchema>;
export type LifecycleStatusInput = z.infer<typeof lifecycleStatusSchema>;
export type LogUtilizationInput = z.infer<typeof logUtilizationSchema>;
export type ScheduledSessionInput = z.infer<typeof scheduledSessionSchema>;
export type Gate1Input = z.infer<typeof gate1Schema>;
export type Gate2Input = z.infer<typeof gate2Schema>;