import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { bindRoleToUser } from "../modules/auth/roles.repository.js";
import { findUserByEmail } from "../modules/auth/users.repository.js";

/**
 * Optional bootstrap: if SUPER_ADMIN_EMAIL matches an existing user, bind super_admin.
 * Safe to call on startup; no-op when unset or user missing.
 */
export async function bootstrapSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  if (!email) {
    return;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn(`SUPER_ADMIN_EMAIL=${email} set but user not found; skipping bootstrap`);
    return;
  }

  await bindRoleToUser({ userId: user.id, roleKey: RoleKeys.superAdmin });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "active",
      emailVerifiedAt: user.email_verified_at ?? new Date(),
    },
  });
  console.log(`Super admin role ensured for ${email}`);
}
