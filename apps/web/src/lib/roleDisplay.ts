const ROLE_LABELS: Record<string, string> = {
  org_admin: "Organization admin",
  employee: "Employee",
  public_user: "Certificate holder",
  super_admin: "Super admin",
};

export function roleDisplayLabel(roleKey: string): string {
  return ROLE_LABELS[roleKey] ?? roleKey.replace(/_/g, " ");
}
