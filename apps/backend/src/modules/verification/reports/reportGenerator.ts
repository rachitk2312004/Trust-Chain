import type {
  VerificationCheck,
  VerificationInternalStatus,
  VerificationOutcome,
  VerificationReport,
} from "../types/verification.types.js";

export function buildVerificationReport(input: {
  verificationId: string;
  verificationCode: string;
  organizationId: string;
  documentId: string;
  versionNumber: number | null;
  contentHash: string | null;
  blockchainStatus: string;
  revocationStatus: string;
  status: VerificationInternalStatus;
  outcome: VerificationOutcome;
  failureReasons: string[];
  checks: VerificationCheck[];
  cached?: boolean;
  proofOfIntegrity: string | null;
  proofTimestamp: Date | string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: number | bigint | null;
  verifiedAt?: Date;
}): VerificationReport {
  const ts = (input.verifiedAt ?? new Date()).toISOString();
  const proofTimestamp =
    input.proofTimestamp == null
      ? null
      : typeof input.proofTimestamp === "string"
        ? input.proofTimestamp
        : input.proofTimestamp.toISOString();

  return {
    verificationId: input.verificationId,
    verificationCode: input.verificationCode,
    organizationId: input.organizationId,
    documentId: input.documentId,
    versionNumber: input.versionNumber,
    contentHash: input.contentHash,
    blockchainStatus: input.blockchainStatus,
    revocationStatus: input.revocationStatus,
    verificationTimestamp: ts,
    verificationResult: input.outcome,
    status: input.status,
    failureReasons: input.failureReasons,
    checks: input.checks,
    cached: Boolean(input.cached),
    proofOfIntegrity: input.proofOfIntegrity,
    proofTimestamp,
    networkName: input.networkName,
    transactionHash: input.transactionHash,
    blockNumber:
      input.blockNumber == null
        ? null
        : typeof input.blockNumber === "bigint"
          ? Number(input.blockNumber)
          : input.blockNumber,
  };
}
