import { SignatureEventTypes } from "@trustchain/config";
import type { Prisma } from "@trustchain/database";
import * as repo from "./signatures.repository.js";

export async function recordSignatureCreatedEvent(
  input: {
    signatureId: string;
    organizationId: string;
    actorId: string;
    payload: Record<string, unknown>;
  },
  db?: Prisma.TransactionClient,
) {
  return repo.createSignatureEvent(
    {
      signatureId: input.signatureId,
      organizationId: input.organizationId,
      eventType: SignatureEventTypes.created,
      actorId: input.actorId,
      payloadJson: input.payload as Prisma.InputJsonValue,
    },
    db,
  );
}

export async function recordSignatureVerifiedEvent(input: {
  signatureId: string;
  organizationId: string;
  actorId: string;
  payload: Record<string, unknown>;
}) {
  return repo.createSignatureEvent({
    signatureId: input.signatureId,
    organizationId: input.organizationId,
    eventType: SignatureEventTypes.verified,
    actorId: input.actorId,
    payloadJson: input.payload as Prisma.InputJsonValue,
  });
}

export async function recordSignatureRevokedEvent(
  input: {
    signatureId: string;
    organizationId: string;
    actorId: string;
    payload: Record<string, unknown>;
  },
  db?: Prisma.TransactionClient,
) {
  return repo.createSignatureEvent(
    {
      signatureId: input.signatureId,
      organizationId: input.organizationId,
      eventType: SignatureEventTypes.revoked,
      actorId: input.actorId,
      payloadJson: input.payload as Prisma.InputJsonValue,
    },
    db,
  );
}
