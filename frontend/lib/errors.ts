export interface ApiErrorResponse {
  detail?: string | string[] | Record<string, unknown>;
  statusCode?: number;
  error?: string;
  message?: string;
}

export interface AppError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  isRetryable: boolean;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export class BaseAppError extends Error implements AppError {
  code: string;
  status?: number;
  details?: unknown;
  isRetryable: boolean;
  timestamp: Date;
  context?: Record<string, unknown>;

  constructor(message: string, code: string, options?: {
    status?: number;
    details?: unknown;
    isRetryable?: boolean;
    context?: Record<string, unknown>;
  }) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
    this.isRetryable = options?.isRetryable ?? false;
    this.timestamp = new Date();
    this.context = options?.context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NetworkError extends BaseAppError {
  constructor(message: string = "Network request failed", options?: {
    status?: number;
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "NETWORK_ERROR", {
      ...options,
      isRetryable: true,
    });
  }
}

export class AuthError extends BaseAppError {
  constructor(message: string = "Authentication failed", options?: {
    status?: number;
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "AUTH_ERROR", {
      ...options,
      isRetryable: options?.status === 401,
    });
  }
}

export class ValidationError extends BaseAppError {
  constructor(message: string = "Validation failed", options?: {
    status?: number;
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "VALIDATION_ERROR", {
      ...options,
      status: options?.status ?? 400,
      isRetryable: false,
    });
  }
}

export class NotFoundError extends BaseAppError {
  constructor(message: string = "Resource not found", options?: {
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "NOT_FOUND", {
      ...options,
      status: 404,
      isRetryable: false,
    });
  }
}

export class ForbiddenError extends BaseAppError {
  constructor(message: string = "Access denied", options?: {
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "FORBIDDEN", {
      ...options,
      status: 403,
      isRetryable: false,
    });
  }
}

export class ServerError extends BaseAppError {
  constructor(message: string = "Server error occurred", options?: {
    status?: number;
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "SERVER_ERROR", {
      ...options,
      status: options?.status ?? 500,
      isRetryable: true,
    });
  }
}

export class TimeoutError extends BaseAppError {
  constructor(message: string = "Request timed out", options?: {
    details?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(message, "TIMEOUT_ERROR", {
      ...options,
      isRetryable: true,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof BaseAppError;
}

export async function normalizeError(error: unknown, context?: Record<string, unknown>): Promise<AppError> {
  if (isAppError(error)) {
    return { ...error, context: { ...error.context, ...context } };
  }

  if (error instanceof Response) {
    return createErrorFromResponse(error, context);
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError("Network connection failed", { context });
  }

  if (error instanceof Error) {
    return new BaseAppError(error.message, "UNKNOWN_ERROR", {
      details: error.stack,
      context,
    });
  }

  return new BaseAppError(String(error), "UNKNOWN_ERROR", { context });
}

async function createErrorFromResponse(response: Response, context?: Record<string, unknown>): Promise<AppError> {
  let detail: unknown;
  try {
    const data = await response.json();
    detail = data;
  } catch {
    detail = response.statusText;
  }

  const message = extractErrorMessage(detail);
  const status = response.status;

  switch (status) {
    case 400:
      return new ValidationError(message, { status, details: detail, context });
    case 401:
      return new AuthError(message, { status, details: detail, context });
    case 403:
      return new ForbiddenError(message, { details: detail, context });
    case 404:
      return new NotFoundError(message, { details: detail, context });
    case 408:
    case 504:
      return new TimeoutError(message, { details: detail, context });
    case 500:
    case 502:
    case 503:
      return new ServerError(message, { status, details: detail, context });
    default:
      return new BaseAppError(message, `HTTP_${status}`, { status, details: detail, context });
  }
}

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.join(", ");
  if (detail && typeof detail === "object") {
    if ("detail" in detail && typeof (detail as Record<string, unknown>).detail === "string") {
      return (detail as Record<string, unknown>).detail as string;
    }
    if ("message" in detail && typeof (detail as Record<string, unknown>).message === "string") {
      return (detail as Record<string, unknown>).message as string;
    }
    if ("error" in detail && typeof (detail as Record<string, unknown>).error === "string") {
      return (detail as Record<string, unknown>).error as string;
    }
    return JSON.stringify(detail);
  }
  return "An unknown error occurred";
}

export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case "NETWORK_ERROR":
      return "Unable to connect to the server. Please check your internet connection and try again.";
    case "AUTH_ERROR":
      if (error.status === 401) {
        return "Your session has expired. Please sign in again.";
      }
      return "Authentication failed. Please verify your credentials.";
    case "FORBIDDEN":
      return "You don't have permission to perform this action.";
    case "NOT_FOUND":
      return "The requested resource was not found.";
    case "VALIDATION_ERROR":
      return error.message;
    case "SERVER_ERROR":
      return "A server error occurred. Please try again later or contact support.";
    case "TIMEOUT_ERROR":
      return "The request timed out. Please try again.";
    default:
      return error.message || "An unexpected error occurred. Please try again.";
  }
}

export function getErrorSeverity(error: AppError): "error" | "warning" | "info" {
  if (error.code === "VALIDATION_ERROR" || error.code === "NOT_FOUND") {
    return "warning";
  }
  if (error.isRetryable) {
    return "warning";
  }
  return "error";
}