import { BaseAppError, getUserFriendlyMessage, getErrorSeverity, normalizeError, isAppError } from "./errors";

export async function createToastFromError(error: unknown, fallbackTitle = "Operation Failed") {
  const normalizedError = await normalizeError(error);
  
  const severity = getErrorSeverity(normalizedError);
  const message = getUserFriendlyMessage(normalizedError);
  
  const toast: Omit<import("./toast").Toast, "id"> = {
    type: severity === "error" ? "error" : severity === "warning" ? "warning" : "info",
    title: fallbackTitle,
    message,
    duration: severity === "error" ? 8000 : severity === "warning" ? 7000 : 5000,
  };
  
  if (normalizedError.isRetryable) {
    toast.action = {
      label: "Retry",
      onClick: () => {},
    };
  }
  
  return toast;
}

export async function logError(error: unknown, context?: Record<string, unknown>) {
  const normalizedError = await normalizeError(error, context);
  
  const logData = {
    message: normalizedError.message,
    code: normalizedError.code,
    status: normalizedError.status,
    timestamp: normalizedError.timestamp.toISOString(),
    stack: normalizedError.stack,
    context: normalizedError.context,
    details: normalizedError.details,
  };
  
  if (process.env.NODE_ENV === "development") {
    console.group(`🔴 [${normalizedError.code}] ${normalizedError.message}`);
    console.log("Timestamp:", logData.timestamp);
    console.log("Status:", logData.status);
    console.log("Context:", logData.context);
    console.log("Details:", logData.details);
    console.log("Stack:", logData.stack);
    console.groupEnd();
  } else {
    console.error(JSON.stringify(logData));
  }
  
  return normalizedError;
}

export async function handleAsyncError<T>(
  error: unknown,
  context?: Record<string, unknown>,
  fallbackTitle = "Operation Failed"
): Promise<{ error: BaseAppError; toast: Omit<import("./toast").Toast, "id"> }> {
  const normalizedError = await logError(error, context);
  const toast = await createToastFromError(normalizedError, fallbackTitle);
  return { error: normalizedError, toast };
}

export type { BaseAppError } from "./errors";
export { normalizeError, isAppError, getUserFriendlyMessage, getErrorSeverity } from "./errors";