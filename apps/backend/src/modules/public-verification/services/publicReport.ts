import type { VerificationReport } from "../../verification/types/verification.types.js";
import { buildPublicUrls, signPublicReport } from "../utils/crypto.js";

export type PublicVerificationReport = {
  publicVerifyCode: string | null;
  verificationCode: string | null;
  documentPublicId: string | null;
  versionNumber: number | null;
  contentHash: string | null;
  networkName: string | null;
  blockNumber: number | null;
  transactionHash: string | null;
  revocationStatus: string | null;
  proofOfIntegrity: string | null;
  proofTimestamp: string | null;
  verificationTimestamp: string;
  verificationResult: string;
  reportSignature: string;
  reportChecksum: string;
  issuedAt: string;
  expiresAt: string;
  urls: Record<string, string | null>;
};

export function toPublicReport(input: {
  report: VerificationReport;
  publicVerifyCode: string | null;
}): PublicVerificationReport {
  const base = {
    publicVerifyCode: input.publicVerifyCode,
    verificationCode: input.report.verificationCode,
    documentPublicId: input.publicVerifyCode,
    versionNumber: input.report.versionNumber,
    contentHash: input.report.contentHash,
    networkName: input.report.networkName,
    blockNumber: input.report.blockNumber,
    transactionHash: input.report.transactionHash,
    revocationStatus: input.report.revocationStatus,
    proofOfIntegrity: input.report.proofOfIntegrity,
    proofTimestamp: input.report.proofTimestamp,
    verificationTimestamp: input.report.verificationTimestamp,
    verificationResult: input.report.verificationResult,
  };

  const signed = signPublicReport(base as unknown as Record<string, unknown>);
  return {
    ...base,
    ...signed,
    urls: buildPublicUrls({
      hash: input.report.contentHash ?? undefined,
      verificationCode: input.report.verificationCode,
      publicVerifyCode: input.publicVerifyCode ?? undefined,
      transactionHash: input.report.transactionHash ?? undefined,
    }),
  };
}
