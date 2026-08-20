import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";

export async function targetHasOrgAdminRole(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const binding = await prisma.roleBinding.findFirst({
    where: {
      userId,
      organizationId,
      role: { key: RoleKeys.orgAdmin },
    },
    select: { id: true },
  });
  return Boolean(binding);
}

/** Org admins cannot change roles or suspend/disable peer org admins — super admin only. */
export async function assertOrgAdminPeerCannotModifyOrgAdmin(
  actorUserId: string,
  targetUserId: string,
  organizationId: string,
  action: "role" | "status",
): Promise<void> {
  if (!(await targetHasOrgAdminRole(targetUserId, organizationId))) return;

  if (await userHasRole(actorUserId, [RoleKeys.superAdmin])) return;

  const message =
    action === "role"
      ? "Organization admin roles can only be changed by a platform administrator."
      : "Organization admins can only be suspended or disabled by a platform administrator.";
  throw new AppError(403, "FORBIDDEN", message);
}
