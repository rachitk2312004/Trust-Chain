import { prisma } from "@trustchain/database";

export type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role_key: string;
  token_hash: string;
  invited_by: string | null;
  branch_id: string | null;
  department_id: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
};

function toInvitationRow(row: {
  id: string;
  organizationId: string;
  email: string;
  roleKey: string;
  tokenHash: string;
  invitedBy: string | null;
  branchId: string | null;
  departmentId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): InvitationRow {
  return {
    id: row.id,
    organization_id: row.organizationId,
    email: row.email,
    role_key: row.roleKey,
    token_hash: row.tokenHash,
    invited_by: row.invitedBy,
    branch_id: row.branchId,
    department_id: row.departmentId,
    expires_at: row.expiresAt,
    accepted_at: row.acceptedAt,
    revoked_at: row.revokedAt,
    created_at: row.createdAt,
  };
}

export async function createInvitation(input: {
  organizationId: string;
  email: string;
  roleKey: string;
  tokenHash: string;
  invitedBy: string;
  branchId?: string | null;
  departmentId?: string | null;
  expiresAt: Date;
}): Promise<InvitationRow> {
  const row = await prisma.invitation.create({
    data: {
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      roleKey: input.roleKey,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      expiresAt: input.expiresAt,
    },
  });
  return toInvitationRow(row);
}

export async function findValidInvitationByTokenHash(
  tokenHash: string,
): Promise<InvitationRow | null> {
  const row = await prisma.invitation.findFirst({
    where: {
      tokenHash,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return row ? toInvitationRow(row) : null;
}

export async function markInvitationAccepted(id: string): Promise<void> {
  await prisma.invitation.update({ where: { id }, data: { acceptedAt: new Date() } });
}

export async function listInvitations(organizationId: string): Promise<InvitationRow[]> {
  const rows = await prisma.invitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toInvitationRow);
}
