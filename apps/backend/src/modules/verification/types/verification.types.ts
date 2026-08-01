import type { VerificationInternalStatuses, VerificationOutcomes } from "@trustchain/config";

export type VerificationInternalStatus =
  (typeof VerificationInternalStatuses)[keyof typeof VerificationInternalStatuses];

export type VerificationOutcome = (typeof VerificationOutcomes)[keyof typeof VerificationOutcomes];

export type VerificationCheck = {
  name: string;
  passed: boolean;
  code?: string;
  detail?: string;
};

export type VerificationProof = {
  proofOfIntegrity: string | null;
  proofTimestamp: string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: number | null;
};

export type VerificationReport = {
  verificationId: string;
  verificationCode: string;
  organizationId: string;
  documentId: string;
  versionNumber: number | null;
  contentHash: string | null;
  blockchainStatus: string;
  revocationStatus: string;
  verificationTimestamp: string;
  verificationResult: VerificationOutcome;
  status: VerificationInternalStatus;
  failureReasons: string[];
  checks: VerificationCheck[];
  cached: boolean;
  proofOfIntegrity: string | null;
  proofTimestamp: string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: number | null;
};

export type VerifyOptions = {
  rehashFromR2?: boolean;
  requireAnchor?: boolean;
  requireLiveChain?: boolean;
};

export type VerificationContext = {
  organizationId: string;
  documentId: string;
  userId: string;
  document: {
    id: string;
    organizationId: string;
    createdById: string;
    status: string;
    deletedAt: Date | null;
    expiresAt: Date | null;
    archivedAt: Date | null;
    currentVersionId: string | null;
  };
  version: {
    id: string;
    versionNumber: number;
    contentHash: string;
    objectKey: string;
  } | null;
  expectedContentHash?: string | null;
  options: VerifyOptions;
  networkKey: string;
  anchor: {
    status: string;
    contentHash: string;
    versionNumber: number;
    blockNumber: bigint | null;
    anchorTxHash: string | null;
    revokeTxHash: string | null;
  } | null;
  liveChain?: {
    exists: boolean;
    revoked: boolean;
    contentHash: string | null;
  } | null;
  r2Hash?: string | null;
  r2Exists?: boolean;
};

export type Validator = {
  name: string;
  run: (ctx: VerificationContext) => Promise<VerificationCheck> | VerificationCheck;
};
