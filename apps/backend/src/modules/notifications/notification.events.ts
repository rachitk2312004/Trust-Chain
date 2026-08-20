import { NotificationEventTypes } from "@trustchain/config";

export const SUPPORTED_NOTIFICATION_EVENTS = Object.values(NotificationEventTypes);

export type NotificationEventType =
  (typeof NotificationEventTypes)[keyof typeof NotificationEventTypes];

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  [NotificationEventTypes.invitationCreated]: "Invitation created",
  [NotificationEventTypes.invitationAccepted]: "Invitation accepted",
  [NotificationEventTypes.memberAdded]: "Member added",
  [NotificationEventTypes.documentUploaded]: "Document uploaded",
  [NotificationEventTypes.documentVerified]: "Document verified",
  [NotificationEventTypes.documentArchived]: "Document archived",
  [NotificationEventTypes.documentRestored]: "Document restored",
  [NotificationEventTypes.shareCreated]: "Share created",
  [NotificationEventTypes.qrCreated]: "QR created",
  [NotificationEventTypes.qrRevoked]: "QR revoked",
  [NotificationEventTypes.verificationCompleted]: "Verification completed",
  [NotificationEventTypes.certificateIssued]: "Certificate issued",
  [NotificationEventTypes.certificateRevoked]: "Certificate revoked",
  [NotificationEventTypes.signatureCreated]: "Signature created",
  [NotificationEventTypes.signatureRevoked]: "Signature revoked",
  [NotificationEventTypes.signatureVerified]: "Signature verified",
  [NotificationEventTypes.signatureWorkflowCreated]: "Signature workflow created",
  [NotificationEventTypes.signatureWorkflowApproved]: "Signature workflow approved",
  [NotificationEventTypes.signatureWorkflowRejected]: "Signature workflow rejected",
  [NotificationEventTypes.signatureWorkflowCancelled]: "Signature workflow cancelled",
  [NotificationEventTypes.signatureApprovalRequested]: "Signature approval requested",
  [NotificationEventTypes.tenantCreated]: "Tenant created",
  [NotificationEventTypes.tenantSuspended]: "Tenant suspended",
  [NotificationEventTypes.tenantRestored]: "Tenant restored",
  [NotificationEventTypes.tenantArchived]: "Tenant archived",
  [NotificationEventTypes.tenantTransferred]: "Tenant transferred",
  [NotificationEventTypes.policyCreated]: "Policy created",
  [NotificationEventTypes.policyUpdated]: "Policy updated",
  [NotificationEventTypes.policyDeleted]: "Policy deleted",
  [NotificationEventTypes.policyAssigned]: "Policy assigned",
  [NotificationEventTypes.policyEvaluated]: "Policy evaluated",
  [NotificationEventTypes.policyConflict]: "Policy conflict",
};

export function isSupportedNotificationEvent(value: string): value is NotificationEventType {
  return (SUPPORTED_NOTIFICATION_EVENTS as string[]).includes(value);
}
