export type SecretAuditEvent = {
  action: "access" | "rotate" | "validate";
  secretRef: string;
  actor: string;
  timestamp: string;
};

const auditLog: SecretAuditEvent[] = [];

export function recordSecretAudit(
  action: SecretAuditEvent["action"],
  secretRef: string,
  actor: string,
): SecretAuditEvent {
  const event: SecretAuditEvent = {
    action,
    secretRef,
    actor,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(event);
  return event;
}

export function listSecretAuditEvents(): SecretAuditEvent[] {
  return [...auditLog];
}

export function clearSecretAudit(): void {
  auditLog.length = 0;
}
