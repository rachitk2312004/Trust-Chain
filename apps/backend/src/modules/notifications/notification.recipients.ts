import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";

/** Org admins (+ super admins with org binding) who should receive org-scoped alerts. */
export async function listOrgAdminUserIds(organizationId: string): Promise<string[]> {
  const rows = await prisma.roleBinding.findMany({
    where: {
      OR: [
        { role: { key: RoleKeys.superAdmin } },
        { organizationId, role: { key: RoleKeys.orgAdmin } },
      ],
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

export function uniqueUserIds(...groups: Array<string | null | undefined>[]): string[] {
  const out = new Set<string>();
  for (const group of groups) {
    for (const id of group) {
      if (id) out.add(id);
    }
  }
  return [...out];
}
