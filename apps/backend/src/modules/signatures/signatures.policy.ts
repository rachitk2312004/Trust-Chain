import {
  SignatureAlgorithms,
  SignaturePolicyDefaults,
  SignatureWorkflowKinds,
  SupportedSignatureAlgorithms,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { assertSupportedAlgorithm } from "./signatures.validator.js";

export type SignatureWorkflowKind =
  (typeof SignatureWorkflowKinds)[keyof typeof SignatureWorkflowKinds];

export type OrgSignaturePolicy = {
  defaultAlgorithm: string;
  allowedAlgorithms: string[];
  maxExpirationDays: number | null;
  requireExpiration: boolean;
  defaultExpirationDays: number | null;
  allowDetached: boolean;
  allowDocumentSigning: boolean;
  allowCertificateSigning: boolean;
  allowRevokeBySigner: boolean;
  allowRevokeByAdmin: boolean;
  signableDocumentStatuses: string[];
  signableCertificateStatuses: string[];
};

export function defaultOrgSignaturePolicy(
  overrides?: Partial<OrgSignaturePolicy>,
): OrgSignaturePolicy {
  return {
    defaultAlgorithm: SignaturePolicyDefaults.defaultAlgorithm,
    allowedAlgorithms: [...SignaturePolicyDefaults.allowedAlgorithms],
    maxExpirationDays: SignaturePolicyDefaults.maxExpirationDays,
    requireExpiration: SignaturePolicyDefaults.requireExpiration,
    defaultExpirationDays: SignaturePolicyDefaults.defaultExpirationDays,
    allowDetached: SignaturePolicyDefaults.allowDetached,
    allowDocumentSigning: SignaturePolicyDefaults.allowDocumentSigning,
    allowCertificateSigning: SignaturePolicyDefaults.allowCertificateSigning,
    allowRevokeBySigner: SignaturePolicyDefaults.allowRevokeBySigner,
    allowRevokeByAdmin: SignaturePolicyDefaults.allowRevokeByAdmin,
    signableDocumentStatuses: [...SignaturePolicyDefaults.signableDocumentStatuses],
    signableCertificateStatuses: [...SignaturePolicyDefaults.signableCertificateStatuses],
    ...overrides,
  };
}

export function assertAlgorithmPolicy(algorithm: string, policy: OrgSignaturePolicy): string {
  const resolved = assertSupportedAlgorithm(algorithm);
  if (!policy.allowedAlgorithms.includes(resolved)) {
    throw new AppError(
      400,
      "ALGORITHM_POLICY_DENIED",
      `Algorithm ${resolved} is not allowed by organization policy`,
    );
  }
  return resolved;
}

export function assertWorkflowKindAllowed(
  kind: SignatureWorkflowKind,
  policy: OrgSignaturePolicy,
): void {
  if (kind === SignatureWorkflowKinds.document && !policy.allowDocumentSigning) {
    throw new AppError(403, "WORKFLOW_POLICY_DENIED", "Document signing is disabled by policy");
  }
  if (kind === SignatureWorkflowKinds.certificate && !policy.allowCertificateSigning) {
    throw new AppError(403, "WORKFLOW_POLICY_DENIED", "Certificate signing is disabled by policy");
  }
  if (kind === SignatureWorkflowKinds.detached && !policy.allowDetached) {
    throw new AppError(403, "WORKFLOW_POLICY_DENIED", "Detached signing is disabled by policy");
  }
}

export function assertDocumentSignable(status: string, policy: OrgSignaturePolicy): void {
  if (!policy.signableDocumentStatuses.includes(status)) {
    throw new AppError(
      400,
      "DOCUMENT_NOT_SIGNABLE",
      `Document status '${status}' is not eligible for signing`,
    );
  }
}

export function assertCertificateSignable(status: string, policy: OrgSignaturePolicy): void {
  if (!policy.signableCertificateStatuses.includes(status)) {
    throw new AppError(
      400,
      "CERTIFICATE_NOT_SIGNABLE",
      `Certificate status '${status}' is not eligible for signing`,
    );
  }
}

export function assertExpirationPolicy(
  expiresAt: Date | null,
  policy: OrgSignaturePolicy,
  signedAt: Date = new Date(),
): void {
  if (policy.requireExpiration && !expiresAt) {
    throw new AppError(400, "EXPIRATION_REQUIRED", "Organization policy requires an expiration date");
  }
  if (!expiresAt) return;

  if (Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "INVALID_EXPIRATION", "Invalid expiration date");
  }
  if (expiresAt.getTime() <= signedAt.getTime()) {
    throw new AppError(400, "INVALID_EXPIRATION", "Expiration must be after the signing time");
  }
  if (policy.maxExpirationDays != null) {
    const maxMs = policy.maxExpirationDays * 24 * 60 * 60 * 1000;
    if (expiresAt.getTime() - signedAt.getTime() > maxMs) {
      throw new AppError(
        400,
        "EXPIRATION_TOO_FAR",
        `Expiration exceeds organization maximum of ${policy.maxExpirationDays} days`,
      );
    }
  }
}

export function assertRevocationPolicy(input: {
  isSigner: boolean;
  isAdmin: boolean;
  policy: OrgSignaturePolicy;
}): void {
  if (input.isSigner && input.policy.allowRevokeBySigner) return;
  if (input.isAdmin && input.policy.allowRevokeByAdmin) return;
  throw new AppError(403, "REVOKE_POLICY_DENIED", "Revocation is not allowed by organization policy");
}

/**
 * Validates algorithm + expiration + workflow kind before signing.
 */
export function validateSignPolicy(input: {
  kind: SignatureWorkflowKind;
  algorithm?: string | null;
  expiresAt?: Date | null;
  signedAt?: Date;
  policy?: OrgSignaturePolicy;
}): { algorithm: string; policy: OrgSignaturePolicy } {
  const policy = input.policy ?? defaultOrgSignaturePolicy();
  assertWorkflowKindAllowed(input.kind, policy);
  const algorithm = assertAlgorithmPolicy(
    input.algorithm ?? policy.defaultAlgorithm ?? SignatureAlgorithms.rsaSha256,
    policy,
  );
  assertExpirationPolicy(input.expiresAt ?? null, policy, input.signedAt ?? new Date());
  return { algorithm, policy };
}

export function isReservedAlgorithm(algorithm: string): boolean {
  return algorithm === SignatureAlgorithms.ed25519;
}

export function listSupportedAlgorithms(): readonly string[] {
  return SupportedSignatureAlgorithms;
}
