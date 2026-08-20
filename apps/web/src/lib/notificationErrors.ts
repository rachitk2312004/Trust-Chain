import { getApiErrorMessage, parseApiError } from "./apiErrors";

export function getNotificationErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  switch (parsed?.code) {
    case "UNAUTHORIZED":
      return "Sign in to view notifications.";
    case "FORBIDDEN":
      return "You do not have access to these notifications.";
    case "NOTIFICATION_NOT_FOUND":
      return "Notification not found.";
    case "INVALID_PREFERENCES":
      return parsed.message || "Invalid notification preferences.";
    case "VALIDATION_ERROR":
      return "Invalid notification request.";
    default:
      return getApiErrorMessage(error);
  }
}

export function isNotificationNotFound(error: unknown): boolean {
  return parseApiError(error)?.code === "NOTIFICATION_NOT_FOUND";
}
