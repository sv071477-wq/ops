// API Client for FastAPI backend

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const API_BASE = rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`;

export interface Team {
  id: string;
  name: string;
  department: string;
  description?: string | null;
  is_active: boolean;
  member_count?: number;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  system_role: "Admin" | "Manager" | "Coordinator" | "Sales" | "Faculty";
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "Admin" | "Manager" | "Coordinator" | "Sales" | "Faculty";
  role_id?: string | null;
  role_detail?: Role | null;
  team_id?: string | null;
  team_detail?: Team | null;
  team_name?: string | null;
  department?: string | null;
  manager_id?: string | null;
  manager_name?: string | null;
  is_manager?: boolean;
  direct_reports_count?: number;
  is_active: boolean;
  created_at: string;
}

export interface UserHierarchyNode {
  id: string;
  full_name: string;
  email: string;
  role: string;
  role_name?: string | null;
  team_name?: string | null;
  department?: string | null;
  manager_id?: string | null;
  direct_reports: UserHierarchyNode[];
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  password?: string;
  role?: string;
  role_id?: string;
  team_id?: string;
  manager_id?: string;
  is_active?: boolean;
}

export interface CreateRolePayload {
  name: string;
  system_role: string;
  is_active?: boolean;
}

export interface CreateTeamPayload {
  name: string;
  department?: string;
  description?: string;
  is_active?: boolean;
}

export interface CoordinatorMappingPayload {
  coordinator_id: string;
  manager_id: string;
}

export interface Batch {
  id: string;
  batch_id: string;
  sow_number?: string | null;
  approval_id?: string | null;
  entity_id?: string | null;
  category: string;
  residential_type: string;
  category_id?: string | null;
  delivery_mode_id?: string | null;
  accommodation_id?: string | null;
  program_name: string;
  technology?: string | null;
  domain?: string | null;
  client_name?: string | null;
  delivery_mode: string;
  location_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  batch_request_date?: string | null;
  training_days: number;
  calendar_days?: number | null;
  total_hours: number;
  total_enrollments: number;
  residential_enrollments: number;
  non_residential_enrollments: number;
  status: "Requested" | "Approval 1 Pending" | "Approval 2 Pending" | "Approved" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled" | "OnHold";
  is_schema_locked: boolean;
  approver_1_id?: string | null;
  approver_2_id?: string | null;
  approver_1_status?: "Pending" | "Approved" | "Rejected";
  approver_2_status?: "Pending" | "Approved" | "Rejected";
  approver_1_approved_at?: string | null;
  approver_2_approved_at?: string | null;
  primary_manager_id?: string | null;
  coordinator_id?: string | null;
  sales_spoc_id?: string | null;
  faculty_assigned_text?: string | null;
  finance_status: string;
  finance_status_check_date?: string | null;
  finance_check?: number | null;
  batch_avg_feedback?: number | null;
  total_feedback_score?: number | null;
  batch_nps?: number | null;
  retrospective_notes?: string | null;
  remarks?: string | null;
  comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchPayload {
  batch_id: string;
  sow_number?: string;
  approval_id?: string;
  entity_id?: string;
  category_id?: string;
  delivery_mode_id?: string;
  accommodation_id?: string;
  category?: string;
  residential_type?: string;
  program_name: string;
  technology?: string;
  domain?: string;
  client_name?: string;
  delivery_mode: string;
  location_city?: string;
  start_date?: string;
  end_date?: string;
  calendar_days?: number;
  training_days?: number;
  total_hours?: number;
  total_enrollments?: number;
  residential_enrollments?: number;
  non_residential_enrollments?: number;
  status?: string;
  faculty_assigned_text?: string;
  remarks?: string;
  comments?: string;
  finance_status?: string;
  finance_status_check_date?: string;
  finance_check?: number;
  sales_spoc_id?: string;
  coordinator_id?: string;
  primary_manager_id?: string;
}

export interface BatchOption {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchOptionPayload {
  name: string;
  description?: string;
}

export interface ApprovalConfiguration {
  id: string;
  approver_1_id?: string | null;
  approver_2_id?: string | null;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  batch_id: string;
  faculty_id?: string | null;
  faculty?: {
    id: string;
    full_name: string;
    email: string;
    domain?: string;
  } | null;
  date_of_training: string;
  start_time?: string | null;
  end_time?: string | null;
  topic: string;
  no_of_hours: number;
  venue?: string | null;
  location_city?: string | null;
  mode_of_delivery: string;
  status: "Scheduled" | "InProgress" | "Completed" | "Cancelled" | "Rescheduled";
  feedback_submitted: boolean;
  rating?: number | null;
  topic_feedback?: string | null;
  created_at: string;
}

export interface CreateSessionPayload {
  batch_id: string;
  date_of_training: string;
  start_time?: string;
  end_time?: string;
  topic: string;
  faculty_id?: string;
  faculty_name?: string;
  no_of_hours?: number;
  venue?: string;
  location_city?: string;
  mode_of_delivery?: string;
}

export interface SessionFeedbackPayload {
  rating: number; // 1.0 - 5.0
  topic_feedback?: string;
  total_students_present?: number;
}

export interface BatchNpsClosurePayload {
  nps_score: number; // 0 - 10
  average_feedback_score?: number; // 1.0 - 5.0
  retrospective_notes?: string;
}

// Analytics Types
export interface VerticalBreakdown {
  vertical: string;
  active_batches: number;
  total_hours: number;
  average_feedback: number;
}

export interface ManagerDashboardSummary {
  total_active_batches: number;
  total_ongoing_sessions: number;
  total_hours_delivered: number;
  overall_avg_nps?: number | null;
  overall_avg_feedback?: number | null;
  faculty_utilization_ratio: number;
  pending_gate1_feedbacks: number;
  pending_gate2_closures: number;
  vertical_distribution: VerticalBreakdown[];
}

// Schedules & Conflict Engine Types
export interface ScheduleValidationItem {
  date_of_training: string;
  no_of_hours: number;
  faculty_name?: string;
  topic?: string;
  mode_of_delivery?: string;
}

export interface ConflictDetail {
  conflict_type: string;
  date: string;
  faculty_name?: string;
  reason: string;
  existing_hours?: number;
  requested_hours?: number;
}

export interface ScheduleValidationResponse {
  is_valid: boolean;
  total_slots: number;
  valid_slots: number;
  conflict_count: number;
  conflicts: ConflictDetail[];
}

export interface ExtractedScheduleRow {
  date_of_training: string;
  topic: string;
  faculty_name?: string;
  no_of_hours: number;
  start_time?: string;
  end_time?: string;
  venue?: string;
  location_city?: string;
  mode_of_delivery?: string;
}

export interface ScheduleIngestResponse {
  batch_id?: string | null;
  source_filename: string;
  total_rows_parsed: number;
  extracted_schedule: ExtractedScheduleRow[];
}

// Faculty Types
export interface FacultyMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  faculty_type?: string;
  domain?: string;
  is_active: boolean;
}

export interface FacultyUtilizationSummary {
  total_faculty_count: number;
  active_deployed_faculty: number;
  overall_utilization_percentage: number;
  domain_breakdown: Array<{
    domain: string;
    faculty_count: number;
    hours_scheduled: number;
  }>;
}

// FMS Sync Types
export interface FmsSyncLog {
  id: string;
  faculty_id: string;
  event_type: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  response_code?: number | null;
  message?: string | null;
  timestamp: string;
}

class ApiService {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use default error message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Auth & Users APIs
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    return this.request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>("/auth/users");
  }

  async getAssignableUsers(role: "Sales" | "Coordinator" | "Manager"): Promise<User[]> {
    return this.request<User[]>(`/auth/users/assignable?role=${role}`);
  }

  async getHierarchy(): Promise<UserHierarchyNode[]> {
    return this.request<UserHierarchyNode[]>("/auth/hierarchy");
  }

  async createUser(payload: CreateUserPayload): Promise<User> {
    return this.request<User>("/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getCoordinators(): Promise<User[]> {
    return this.request<User[]>("/auth/users/coordinators");
  }

  async assignCoordinator(payload: CoordinatorMappingPayload): Promise<any> {
    return this.request<any>("/auth/users/coordinator-mapping", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getMyReports(): Promise<User[]> {
    return this.request<User[]>("/auth/my-reports");
  }

  // Roles APIs
  async getRoles(isActive?: boolean): Promise<Role[]> {
    const query = isActive !== undefined ? `?is_active=${isActive}` : "";
    return this.request<Role[]>(`/roles${query}`);
  }

  async createRole(payload: CreateRolePayload): Promise<Role> {
    return this.request<Role>("/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteRole(id: string): Promise<{ detail: string }> {
    return this.request<{ detail: string }>(`/roles/${id}`, {
      method: "DELETE",
    });
  }

  // Teams APIs
  async getTeams(department?: string, isActive?: boolean): Promise<Team[]> {
    const query = new URLSearchParams();
    if (department) query.append("department", department);
    if (isActive !== undefined) query.append("is_active", String(isActive));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<Team[]>(`/teams${qs}`);
  }

  async createTeam(payload: CreateTeamPayload): Promise<Team> {
    return this.request<Team>("/teams", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateTeam(id: string, payload: Partial<CreateTeamPayload>): Promise<Team> {
    return this.request<Team>(`/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteTeam(id: string): Promise<{ detail: string }> {
    return this.request<{ detail: string }>(`/teams/${id}`, {
      method: "DELETE",
    });
  }

  // Batches APIs
  async getBatches(params?: {
    status?: string;
    domain?: string;
    category?: string;
    client_name?: string;
    search?: string;
  }): Promise<Batch[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.append("status", params.status);
    if (params?.domain && params.domain !== "ALL") query.append("domain", params.domain);
    if (params?.category && params.category !== "ALL") query.append("category", params.category);
    if (params?.client_name) query.append("client_name", params.client_name);
    if (params?.search) query.append("search", params.search);

    const queryString = query.toString();
    const endpoint = queryString ? `/batches?${queryString}` : "/batches";
    return this.request<Batch[]>(endpoint);
  }

  async getBatch(id: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}`);
  }

  async createBatch(payload: CreateBatchPayload): Promise<Batch> {
    return this.request<Batch>("/batches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async submitBatch(id: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}/submit`, { method: "POST" });
  }

  async decideBatch(id: string, level: 1 | 2, decision: "approve" | "reject", reason?: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}/approve-level-${level}`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    });
  }

  async approveBatch(id: string, approvalId: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approval_id: approvalId }),
    });
  }

  async closeBatchGate2(id: string, payload: BatchNpsClosurePayload): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}/close`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Batch Options & Taxonomy APIs
  async getBatchOptions(type: "categories" | "delivery-modes" | "accommodations" | "entities" | string): Promise<BatchOption[]> {
    return this.request<BatchOption[]>(`/batch-options/${type}`);
  }

  async createBatchOption(type: string, payload: CreateBatchOptionPayload): Promise<BatchOption> {
    return this.request<BatchOption>(`/batch-options/${type}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateBatchOption(type: string, id: string, payload: CreateBatchOptionPayload): Promise<BatchOption> {
    return this.request<BatchOption>(`/batch-options/${type}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteBatchOption(type: string, id: string): Promise<{ detail: string }> {
    return this.request<{ detail: string }>(`/batch-options/${type}/${id}`, {
      method: "DELETE",
    });
  }

  async getApprovalConfiguration(): Promise<ApprovalConfiguration> {
    return this.request<ApprovalConfiguration>("/batches/approval-config");
  }

  async updateApprovalConfiguration(payload: { approver_1_id?: string; approver_2_id?: string }): Promise<ApprovalConfiguration> {
    return this.request<ApprovalConfiguration>("/batches/approval-config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // Sessions APIs
  async getSessions(params?: { batch_id?: string; faculty_name?: string; status?: string }): Promise<TrainingSession[]> {
    const query = new URLSearchParams();
    if (params?.batch_id) query.append("batch_id", params.batch_id);
    if (params?.faculty_name) query.append("faculty_name", params.faculty_name);
    if (params?.status) query.append("status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return this.request<TrainingSession[]>(`/sessions${suffix}`);
  }

  async createSession(payload: CreateSessionPayload): Promise<TrainingSession> {
    return this.request<TrainingSession>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateSession(id: string, payload: Partial<CreateSessionPayload> & { status?: string }): Promise<TrainingSession> {
    return this.request<TrainingSession>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async completeSessionGate1(sessionId: string, payload: SessionFeedbackPayload): Promise<any> {
    return this.request<any>(`/sessions/${sessionId}/complete`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Schedules Ingestion & Conflict Engine APIs
  async ingestScheduleFile(file: File, targetBatchId?: string): Promise<ScheduleIngestResponse> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);
    if (targetBatchId) {
      formData.append("target_batch_id", targetBatchId);
    }

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE}/schedules/ingest`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = `Ingestion error: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) errorMsg = errJson.detail;
      } catch {}
      throw new Error(errorMsg);
    }

    return response.json();
  }

  async validateScheduleSlots(items: ScheduleValidationItem[]): Promise<ScheduleValidationResponse> {
    return this.request<ScheduleValidationResponse>("/schedules/validate", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }

  // Analytics & MBR APIs
  async getManagerDashboard(): Promise<ManagerDashboardSummary> {
    return this.request<ManagerDashboardSummary>("/analytics/manager-dashboard");
  }

  async exportMbrReport(): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE}/analytics/mbr-export`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Export failed: ${res.statusText}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `MBR_Report_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Faculty APIs
  async getFacultyList(params?: { faculty_type?: string; domain?: string }): Promise<FacultyMember[]> {
    const query = new URLSearchParams();
    if (params?.faculty_type) query.append("faculty_type", params.faculty_type);
    if (params?.domain) query.append("domain", params.domain);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<FacultyMember[]>(`/faculty${qs}`);
  }

  async getFacultyUtilization(): Promise<FacultyUtilizationSummary> {
    return this.request<FacultyUtilizationSummary>("/faculty/utilization");
  }

  // FMS Sync APIs
  async syncFacultyFms(facultyId: string, eventType: string = "HOURS_UPDATE"): Promise<any> {
    const query = new URLSearchParams({
      faculty_id: facultyId,
      event_type: eventType,
    });
    return this.request<any>(`/integrations/fms/sync?${query.toString()}`, {
      method: "POST",
    });
  }

  async getFmsLogs(skip: number = 0, limit: number = 50): Promise<FmsSyncLog[]> {
    return this.request<FmsSyncLog[]>(`/integrations/fms/logs?skip=${skip}&limit=${limit}`);
  }
}

export const api = new ApiService();
