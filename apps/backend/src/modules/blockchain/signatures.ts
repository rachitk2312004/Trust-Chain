import {
  TypedDataEncoder,
  verifyTypedData,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";

export const TRUSTCHAIN_INTENT_TYPES: Record<string, TypedDataField[]> = {
  ChainIntent: [
    { name: "organizationId", type: "bytes32" },
    { name: "documentId", type: "bytes32" },
    { name: "versionNumber", type: "uint32" },
    { name: "contentHash", type: "bytes32" },
    { name: "operation", type: "string" },
    { name: "intentNonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export function buildIntentDomain(input: {
  chainId: number;
  verifyingContract: string;
}): TypedDataDomain {
  return {
    name: "TrustChain",
    version: "1",
    chainId: input.chainId,
    verifyingContract: input.verifyingContract,
  };
}

export type ChainIntentMessage = {
  organizationId: string;
  documentId: string;
  versionNumber: number;
  contentHash: string;
  operation: string;
  intentNonce: bigint;
  deadline: bigint;
};

export function hashChainIntent(domain: TypedDataDomain, message: ChainIntentMessage): string {
  return TypedDataEncoder.hash(domain, TRUSTCHAIN_INTENT_TYPES, message);
}

export function verifyChainIntentSignature(input: {
  domain: TypedDataDomain;
  message: ChainIntentMessage;
  signature: string;
  expectedSigner: string;
}): void {
  if (input.message.deadline < BigInt(Math.floor(Date.now() / 1000))) {
    throw new AppError(400, "CHAIN_REPLAY", "Intent signature deadline has passed");
  }

  const recovered = verifyTypedData(
    input.domain,
    TRUSTCHAIN_INTENT_TYPES,
    input.message,
    input.signature,
  );

  if (recovered.toLowerCase() !== input.expectedSigner.toLowerCase()) {
    throw new AppError(401, "CHAIN_SIGNATURE_INVALID", "Intent signature mismatch");
  }
}

/** Allocate and consume the next org intent nonce (replay protection). */
export async function consumeIntentNonce(
  organizationId: string,
  networkId: string,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.blockchainIntentNonce.upsert({
      where: {
        organizationId_networkId: { organizationId, networkId },
      },
      create: { organizationId, networkId, nextNonce: 1n },
      update: { nextNonce: { increment: 1 } },
    });
    // After upsert+increment, nextNonce is the *next* value; consumed = nextNonce - 1
    // On create path nextNonce=1 means consumed 0... wait:
    // create with nextNonce: 1 means we want to return 0 as first consumed?
    // Better: store nextNonce as the next to issue.
    // create: nextNonce=1, but upsert create sets 1 without increment on first...
    // Actually on create we set nextNonce: 1, and return should be 0.
    // On update we increment then the returned row has the new nextNonce, consumed = nextNonce - 1.

    const consumed = row.nextNonce - 1n;
    if (consumed < 0n) {
      throw new AppError(500, "INTERNAL_ERROR", "Invalid intent nonce state");
    }
    return consumed;
  });
}
