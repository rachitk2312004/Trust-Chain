import {
  BlockchainAnchorStatuses,
  BlockchainOperations,
  DocumentStatuses,
  OrganizationChainRegistrationStatuses,
  RoleKeys,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { assertDocumentPermission } from "../documents/documents.access.js";
import { DocumentPermissions } from "@trustchain/config";
import { assertChainEnabled, explorerTxUrl, resolveConfiguredNetwork } from "./chainConfig.js";
import { getDocumentRegistryContract, sha256HexToBytes32, uuidToBytes32 } from "./chainProvider.js";
import { indexReceiptEvents } from "./eventIndexer.js";
import { blockchainJobQueue } from "./jobQueue.js";
import { createPendingTransaction, submitAndConfirm } from "./transactionManager.js";
import { invalidateVerificationCacheForDocument } from "../verification/services/cacheInvalidation.js";
import { invalidatePublicSnapshots } from "../public-verification/services/publicVerification.service.js";

async function assertOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

async function getActiveNetworkRow() {
  const key = resolveConfiguredNetwork();
  const network = await prisma.blockchainNetwork.findUnique({ where: { key } });
  if (!network || !network.isActive) {
    throw new AppError(503, "CHAIN_NOT_CONFIGURED", `Network ${key} is not configured`);
  }
  return network;
}

async function ensureRegistryAddress(networkId: string): Promise<string> {
  const { address } = await getDocumentRegistryContract();
  await prisma.blockchainNetwork.update({
    where: { id: networkId },
    data: { documentRegistryAddress: address },
  });
  return address;
}

function publicTx(tx: {
  id: string;
  operation: string;
  status: string;
  txHash: string | null;
  blockNumber: bigint | null;
  blockHash: string | null;
  transactionIndex: number | null;
  confirmationCount: number;
  error: string | null;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    operation: tx.operation,
    status: tx.status,
    txHash: tx.txHash,
    blockNumber: tx.blockNumber != null ? Number(tx.blockNumber) : null,
    blockHash: tx.blockHash,
    transactionIndex: tx.transactionIndex,
    confirmationCount: tx.confirmationCount,
    error: tx.error,
    submittedAt: tx.submittedAt,
    confirmedAt: tx.confirmedAt,
    createdAt: tx.createdAt,
  };
}

function publicAnchor(anchor: {
  id: string;
  documentId: string;
  documentVersionId: string;
  contentHash: string;
  versionNumber: number;
  status: string;
  blockNumber: bigint | null;
  blockHash: string | null;
  transactionIndex: number | null;
  confirmationCount: number;
  anchoredAt: Date | null;
  revokedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
}) {
  return {
    id: anchor.id,
    documentId: anchor.documentId,
    documentVersionId: anchor.documentVersionId,
    contentHash: anchor.contentHash,
    versionNumber: anchor.versionNumber,
    status: anchor.status,
    blockNumber: anchor.blockNumber != null ? Number(anchor.blockNumber) : null,
    blockHash: anchor.blockHash,
    transactionIndex: anchor.transactionIndex,
    confirmationCount: anchor.confirmationCount,
    anchoredAt: anchor.anchoredAt,
    revokedAt: anchor.revokedAt,
    failedAt: anchor.failedAt,
    failureReason: anchor.failureReason,
    createdAt: anchor.createdAt,
  };
}

export async function listBlockchainNetworks() {
  const networks = await prisma.blockchainNetwork.findMany({
    where: { isActive: true, key: { in: ["hardhat", "sepolia"] } },
    orderBy: { chainId: "asc" },
  });
  return networks.map((n) => ({
    id: n.id,
    key: n.key,
    chainId: n.chainId,
    name: n.name,
    explorerBaseUrl: n.explorerBaseUrl,
    documentRegistryAddress: n.documentRegistryAddress,
    isActive: n.isActive,
  }));
}

export async function getCurrentBlockchainNetwork() {
  const network = await getActiveNetworkRow();
  return {
    id: network.id,
    key: network.key,
    chainId: network.chainId,
    name: network.name,
    explorerBaseUrl: network.explorerBaseUrl,
    documentRegistryAddress: network.documentRegistryAddress,
    configuredNetwork: resolveConfiguredNetwork(),
  };
}

export async function getOrganizationChainStatus(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const network = await getActiveNetworkRow();
  const registration = await prisma.organizationChainRegistration.findUnique({
    where: {
      networkId_organizationId: { networkId: network.id, organizationId },
    },
  });
  return {
    network: {
      key: network.key,
      chainId: network.chainId,
      documentRegistryAddress: network.documentRegistryAddress,
    },
    registration: registration
      ? {
          status: registration.status,
          ownerAddress: registration.ownerAddress,
          registeredAt: registration.registeredAt,
        }
      : null,
  };
}

export async function registerOrganizationOnChain(userId: string, organizationId: string) {
  assertChainEnabled();
  await assertOrgAdmin(userId, organizationId);

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError(404, "NOT_FOUND", "Organization not found");

  const network = await getActiveNetworkRow();
  const existing = await prisma.organizationChainRegistration.findUnique({
    where: {
      networkId_organizationId: { networkId: network.id, organizationId },
    },
  });
  if (existing?.status === OrganizationChainRegistrationStatuses.registered) {
    return { registration: existing, alreadyRegistered: true };
  }

  const { contract, wallet, network: chainNetwork, address } = await getDocumentRegistryContract();
  await ensureRegistryAddress(network.id);

  const orgIdBytes32 = uuidToBytes32(organizationId);
  const registration =
    existing ??
    (await prisma.organizationChainRegistration.create({
      data: {
        networkId: network.id,
        organizationId,
        ownerAddress: wallet.address,
        status: OrganizationChainRegistrationStatuses.pending,
      },
    }));

  const tx = await createPendingTransaction({
    networkId: network.id,
    organizationId,
    operation: BlockchainOperations.registerOrg,
    toAddress: address,
  });

  try {
    const { receipt, meta, txHash } = await submitAndConfirm({
      txId: tx.id,
      send: async () => {
        const response = await contract
          .getFunction("registerOrganization")
          .send(orgIdBytes32, wallet.address);
        return response;
      },
    });

    await indexReceiptEvents({
      networkId: network.id,
      contractAddress: address,
      receiptLogs: receipt.logs
        .map((log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (!parsed) return null;
            return {
              eventName: parsed.name,
              log,
              payload: {
                args: parsed.args.map((value) =>
                  typeof value === "bigint" ? value.toString() : String(value),
                ),
              },
            };
          } catch {
            return null;
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    });

    const updated = await prisma.organizationChainRegistration.update({
      where: { id: registration.id },
      data: {
        status: OrganizationChainRegistrationStatuses.registered,
        registerTxId: tx.id,
        registeredAt: new Date(),
        ownerAddress: wallet.address,
      },
    });

    return {
      registration: updated,
      transaction: publicTx(
        await prisma.blockchainTransaction.findUniqueOrThrow({ where: { id: tx.id } }),
      ),
      explorerUrl: explorerTxUrl(chainNetwork, txHash),
      block: meta,
      alreadyRegistered: false,
    };
  } catch (error) {
    await prisma.organizationChainRegistration.update({
      where: { id: registration.id },
      data: { status: OrganizationChainRegistrationStatuses.failed },
    });
    await blockchainJobQueue.enqueue({
      networkId: network.id,
      organizationId,
      operation: BlockchainOperations.registerOrg,
      referenceType: "organization_chain_registration",
      referenceId: registration.id,
      delayMs: 30_000,
    });
    throw error;
  }
}

export async function anchorDocumentOnChain(
  userId: string,
  organizationId: string,
  documentId: string,
  input?: { documentVersionId?: string },
) {
  assertChainEnabled();
  await assertOrgAdmin(userId, organizationId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    include: { currentVersion: true },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
  if (document.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  if (document.status === DocumentStatuses.pendingUpload || !document.currentVersionId) {
    throw new AppError(409, "CHAIN_DOC_NOT_ANCHORABLE", "Document has no confirmed version");
  }
  if (document.status !== DocumentStatuses.active) {
    throw new AppError(
      409,
      "CHAIN_DOC_NOT_ANCHORABLE",
      "Only active documents can be anchored in Wave 3",
    );
  }

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
    DocumentPermissions.manage,
  );

  const version = input?.documentVersionId
    ? await prisma.documentVersion.findFirst({
        where: { id: input.documentVersionId, documentId },
      })
    : document.currentVersion;

  if (!version) throw new AppError(404, "DOC_NOT_FOUND", "Document version not found");

  const network = await getActiveNetworkRow();
  const registration = await prisma.organizationChainRegistration.findUnique({
    where: {
      networkId_organizationId: { networkId: network.id, organizationId },
    },
  });
  if (registration?.status !== OrganizationChainRegistrationStatuses.registered) {
    throw new AppError(
      409,
      "CHAIN_ORG_NOT_REGISTERED",
      "Register the organization on-chain before anchoring",
    );
  }

  const existing = await prisma.blockchainAnchor.findUnique({
    where: {
      networkId_documentVersionId: {
        networkId: network.id,
        documentVersionId: version.id,
      },
    },
  });
  if (existing?.status === BlockchainAnchorStatuses.anchored) {
    throw new AppError(409, "CHAIN_ALREADY_ANCHORED", "Version is already anchored", {
      anchorId: existing.id,
    });
  }
  if (existing?.status === BlockchainAnchorStatuses.revoked) {
    throw new AppError(
      409,
      "CHAIN_ALREADY_REVOKED",
      "Version was revoked and cannot be re-anchored",
    );
  }

  const { contract, network: chainNetwork, address } = await getDocumentRegistryContract();
  await ensureRegistryAddress(network.id);

  const orgIdBytes32 = uuidToBytes32(organizationId);
  const documentIdBytes32 = uuidToBytes32(documentId);
  const contentHashBytes32 = sha256HexToBytes32(version.contentHash);

  const anchor =
    existing ??
    (await prisma.blockchainAnchor.create({
      data: {
        networkId: network.id,
        organizationId,
        documentId,
        documentVersionId: version.id,
        contentHash: version.contentHash.toLowerCase(),
        versionNumber: version.versionNumber,
        orgIdBytes32,
        documentIdBytes32,
        status: BlockchainAnchorStatuses.pending,
      },
    }));

  if (existing?.status === BlockchainAnchorStatuses.failed) {
    await prisma.blockchainAnchor.update({
      where: { id: existing.id },
      data: {
        status: BlockchainAnchorStatuses.pending,
        failedAt: null,
        failureReason: null,
      },
    });
  }

  const tx = await createPendingTransaction({
    networkId: network.id,
    organizationId,
    documentId,
    documentVersionId: version.id,
    operation: BlockchainOperations.anchor,
    toAddress: address,
  });

  await prisma.blockchainAnchor.update({
    where: { id: anchor.id },
    data: { anchorTxId: tx.id },
  });

  try {
    const { receipt, meta, txHash } = await submitAndConfirm({
      txId: tx.id,
      send: async () => {
        const response = await contract
          .getFunction("anchorDocument")
          .send(orgIdBytes32, documentIdBytes32, contentHashBytes32, version.versionNumber);
        return response;
      },
    });

    await indexReceiptEvents({
      networkId: network.id,
      contractAddress: address,
      receiptLogs: receipt.logs
        .map((log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (!parsed) return null;
            return {
              eventName: parsed.name,
              log,
              payload: {
                args: parsed.args.map((value) =>
                  typeof value === "bigint" ? value.toString() : String(value),
                ),
              },
            };
          } catch {
            return null;
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    });

    const updated = await prisma.blockchainAnchor.update({
      where: { id: anchor.id },
      data: {
        status: BlockchainAnchorStatuses.anchored,
        blockNumber: meta.blockNumber,
        blockHash: meta.blockHash,
        transactionIndex: meta.transactionIndex,
        confirmationCount: meta.confirmationCount,
        anchoredAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    await prisma.documentAuditEntry.create({
      data: {
        documentId,
        organizationId,
        actorUserId: userId,
        action: "document.anchored",
        metadata: {
          anchorId: updated.id,
          txHash,
          versionNumber: version.versionNumber,
          contentHash: version.contentHash,
        },
      },
    });
    await invalidateVerificationCacheForDocument(organizationId, documentId, "anchor_created");
    await invalidatePublicSnapshots(organizationId, documentId);

    return {
      anchor: publicAnchor(updated),
      transaction: publicTx(
        await prisma.blockchainTransaction.findUniqueOrThrow({ where: { id: tx.id } }),
      ),
      explorerUrl: explorerTxUrl(chainNetwork, txHash),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.blockchainAnchor.update({
      where: { id: anchor.id },
      data: {
        status: BlockchainAnchorStatuses.failed,
        failedAt: new Date(),
        failureReason: message.slice(0, 2000),
      },
    });
    await blockchainJobQueue.enqueue({
      networkId: network.id,
      organizationId,
      operation: BlockchainOperations.anchor,
      referenceType: "blockchain_anchor",
      referenceId: anchor.id,
      delayMs: 30_000,
    });
    throw error;
  }
}

export async function revokeDocumentOnChain(
  userId: string,
  organizationId: string,
  documentId: string,
  input?: { documentVersionId?: string },
) {
  assertChainEnabled();
  await assertOrgAdmin(userId, organizationId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");

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
    DocumentPermissions.manage,
  );

  const network = await getActiveNetworkRow();
  const versionId = input?.documentVersionId ?? document.currentVersionId;
  if (!versionId) {
    throw new AppError(409, "CHAIN_DOC_NOT_ANCHORABLE", "Document has no version to revoke");
  }

  const anchor = await prisma.blockchainAnchor.findUnique({
    where: {
      networkId_documentVersionId: {
        networkId: network.id,
        documentVersionId: versionId,
      },
    },
  });
  if (!anchor || anchor.status !== BlockchainAnchorStatuses.anchored) {
    throw new AppError(409, "CHAIN_DOC_NOT_ANCHORABLE", "Document version is not anchored");
  }

  const { contract, network: chainNetwork, address } = await getDocumentRegistryContract();

  const tx = await createPendingTransaction({
    networkId: network.id,
    organizationId,
    documentId,
    documentVersionId: versionId,
    operation: BlockchainOperations.revoke,
    toAddress: address,
  });

  await prisma.blockchainAnchor.update({
    where: { id: anchor.id },
    data: { revokeTxId: tx.id },
  });

  try {
    const { receipt, meta, txHash } = await submitAndConfirm({
      txId: tx.id,
      send: async () => {
        const response = await contract
          .getFunction("revokeDocument")
          .send(anchor.orgIdBytes32, anchor.documentIdBytes32, anchor.versionNumber);
        return response;
      },
    });

    await indexReceiptEvents({
      networkId: network.id,
      contractAddress: address,
      receiptLogs: receipt.logs
        .map((log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (!parsed) return null;
            return {
              eventName: parsed.name,
              log,
              payload: {
                args: parsed.args.map((value) =>
                  typeof value === "bigint" ? value.toString() : String(value),
                ),
              },
            };
          } catch {
            return null;
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    });

    const updated = await prisma.blockchainAnchor.update({
      where: { id: anchor.id },
      data: {
        status: BlockchainAnchorStatuses.revoked,
        revokedAt: new Date(),
        blockNumber: meta.blockNumber,
        blockHash: meta.blockHash,
        transactionIndex: meta.transactionIndex,
        confirmationCount: meta.confirmationCount,
      },
    });

    await prisma.documentAuditEntry.create({
      data: {
        documentId,
        organizationId,
        actorUserId: userId,
        action: "document.revoked_on_chain",
        metadata: { anchorId: updated.id, txHash },
      },
    });
    await invalidateVerificationCacheForDocument(organizationId, documentId, "anchor_revoked");
    await invalidatePublicSnapshots(organizationId, documentId);

    return {
      anchor: publicAnchor(updated),
      transaction: publicTx(
        await prisma.blockchainTransaction.findUniqueOrThrow({ where: { id: tx.id } }),
      ),
      explorerUrl: explorerTxUrl(chainNetwork, txHash),
    };
  } catch (error) {
    await blockchainJobQueue.enqueue({
      networkId: network.id,
      organizationId,
      operation: BlockchainOperations.revoke,
      referenceType: "blockchain_anchor",
      referenceId: anchor.id,
      delayMs: 30_000,
    });
    throw error;
  }
}

export async function listDocumentAnchors(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");

  const network = await getActiveNetworkRow();
  const anchors = await prisma.blockchainAnchor.findMany({
    where: { networkId: network.id, documentId },
    orderBy: { versionNumber: "desc" },
  });
  return anchors.map(publicAnchor);
}

export async function getDocumentChainStatus(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    include: { currentVersion: true },
  });
  if (!document) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");

  const network = await getActiveNetworkRow();
  const anchors = await prisma.blockchainAnchor.findMany({
    where: { networkId: network.id, documentId },
    orderBy: { versionNumber: "desc" },
  });

  return {
    documentId,
    currentVersionId: document.currentVersionId,
    currentContentHash: document.currentVersion?.contentHash ?? null,
    anchors: anchors.map(publicAnchor),
  };
}

export async function listOrganizationChainTransactions(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const network = await getActiveNetworkRow();
  const rows = await prisma.blockchainTransaction.findMany({
    where: { networkId: network.id, organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(publicTx);
}

export async function getOrganizationChainTransaction(
  userId: string,
  organizationId: string,
  txId: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const row = await prisma.blockchainTransaction.findFirst({
    where: { id: txId, organizationId },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Transaction not found");
  return publicTx(row);
}

export async function listOrganizationChainEvents(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  const network = await getActiveNetworkRow();
  // Events are network-scoped; filter by recent txs belonging to org for privacy
  const orgTxHashes = await prisma.blockchainTransaction.findMany({
    where: { organizationId, networkId: network.id, txHash: { not: null } },
    select: { txHash: true },
    take: 200,
  });
  const hashes = orgTxHashes.map((t) => t.txHash!).filter(Boolean);
  if (hashes.length === 0) {
    return [];
  }
  const events = await prisma.blockchainEvent.findMany({
    where: {
      networkId: network.id,
      txHash: { in: hashes },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return events.map((e) => ({
    id: e.id,
    eventName: e.eventName,
    txHash: e.txHash,
    blockNumber: Number(e.blockNumber),
    logIndex: e.logIndex,
    payload: e.payload,
    processedAt: e.processedAt,
  }));
}

export async function runRetryJob(userId: string, organizationId: string, jobId: string) {
  await assertOrgAdmin(userId, organizationId);
  const job = await prisma.blockchainRetryJob.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!job) throw new AppError(404, "NOT_FOUND", "Retry job not found");

  await prisma.blockchainRetryJob.update({
    where: { id: jobId },
    data: {
      status: "queued",
      nextRunAt: new Date(),
      lockedAt: null,
    },
  });

  return { id: jobId, status: "queued" };
}

export async function processBlockchainJobs(userId: string, limit = 5) {
  const allowed = await userHasRole(userId, [RoleKeys.superAdmin], null);
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Super admin required");
  }

  const claimed = await blockchainJobQueue.claimDue(limit);
  const results = [];

  for (const job of claimed) {
    try {
      if (job.operation === BlockchainOperations.registerOrg) {
        // Re-drive via registration id — requires calling register again; skip auto if already registered
        const reg = await prisma.organizationChainRegistration.findUnique({
          where: { id: job.referenceId },
        });
        if (reg?.status === OrganizationChainRegistrationStatuses.registered) {
          await blockchainJobQueue.complete(job.id);
          results.push({ id: job.id, status: "succeeded", note: "already_registered" });
          continue;
        }
      }
      // Wave 3: mark for manual re-invoke via API; automatic re-submit needs actor context.
      // Fail into queued with message so ops can POST register/anchor again.
      await blockchainJobQueue.fail(
        job.id,
        "Automatic retry requires re-invoking the API operation (register/anchor/revoke)",
        true,
      );
      results.push({ id: job.id, status: "requeued", note: "manual_reinvoke_required" });
    } catch (error) {
      await blockchainJobQueue.fail(
        job.id,
        error instanceof Error ? error.message : String(error),
        true,
      );
      results.push({ id: job.id, status: "failed" });
    }
  }

  return { processed: results.length, results };
}
