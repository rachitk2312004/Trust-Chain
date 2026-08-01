import { DocumentPermissions } from "@trustchain/config";
import { permissionAtLeast } from "../../documents/documents.access.js";
import { resolveDocumentPermission } from "../../documents/documents.access.js";
import type { VerificationCheck, Validator } from "../types/verification.types.js";

export const documentPresenceValidator: Validator = {
  name: "document_present",
  run(ctx): VerificationCheck {
    if (!ctx.document) {
      return { name: "document_present", passed: false, code: "document_missing" };
    }
    return { name: "document_present", passed: true };
  },
};

export const softDeleteValidator: Validator = {
  name: "not_soft_deleted",
  run(ctx): VerificationCheck {
    if (ctx.document.deletedAt) {
      return {
        name: "not_soft_deleted",
        passed: false,
        code: "document_deleted",
        detail: "Document is soft-deleted",
      };
    }
    return { name: "not_soft_deleted", passed: true };
  },
};

export const versionValidator: Validator = {
  name: "version_present",
  run(ctx): VerificationCheck {
    if (!ctx.version) {
      return { name: "version_present", passed: false, code: "version_missing" };
    }
    return {
      name: "version_present",
      passed: true,
      detail: `v${ctx.version.versionNumber}`,
    };
  },
};

export const ownershipValidator: Validator = {
  name: "ownership_org_match",
  run(ctx): VerificationCheck {
    if (ctx.document.organizationId !== ctx.organizationId) {
      return { name: "ownership_org_match", passed: false, code: "ownership_mismatch" };
    }
    return { name: "ownership_org_match", passed: true };
  },
};

export const aclValidator: Validator = {
  name: "acl_allowed",
  async run(ctx): Promise<VerificationCheck> {
    const need =
      ctx.options.rehashFromR2 === true ? DocumentPermissions.download : DocumentPermissions.view;
    const have = await resolveDocumentPermission(ctx.userId, ctx.document);
    if (!permissionAtLeast(have, need)) {
      return { name: "acl_allowed", passed: false, code: "acl_denied", detail: `need ${need}` };
    }
    return { name: "acl_allowed", passed: true };
  },
};

export const expiryValidator: Validator = {
  name: "document_not_expired",
  run(ctx): VerificationCheck {
    if (ctx.document.expiresAt && ctx.document.expiresAt <= new Date()) {
      return { name: "document_not_expired", passed: false, code: "document_expired" };
    }
    return { name: "document_not_expired", passed: true };
  },
};

export const hashValidator: Validator = {
  name: "hash_matches",
  run(ctx): VerificationCheck {
    if (!ctx.version) {
      return { name: "hash_matches", passed: false, code: "version_missing" };
    }
    const stored = ctx.version.contentHash.toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(stored)) {
      return {
        name: "hash_matches",
        passed: false,
        code: "hash_invalid",
        detail: "bad stored hash",
      };
    }
    if (ctx.expectedContentHash) {
      const expected = ctx.expectedContentHash.toLowerCase().replace(/^0x/, "");
      if (expected !== stored) {
        return {
          name: "hash_matches",
          passed: false,
          code: "hash_tampered",
          detail: "expectedContentHash does not match stored version hash",
        };
      }
    }
    return { name: "hash_matches", passed: true };
  },
};

export const integrityValidator: Validator = {
  name: "r2_integrity",
  run(ctx): VerificationCheck {
    if (!ctx.options.rehashFromR2) {
      return { name: "r2_integrity", passed: true, detail: "skipped" };
    }
    if (ctx.r2Exists === false) {
      return { name: "r2_integrity", passed: false, code: "r2_missing" };
    }
    if (!ctx.version || !ctx.r2Hash) {
      return { name: "r2_integrity", passed: false, code: "r2_missing" };
    }
    if (ctx.r2Hash.toLowerCase() !== ctx.version.contentHash.toLowerCase()) {
      return {
        name: "r2_integrity",
        passed: false,
        code: "r2_hash_mismatch",
        detail: "R2 object hash does not match PostgreSQL contentHash",
      };
    }
    return { name: "r2_integrity", passed: true };
  },
};

export const blockchainValidator: Validator = {
  name: "blockchain_anchor",
  run(ctx): VerificationCheck {
    const requireAnchor = ctx.options.requireAnchor !== false;
    if (!ctx.anchor) {
      if (!requireAnchor) {
        return { name: "blockchain_anchor", passed: true, detail: "anchor not required" };
      }
      return { name: "blockchain_anchor", passed: false, code: "anchor_missing" };
    }
    if (
      ctx.version &&
      ctx.anchor.contentHash.toLowerCase() !== ctx.version.contentHash.toLowerCase()
    ) {
      return {
        name: "blockchain_anchor",
        passed: false,
        code: "anchor_hash_mismatch",
        detail: "Anchor contentHash does not match version",
      };
    }
    if (ctx.liveChain && ctx.options.requireLiveChain) {
      if (!ctx.liveChain.exists) {
        return {
          name: "blockchain_anchor",
          passed: false,
          code: "anchor_missing",
          detail: "live chain miss",
        };
      }
      if (
        ctx.liveChain.contentHash &&
        ctx.version &&
        ctx.liveChain.contentHash.toLowerCase() !== ctx.version.contentHash.toLowerCase()
      ) {
        return {
          name: "blockchain_anchor",
          passed: false,
          code: "chain_hash_mismatch",
        };
      }
    }
    if (ctx.anchor.status === "pending" || ctx.anchor.status === "failed") {
      return {
        name: "blockchain_anchor",
        passed: false,
        code: "anchor_not_confirmed",
        detail: ctx.anchor.status,
      };
    }
    return { name: "blockchain_anchor", passed: true, detail: ctx.anchor.status };
  },
};

export const revocationValidator: Validator = {
  name: "not_revoked",
  run(ctx): VerificationCheck {
    if (ctx.anchor?.status === "revoked" || ctx.liveChain?.revoked) {
      return { name: "not_revoked", passed: false, code: "revoked" };
    }
    return { name: "not_revoked", passed: true };
  },
};

export const defaultValidators: Validator[] = [
  documentPresenceValidator,
  softDeleteValidator,
  versionValidator,
  ownershipValidator,
  aclValidator,
  expiryValidator,
  hashValidator,
  integrityValidator,
  blockchainValidator,
  revocationValidator,
];
