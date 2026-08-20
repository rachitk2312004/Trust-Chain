export function adminStatusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "pending") return "neutral";
  if (status === "suspended" || status === "disabled") return "warning";
  if (status === "deleted" || status === "archived") return "danger";
  return "neutral";
}

export function adminStatusLabel(status: string): string {
  if (status === "disabled") return "suspended";
  return status;
}

export function adminStatusRemark(entity: "user" | "organization", status: string): string | null {
  if (status === "suspended") {
    return "This organization has been suspended by a platform administrator.";
  }
  if (status === "disabled") {
    return "This account has been suspended by a platform administrator.";
  }
  if (status === "deleted") {
    return "This organization has been deleted by a platform administrator.";
  }
  if (status === "archived") {
    return entity === "organization"
      ? "This organization has been archived."
      : "This account has been archived.";
  }
  return null;
}

export function userIsSuperAdmin(roles: Array<{ roleKey: string }>): boolean {
  return roles.some((role) => role.roleKey === "super_admin");
}
