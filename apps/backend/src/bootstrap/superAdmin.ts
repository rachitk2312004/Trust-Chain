import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { bindStaffRoleToUser } from "../modules/auth/roles.repository.js";
import { findUserByEmail } from "../modules/auth/users.repository.js";

export function configuredSuperAdminEmail(): string {
  return (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function emailMatchesSuperAdmin(email: string): boolean {
  const configured = configuredSuperAdminEmail();
  return Boolean(configured) && configured === email.trim().toLowerCase();
}

/** Bind platform super_admin when SUPER_ADMIN_EMAIL matches. Safe to call repeatedly. */
export async function ensureSuperAdminRoleForUser(userId: string, email: string): Promise<boolean> {
  if (!emailMatchesSuperAdmin(email)) return false;
  await bindStaffRoleToUser({ userId, roleKey: RoleKeys.superAdmin });
  return true;
}

/**
 * Optional bootstrap: if SUPER_ADMIN_EMAIL matches an existing user, bind super_admin.
 * Also runs on register/login because startup only sees users that already exist.
 */
export async function bootstrapSuperAdmin(): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim();
  if (!email) {
    return;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn("SUPER_ADMIN_EMAIL is set but that user does not exist yet; will promote on register/login");
    return;
  }

  await ensureSuperAdminRoleForUser(user.id, user.email);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "active",
      emailVerifiedAt: user.email_verified_at ?? new Date(),
    },
  });
  console.log("Super admin role ensured for configured SUPER_ADMIN_EMAIL");
}
