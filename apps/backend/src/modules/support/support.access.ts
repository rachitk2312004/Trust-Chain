import type { RoleBindingView } from "../auth/rbac.repository.js";
import { RoleKeys } from "@trustchain/config";
import {
  ALLOWED_BUG_IMAGE_TYPES,
  BugStatuses,
  InquiryStatuses,
  MAX_BUG_IMAGE_BYTES,
} from "./support.schemas.js";
import { AppError } from "../../lib/errors.js";

export function isSuperAdminBindings(bindings: RoleBindingView[]): boolean {
  return bindings.some((binding) => binding.roleKey === RoleKeys.superAdmin);
}

export function orgAdminOrganizationIds(bindings: RoleBindingView[]): string[] {
  return bindings
    .filter((binding) => binding.roleKey === RoleKeys.orgAdmin && binding.organizationId)
    .map((binding) => binding.organizationId as string);
}

export function canUseInquiries(bindings: RoleBindingView[]): boolean {
  return isSuperAdminBindings(bindings) || orgAdminOrganizationIds(bindings).length > 0;
}

export function canCreateInquiry(bindings: RoleBindingView[]): boolean {
  return !isSuperAdminBindings(bindings) && orgAdminOrganizationIds(bindings).length > 0;
}

export function canAccessInquiry(
  bindings: RoleBindingView[],
  inquiry: { createdById: string; organizationId: string | null },
  actorId: string,
): boolean {
  if (isSuperAdminBindings(bindings)) return true;
  const orgIds = orgAdminOrganizationIds(bindings);
  if (inquiry.organizationId && orgIds.includes(inquiry.organizationId)) return true;
  return inquiry.createdById === actorId && orgIds.length > 0;
}

export function nextInquiryStatusAfterMessage(
  actorIsSuperAdmin: boolean,
  currentStatus: string,
): string {
  if (currentStatus === InquiryStatuses.closed) {
    return actorIsSuperAdmin ? InquiryStatuses.answered : InquiryStatuses.open;
  }
  return actorIsSuperAdmin ? InquiryStatuses.answered : InquiryStatuses.open;
}

export function canCreateBug(bindings: RoleBindingView[]): boolean {
  return !isSuperAdminBindings(bindings);
}

export function canAccessBug(
  bindings: RoleBindingView[],
  reporterId: string,
  actorId: string,
): boolean {
  return isSuperAdminBindings(bindings) || reporterId === actorId;
}

export function canRespondToBug(bindings: RoleBindingView[]): boolean {
  return isSuperAdminBindings(bindings);
}

export function isOpenBugStatus(status: string): boolean {
  return (
    status === BugStatuses.open ||
    status === BugStatuses.acknowledged ||
    status === BugStatuses.inProgress
  );
}

export function decodeImagePayload(imageBase64: string, imageContentType: string): Buffer {
  if (!ALLOWED_BUG_IMAGE_TYPES.includes(imageContentType as (typeof ALLOWED_BUG_IMAGE_TYPES)[number])) {
    throw new AppError(400, "INVALID_IMAGE_TYPE", "Screenshot must be PNG, JPEG, WebP, or GIF.");
  }
  const stripped = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(stripped)) {
    throw new AppError(400, "INVALID_IMAGE", "Screenshot is not valid base64.");
  }
  const body = Buffer.from(stripped, "base64");
  if (!body.length) {
    throw new AppError(400, "INVALID_IMAGE", "Screenshot is empty.");
  }
  if (body.length > MAX_BUG_IMAGE_BYTES) {
    throw new AppError(400, "IMAGE_TOO_LARGE", "Screenshot must be 2 MB or smaller.");
  }
  return body;
}

export function imageExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}
