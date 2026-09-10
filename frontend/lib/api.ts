// API Client for FastAPI backend

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const API_BASE = rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`;

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
  manager_id?: string | null;
  direct_reports: UserHierarchyNode[];
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  password: string;
  role?: string;
  role_id?: string;
  manager_id?: string;
  is_active?: boolean;
}

export interface CreateRolePayload {
  name: string;
  system_role: string;
  is_active?: boolean;
}

export interface CoordinatorMappingPayload {
  coordinator_id: string;
  manager_id: string;
}

export interface Batch {
  id: string;
  batch_id: string;
  approval_id?: string | null;
  category: string;
  residential_type: string;
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
  status: "Requested" | "Approved" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled" | "OnHold";
  is_schema_locked: boolean;
  primary_manager_id?: string | null;
  coordinator_id?: string | null;
  sales_spoc_id?: string | null;
  faculty_assigned_text?: string | null;
  finance_status: string;
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
  approval_id?: string;
  category: string;
  residential_type?: string;
  program_name: string;
  technology?: string;
  domain?: string;
  client_name?: string;
  delivery_mode: string;
  location_city?: string;
  start_date?: string;
  end_date?: string;
  training_days?: number;
  total_hours?: number;
  total_enrollments?: number;
  residential_enrollments?: number;
  non_residential_enrollments?: number;
  status?: string;
  faculty_assigned_text?: string;
  remarks?: string;
  comments?: string;
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

  async approveBatch(id: string, approvalId: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approval_id: approvalId }),
    });
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch> {
    return this.request<Batch>(`/batches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }
}

export const api = new ApiService();
