import { createHash } from "node:crypto";
import type { VerifyOptions } from "../types/verification.types.js";

export function buildVerificationCacheKey(input: {
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  contentHash: string;
  options: VerifyOptions;
}): string {
  const fingerprint = JSON.stringify({
    o: input.organizationId,
    d: input.documentId,
    v: input.documentVersionId,
    h: input.contentHash.toLowerCase(),
    rehash: Boolean(input.options.rehashFromR2),
    requireAnchor: input.options.requireAnchor !== false,
    requireLiveChain: Boolean(input.options.requireLiveChain),
  });
  return createHash("sha256").update(fingerprint).digest("hex");
}
