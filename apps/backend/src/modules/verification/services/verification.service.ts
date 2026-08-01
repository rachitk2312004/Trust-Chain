import {
  VerificationInternalStatuses,
  VerificationModes,
  VerificationOutcomes,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { assertDocumentPermission } from "../../documents/documents.access.js";
import { DocumentPermissions } from "@trustchain/config";
import { resolveConfiguredNetwork } from "../../blockchain/chainConfig.js";
import {
  buildIntentDomain,
  consumeIntentNonce,
  verifyChainIntentSignature,
} from "../../blockchain/signatures.js";
import { expectedChainId, getDocumentRegistryAddress } from "../../blockchain/chainConfig.js";
import { sha256HexToBytes32, uuidToBytes32 } from "../../blockchain/chainProvider.js";
import { buildVerificationCacheKey } from "../utils/cacheKey.js";
import { generateVerificationCode } from "../utils/verificationCode.js";
import { assertVerificationRateLimit } from "../utils/rateLimit.js";
import { runVerificationEngine } from "./engine.js";
import { writeVerificationAudit } from "./auditLogger.js";
import type { VerificationReport, VerifyOptions } from "../types/verification.types.js";

export type StartVerifyInput = {
  mode?: "sync" | "async";
  documentVersionId?: string;
  expectedContentHash?: string;
  rehashFromR2?: boolean;
  requireAnchor?: boolean;
  requireLiveChain?: boolean;
  idempotencyKey?: string;
  signature?: string;
  intentNonce?: string | number;
  deadline?: number;
};

function publicRequest(row: {
  id: string;
  verificationCode: string;
  organizationId: string;
  documentId: string;
  documentVersionId: string | null;
  mode: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}) {
  return {
    id: row.id,
    verificationCode: row.verificationCode,
    organizationId: row.organizationId,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    mode: row.mode,
    status: row.status,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

export async function startDocumentVerification(
  userId: string,
  organizationId: string,
  documentId: string,
  input: StartVerifyInput = {},
) {
  await assertVerificationRateLimit(userId, organizationId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "VERIFY_NOT_FOUND", "Document not found");

  await assertDocumentPermission(
    userId,
    {
      id: document.id,
      organizationId: document.organizationId,
      createdById: document.createdById,
      status: document.status,
      deletedAt: document.deletedAt,
      expiresAt: document.expiresAt,
      archivedAt: document.archivedAt,
    },
    input.rehashFromR2 ? DocumentPermissions.download : DocumentPermissions.view,
  );

  if (input.idempotencyKey) {
    const existing = await prisma.verificationRequest.findFirst({
      where: { organizationId, idempotencyKey: input.idempotencyKey },
      include: { result: true },
    });
    if (existing) {
      if (existing.result) {
        return {
          request: publicRequest(existing),
          report: existing.result.report as VerificationReport,
          cached: false,
          idempotentReplay: true,
        };
      }
      if (
        existing.status === VerificationInternalStatuses.pending ||
        existing.status === VerificationInternalStatuses.processing
      ) {
        throw new AppError(409, "VERIFY_IN_PROGRESS", "Verification already in progress", {
          verificationId: existing.id,
        });
      }
      return {
        request: publicRequest(existing),
        report: null,
        cached: false,
        idempotentReplay: true,
      };
    }
  }

  const versionId = input.documentVersionId ?? document.currentVersionId;
  const version = versionId
    ? await prisma.documentVersion.findFirst({
        where: { id: versionId, documentId },
      })
    : null;

  const options: VerifyOptions = {
    rehashFromR2: Boolean(input.rehashFromR2),
    requireAnchor: input.requireAnchor !== false,
    requireLiveChain: Boolean(input.requireLiveChain),
  };

  if (version) {
    const cacheKey = buildVerificationCacheKey({
      organizationId,
      documentId,
      documentVersionId: version.id,
      contentHash: version.contentHash,
      options,
    });
    const cache = await prisma.verificationCache.findUnique({ where: { cacheKey } });
    if (cache && cache.expiresAt > new Date()) {
      const code = generateVerificationCode();
      const request = await prisma.verificationRequest.create({
        data: {
          verificationCode: code,
          organizationId,
          documentId,
          documentVersionId: version.id,
          requestedByUserId: userId,
          mode: input.mode ?? VerificationModes.sync,
          status: VerificationInternalStatuses.completed,
          idempotencyKey: input.idempotencyKey,
          expectedContentHash: input.expectedContentHash,
          options: options as unknown as Prisma.InputJsonValue,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
      const report = {
        ...(cache.report as VerificationReport),
        verificationId: request.id,
        verificationCode: code,
        cached: true,
      };
      await prisma.verificationResult.create({
        data: {
          requestId: request.id,
          organizationId,
          outcome: cache.outcome,
          versionNumber: report.versionNumber,
          contentHash: report.contentHash,
          blockchainStatus: report.blockchainStatus,
          revocationStatus: report.revocationStatus,
          proofOfIntegrity: report.proofOfIntegrity,
          proofTimestamp: report.proofTimestamp ? new Date(report.proofTimestamp) : null,
          networkName: report.networkName,
          transactionHash: report.transactionHash,
          blockNumber: report.blockNumber != null ? BigInt(report.blockNumber) : null,
          report: report as unknown as Prisma.InputJsonValue,
        },
      });
      await writeVerificationAudit({
        requestId: request.id,
        organizationId,
        actorUserId: userId,
        action: "verification.cache_hit",
        metadata: { cacheKey },
      });
      return { request: publicRequest(request), report, cached: true, idempotentReplay: false };
    }
  }

  if (input.signature) {
    const networkKey = resolveConfiguredNetwork();
    const network = await prisma.blockchainNetwork.findUnique({ where: { key: networkKey } });
    if (!network) throw new AppError(503, "CHAIN_NOT_CONFIGURED", "Network not configured");
    const consumed = await consumeIntentNonce(organizationId, network.id);
    if (input.intentNonce != null && BigInt(input.intentNonce) !== consumed) {
      // Still consume to avoid reuse; reject mismatch as replay
      throw new AppError(400, "CHAIN_REPLAY", "Intent nonce mismatch");
    }
    const domain = buildIntentDomain({
      chainId: expectedChainId(networkKey),
      verifyingContract: getDocumentRegistryAddress(),
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // Relayer-style: verify against caller is not an EOA — skip if no wallet binding.
    // For Wave 4, signature is optional organizational intent verified when provided with expectedSigner = CHAIN_PRIVATE_KEY address is wrong.
    // Instead verify structural validity by recovering and requiring deadline; expectedSigner must match provided via env VERIFY_INTENT_SIGNER optional.
    const expectedSigner = process.env.VERIFY_INTENT_SIGNER;
    if (expectedSigner) {
      verifyChainIntentSignature({
        domain,
        message: {
          organizationId: uuidToBytes32(organizationId),
          documentId: uuidToBytes32(documentId),
          versionNumber: version?.versionNumber ?? 0,
          contentHash: sha256HexToBytes32(version?.contentHash ?? "0".repeat(64)),
          operation: "verify",
          intentNonce: consumed,
          deadline: BigInt(input.deadline ?? Math.floor(Date.now() / 1000) + 300),
        },
        signature: input.signature,
        expectedSigner,
      });
    }
    void user;
  }

  const code = generateVerificationCode();
  const mode =
    input.mode === VerificationModes.async ? VerificationModes.async : VerificationModes.sync;

  const request = await prisma.verificationRequest.create({
    data: {
      verificationCode: code,
      organizationId,
      documentId,
      documentVersionId: version?.id ?? null,
      requestedByUserId: userId,
      mode,
      status: VerificationInternalStatuses.pending,
      idempotencyKey: input.idempotencyKey,
      expectedContentHash: input.expectedContentHash,
      options: options as unknown as Prisma.InputJsonValue,
      signature: input.signature,
      intentNonce: input.intentNonce != null ? BigInt(input.intentNonce) : null,
    },
  });

  await writeVerificationAudit({
    requestId: request.id,
    organizationId,
    actorUserId: userId,
    action: "verification.created",
    metadata: { mode, verificationCode: code },
  });

  if (mode === VerificationModes.async) {
    return {
      request: publicRequest(request),
      report: null,
      cached: false,
      idempotentReplay: false,
      accepted: true,
    };
  }

  const { report } = await runVerificationEngine({
    requestId: request.id,
    verificationCode: code,
    organizationId,
    documentId,
    userId,
    documentVersionId: version?.id,
    expectedContentHash: input.expectedContentHash,
    options,
  });

  const refreshed = await prisma.verificationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });

  return {
    request: publicRequest(refreshed),
    report,
    cached: false,
    idempotentReplay: false,
  };
}

export async function processAsyncVerifications(userId: string, organizationId: string, limit = 5) {
  const pending = await prisma.verificationRequest.findMany({
    where: {
      organizationId,
      mode: VerificationModes.async,
      status: VerificationInternalStatuses.pending,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results = [];
  for (const req of pending) {
    const options = (req.options ?? {}) as VerifyOptions;
    try {
      const { report, outcome, status } = await runVerificationEngine({
        requestId: req.id,
        verificationCode: req.verificationCode,
        organizationId: req.organizationId,
        documentId: req.documentId,
        userId: req.requestedByUserId,
        documentVersionId: req.documentVersionId,
        expectedContentHash: req.expectedContentHash,
        options,
      });
      results.push({ id: req.id, status, outcome, report });
    } catch (error) {
      results.push({
        id: req.id,
        status: VerificationInternalStatuses.failed,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  void userId;
  return { processed: results.length, results };
}

export async function getDocumentVerificationStatus(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "VERIFY_NOT_FOUND", "Document not found");
  await assertDocumentPermission(
    userId,
    {
      id: document.id,
      organizationId: document.organizationId,
      createdById: document.createdById,
      status: document.status,
      deletedAt: document.deletedAt,
      expiresAt: document.expiresAt,
      archivedAt: document.archivedAt,
    },
    DocumentPermissions.view,
  );

  const latest = await prisma.verificationRequest.findFirst({
    where: { organizationId, documentId },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    return { request: null, report: null };
  }
  return {
    request: publicRequest(latest),
    report: (latest.result?.report as VerificationReport) ?? null,
    outcome: latest.result?.outcome ?? null,
  };
}

export async function getDocumentVerificationHistory(
  userId: string,
  organizationId: string,
  documentId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "VERIFY_NOT_FOUND", "Document not found");
  await assertDocumentPermission(
    userId,
    {
      id: document.id,
      organizationId: document.organizationId,
      createdById: document.createdById,
      status: document.status,
      deletedAt: document.deletedAt,
      expiresAt: document.expiresAt,
      archivedAt: document.archivedAt,
    },
    DocumentPermissions.view,
  );

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const rows = await prisma.verificationRequest.findMany({
    where: { organizationId, documentId },
    include: { result: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return {
    verifications: rows.map((r) => ({
      request: publicRequest(r),
      outcome: r.result?.outcome ?? null,
      report: (r.result?.report as VerificationReport) ?? null,
    })),
    limit,
    offset,
  };
}

export async function listOrganizationVerifications(
  userId: string,
  organizationId: string,
  query: {
    status?: string;
    outcome?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  // Org membership via any successful document list path — require at least one role
  const { userHasRole } = await import("../../auth/rbac.repository.js");
  const { RoleKeys } = await import("@trustchain/config");
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "VERIFY_FORBIDDEN", "Organization membership required");

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const rows = await prisma.verificationRequest.findMany({
    where: {
      organizationId,
      ...(query.documentId ? { documentId: query.documentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.outcome ? { result: { outcome: query.outcome } } : {}),
    },
    include: { result: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return {
    verifications: rows.map((r) => ({
      request: publicRequest(r),
      outcome: r.result?.outcome ?? null,
      verificationCode: r.verificationCode,
      report: (r.result?.report as VerificationReport) ?? null,
    })),
    limit,
    offset,
  };
}

export async function getVerificationById(
  userId: string,
  organizationId: string,
  verificationId: string,
) {
  const row = await prisma.verificationRequest.findFirst({
    where: { id: verificationId, organizationId },
    include: { result: true, document: true },
  });
  if (!row) throw new AppError(404, "VERIFY_NOT_FOUND", "Verification not found");

  await assertDocumentPermission(
    userId,
    {
      id: row.document.id,
      organizationId: row.document.organizationId,
      createdById: row.document.createdById,
      status: row.document.status,
      deletedAt: row.document.deletedAt,
      expiresAt: row.document.expiresAt,
      archivedAt: row.document.archivedAt,
    },
    DocumentPermissions.view,
  );

  return {
    request: publicRequest(row),
    outcome: row.result?.outcome ?? null,
    report: (row.result?.report as VerificationReport) ?? null,
  };
}

// silence unused import warning helper
void VerificationOutcomes;
