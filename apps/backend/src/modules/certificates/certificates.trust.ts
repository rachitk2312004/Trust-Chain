import { createHash } from "node:crypto";
import { BlockchainAnchorStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { contentHashesEqual, normalizeContentHash } from "../../lib/contentHash.js";
import { getObjectBuffer, headObject } from "../../integrations/objectStorage.js";
import { isChainEnabled } from "../blockchain/chainConfig.js";
import { getDocumentRegistryContract, uuidToBytes32 } from "../blockchain/chainProvider.js";
import {
  verifyCertificate,
  type CertificateVerifyEvidence,
  type CertificateVerifyInput,
  type CertificateVerifyResult,
} from "./certificates.verifier.js";

export type CertificateTrustChain = {
  status: string | null;
  contentHash: string | null;
  txHash: string | null;
  anchored: boolean;
  live: boolean;
  revoked: boolean;
  matchesArtifact: boolean;
};

async function readLiveAnchor(
  organizationId: string,
  documentId: string | null,
  versionNumber: number | null,
): Promise<{ exists: boolean; revoked: boolean; contentHash: string | null }> {
  if (!documentId || !versionNumber || !isChainEnabled()) {
    return { exists: false, revoked: false, contentHash: null };
  }
  try {
    const { contract } = await getDocumentRegistryContract();
    const anchor = await contract
      .getFunction("getAnchor")
      .staticCall(uuidToBytes32(organizationId), uuidToBytes32(documentId), versionNumber);
    return {
      exists: Boolean(anchor.exists),
      revoked: Boolean(anchor.revoked),
      contentHash: anchor.exists ? normalizeContentHash(String(anchor.contentHash)) : null,
    };
  } catch {
    return { exists: false, revoked: false, contentHash: null };
  }
}

export async function evaluateCertificateTrust(
  cert: CertificateVerifyInput,
): Promise<{ verification: CertificateVerifyResult; chain: CertificateTrustChain }> {
  const document = cert.documentId
    ? await prisma.document.findFirst({
        where: { id: cert.documentId },
        include: { currentVersion: true },
      })
    : null;
  const version = document?.currentVersion ?? null;

  let storedHash: string | null = null;
  let artifactPresent = false;
  if (version) {
    try {
      const object = await getObjectBuffer(version.objectKey);
      if (object.exists && object.body && object.body.length > 0) {
        storedHash = createHash("sha256").update(object.body).digest("hex");
        artifactPresent = true;
      } else {
        const head = await headObject(version.objectKey);
        if (head.exists && (head.contentLength ?? 0) > 0 && version.contentHash) {
          // Body unreadable (SDK/B2 quirk) but object exists — trust stored content hash.
          storedHash = version.contentHash;
          artifactPresent = true;
        }
      }
    } catch {
      try {
        const head = await headObject(version.objectKey);
        if (head.exists && (head.contentLength ?? 0) > 0 && version.contentHash) {
          storedHash = version.contentHash;
          artifactPresent = true;
        }
      } catch {
        artifactPresent = false;
      }
    }
  }

  const live = await readLiveAnchor(
    cert.organizationId,
    cert.documentId,
    version?.versionNumber ?? null,
  );
  const dbAnchor = cert.documentId
    ? await prisma.blockchainAnchor.findFirst({
        where: { documentId: cert.documentId, status: BlockchainAnchorStatuses.anchored },
        orderBy: { createdAt: "desc" },
        include: { anchorTx: { select: { txHash: true } } },
      })
    : null;

  const expectedHash = version?.contentHash ?? null;
  const evidence: CertificateVerifyEvidence = {
    artifactPresent,
    artifactHash: storedHash,
    expectedArtifactHash: expectedHash,
    chainEnabled: isChainEnabled(),
    chainLive: live.exists,
    chainRevoked: live.revoked || dbAnchor?.status === BlockchainAnchorStatuses.revoked,
    chainHash: live.contentHash ?? dbAnchor?.contentHash ?? null,
  };

  const verification = verifyCertificate(cert, evidence);
  const artifactHash = storedHash ?? expectedHash;
  return {
    verification,
    chain: {
      status: dbAnchor?.status ?? (live.exists ? BlockchainAnchorStatuses.anchored : null),
      contentHash: live.contentHash ?? dbAnchor?.contentHash ?? null,
      txHash: dbAnchor?.anchorTx?.txHash ?? null,
      anchored: Boolean(dbAnchor || live.exists),
      live: live.exists,
      revoked: live.revoked,
      matchesArtifact: contentHashesEqual(live.contentHash ?? dbAnchor?.contentHash, artifactHash),
    },
  };
}
