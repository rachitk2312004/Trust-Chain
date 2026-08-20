import { parseApiError } from "./apiErrors";

export function isForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 403 || parsed.code === "FORBIDDEN";
}

export function isOrgNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 404 || parsed.code === "ORG_NOT_FOUND";
}

export function isDuplicateOrganization(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 409 || parsed.code === "SLUG_IN_USE";
}

export function isInvalidInvitation(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "INVALID_INVITATION" ||
    parsed.code === "INVITATION_EMAIL_MISMATCH" ||
    parsed.code === "USER_REQUIRED"
  );
}

export function getOrganizationErrorMessage(error: unknown): string {
  if (isInvalidInvitation(error)) {
    const code = parseApiError(error).code;
    if (code === "INVITATION_EMAIL_MISMATCH") {
      return "This invitation was sent to a different email address.";
    }
    if (code === "USER_REQUIRED") {
      return "Register with the invited email before accepting.";
    }
    return "This invitation is invalid or expired.";
  }
  if (isForbidden(error)) return "You do not have permission for this organization action.";
  if (isOrgNotFound(error)) return "Organization not found.";
  if (isDuplicateOrganization(error)) return "An organization with this slug already exists.";
  return parseApiError(error).message;
}

export function invitationStatus(invite: {
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}): "accepted" | "revoked" | "expired" | "pending" {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}
