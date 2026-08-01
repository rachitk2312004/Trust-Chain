import {
  BlockchainAnchorStatuses,
  VerificationCacheTtlMs,
  VerificationInternalStatuses,
  VerificationOutcomes,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { createHash } from "node:crypto";
import { getObjectBuffer } from "../../../integrations/objectStorage.js";
import { resolveConfiguredNetwork } from "../../blockchain/chainConfig.js";
import { getDocumentRegistryContract } from "../../blockchain/chainProvider.js";
import { buildVerificationCacheKey } from "../utils/cacheKey.js";
import { resolveOutcome } from "../utils/outcome.js";
import { buildVerificationReport } from "../reports/reportGenerator.js";
import { defaultValidators } from "../validators/index.js";
import { writeVerificationAudit } from "./auditLogger.js";
import type {
  VerificationCheck,
  VerificationContext,
  VerificationReport,
  VerifyOptions,
} from "../types/verification.types.js";

// Re-export isChainEnabled check via local helper — config may not export a function
function chainWritesEnabled(): boolean {
  const value = (process.env.CHAIN_ENABLED ?? "true").toLowerCase();
  return value !== "false" && value !== "0";
}

async function loadLiveChain(
  orgIdBytes32: string,
  documentIdBytes32: string,
  versionNumber: number,
): Promise<VerificationContext["liveChain"]> {
  if (!chainWritesEnabled() || !process.env.CHAIN_DOCUMENT_REGISTRY_ADDRESS) {
    return null;
  }
  try {
    const { contract } = await getDocumentRegistryContract();
    const anchor = await contract
      .getFunction("getAnchor")
      .staticCall(orgIdBytes32, documentIdBytes32, versionNumber);
    const exists = Boolean(anchor.exists);
    return {
      exists,
      revoked: Boolean(anchor.revoked),
      contentHash: exists ? String(anchor.contentHash) : null,
    };
  } catch {
    return null;
  }
}

function uuidToBytes32Local(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  return `0x${hex.padStart(64, "0")}`;
}

export async function runVerificationEngine(input: {
  requestId: string;
  verificationCode: string;
  organizationId: string;
  documentId: string;
  userId: string;
  documentVersionId?: string | null;
  expectedContentHash?: string | null;
  options: VerifyOptions;
}): Promise<{ report: VerificationReport; outcome: string; status: string }> {
  await prisma.verificationRequest.update({
    where: { id: input.requestId },
    data: {
      status: VerificationInternalStatuses.processing,
      startedAt: new Date(),
    },
  });
  await writeVerificationAudit({
    requestId: input.requestId,
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "verification.started",
  });

  try {
    const document = await prisma.document.findFirst({
      where: { id: input.documentId, organizationId: input.organizationId },
    });
    if (!document) {
      return finalizeFailure(input, VerificationOutcomes.missing, ["document_missing"], []);
    }

    const version = input.documentVersionId
      ? await prisma.documentVersion.findFirst({
          where: { id: input.documentVersionId, documentId: document.id },
        })
      : document.currentVersionId
        ? await prisma.documentVersion.findUnique({ where: { id: document.currentVersionId } })
        : null;

    const networkKey = resolveConfiguredNetwork();
    const network = await prisma.blockchainNetwork.findUnique({ where: { key: networkKey } });

    let anchorCtx: VerificationContext["anchor"] = null;
    if (version && network) {
      const anchor = await prisma.blockchainAnchor.findUnique({
        where: {
          networkId_documentVersionId: {
            networkId: network.id,
            documentVersionId: version.id,
          },
        },
        include: { anchorTx: true, revokeTx: true },
      });
      if (anchor) {
        anchorCtx = {
          status: anchor.status,
          contentHash: anchor.contentHash,
          versionNumber: anchor.versionNumber,
          blockNumber: anchor.blockNumber,
          anchorTxHash: anchor.anchorTx?.txHash ?? null,
          revokeTxHash: anchor.revokeTx?.txHash ?? null,
        };
      }
    }

    let r2Hash: string | null = null;
    let r2Exists: boolean | undefined;
    if (input.options.rehashFromR2 && version) {
      const obj = await getObjectBuffer(version.objectKey);
      r2Exists = obj.exists;
      if (obj.body) {
        r2Hash = createHash("sha256").update(obj.body).digest("hex");
      }
    }

    let liveChain: VerificationContext["liveChain"] = null;
    if (version && input.options.requireLiveChain !== false && anchorCtx) {
      liveChain = await loadLiveChain(
        uuidToBytes32Local(input.organizationId),
        uuidToBytes32Local(input.documentId),
        version.versionNumber,
      );
    }

    const ctx: VerificationContext = {
      organizationId: input.organizationId,
      documentId: input.documentId,
      userId: input.userId,
      document,
      version: version
        ? {
            id: version.id,
            versionNumber: version.versionNumber,
            contentHash: version.contentHash,
            objectKey: version.objectKey,
          }
        : null,
      expectedContentHash: input.expectedContentHash,
      options: input.options,
      networkKey,
      anchor: anchorCtx,
      liveChain,
      r2Hash,
      r2Exists,
    };

    const checks: VerificationCheck[] = [];
    for (const validator of defaultValidators) {
      const check = await validator.run(ctx);
      checks.push(check);
      await writeVerificationAudit({
        requestId: input.requestId,
        organizationId: input.organizationId,
        actorUserId: input.userId,
        action: `verification.check.${check.name}`,
        metadata: check as unknown as Prisma.InputJsonValue,
      });
    }

    const { outcome, failureReasons } = resolveOutcome(checks);
    const blockchainStatus = anchorCtx?.status ?? "none";
    const revocationStatus =
      anchorCtx?.status === BlockchainAnchorStatuses.revoked || liveChain?.revoked
        ? "revoked"
        : anchorCtx
          ? "not_revoked"
          : "unknown";

    const proofOfIntegrity = version?.contentHash.toLowerCase() ?? null;
    const proofTimestamp = new Date();
    const txHash =
      anchorCtx?.status === BlockchainAnchorStatuses.revoked
        ? anchorCtx.revokeTxHash
        : (anchorCtx?.anchorTxHash ?? null);

    const internalStatus =
      outcome === VerificationOutcomes.valid
        ? VerificationInternalStatuses.completed
        : outcome === VerificationOutcomes.revoked ||
            outcome === VerificationOutcomes.expired ||
            outcome === VerificationOutcomes.invalid ||
            outcome === VerificationOutcomes.missing ||
            outcome === VerificationOutcomes.tampered
          ? VerificationInternalStatuses.completed
          : VerificationInternalStatuses.failed;

    // Treat pipeline completion with a decisive outcome as completed;
    // use failed only for unexpected engine errors (handled in catch).
    const status = VerificationInternalStatuses.completed;

    const report = buildVerificationReport({
      verificationId: input.requestId,
      verificationCode: input.verificationCode,
      organizationId: input.organizationId,
      documentId: input.documentId,
      versionNumber: version?.versionNumber ?? null,
      contentHash: version?.contentHash.toLowerCase() ?? null,
      blockchainStatus,
      revocationStatus,
      status,
      outcome,
      failureReasons,
      checks,
      proofOfIntegrity,
      proofTimestamp,
      networkName: network?.name ?? networkKey,
      transactionHash: txHash,
      blockNumber: anchorCtx?.blockNumber ?? null,
    });

    const result = await prisma.verificationResult.create({
      data: {
        requestId: input.requestId,
        organizationId: input.organizationId,
        outcome,
        versionNumber: version?.versionNumber ?? null,
        contentHash: version?.contentHash.toLowerCase() ?? null,
        blockchainStatus,
        revocationStatus,
        proofOfIntegrity,
        proofTimestamp,
        networkName: network?.name ?? networkKey,
        transactionHash: txHash,
        blockNumber: anchorCtx?.blockNumber ?? null,
        checks: checks as unknown as Prisma.InputJsonValue,
        failureReasons: failureReasons as unknown as Prisma.InputJsonValue,
        report: report as unknown as Prisma.InputJsonValue,
        verifiedAt: proofTimestamp,
      },
    });

    await prisma.verificationRequest.update({
      where: { id: input.requestId },
      data: {
        status,
        documentVersionId: version?.id ?? null,
        completedAt: proofTimestamp,
      },
    });

    if (version) {
      const cacheKey = buildVerificationCacheKey({
        organizationId: input.organizationId,
        documentId: input.documentId,
        documentVersionId: version.id,
        contentHash: version.contentHash,
        options: input.options,
      });
      await prisma.verificationCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          organizationId: input.organizationId,
          documentId: input.documentId,
          requestId: input.requestId,
          resultId: result.id,
          outcome,
          status,
          report: report as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + VerificationCacheTtlMs),
        },
        update: {
          requestId: input.requestId,
          resultId: result.id,
          outcome,
          status,
          report: report as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + VerificationCacheTtlMs),
        },
      });
    }

    await writeVerificationAudit({
      requestId: input.requestId,
      organizationId: input.organizationId,
      actorUserId: input.userId,
      action: "verification.completed",
      metadata: { outcome, status },
    });

    // silence unused
    void internalStatus;

    return { report, outcome, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.verificationRequest.update({
      where: { id: input.requestId },
      data: {
        status: VerificationInternalStatuses.failed,
        completedAt: new Date(),
      },
    });
    await writeVerificationAudit({
      requestId: input.requestId,
      organizationId: input.organizationId,
      actorUserId: input.userId,
      action: "verification.failed",
      metadata: { error: message },
    });
    throw error;
  }
}

async function finalizeFailure(
  input: {
    requestId: string;
    verificationCode: string;
    organizationId: string;
    documentId: string;
    userId: string;
  },
  outcome: string,
  failureReasons: string[],
  checks: VerificationCheck[],
) {
  const status = VerificationInternalStatuses.completed;
  const report = buildVerificationReport({
    verificationId: input.requestId,
    verificationCode: input.verificationCode,
    organizationId: input.organizationId,
    documentId: input.documentId,
    versionNumber: null,
    contentHash: null,
    blockchainStatus: "none",
    revocationStatus: "unknown",
    status,
    outcome: outcome as (typeof VerificationOutcomes)[keyof typeof VerificationOutcomes],
    failureReasons,
    checks,
    proofOfIntegrity: null,
    proofTimestamp: null,
    networkName: null,
    transactionHash: null,
    blockNumber: null,
  });

  await prisma.verificationResult.create({
    data: {
      requestId: input.requestId,
      organizationId: input.organizationId,
      outcome,
      failureReasons: failureReasons as unknown as Prisma.InputJsonValue,
      checks: checks as unknown as Prisma.InputJsonValue,
      report: report as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.verificationRequest.update({
    where: { id: input.requestId },
    data: { status, completedAt: new Date() },
  });
  await writeVerificationAudit({
    requestId: input.requestId,
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "verification.completed",
    metadata: { outcome, status },
  });
  return { report, outcome, status };
}
