import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import {
  ApiKeyStatuses,
  DeveloperIdPrefixes,
  RoleKeys,
  ServiceAccountStatuses,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { writeAdminAudit } from "../admin/admin.audit.js";
import {
  extractApiKeyFromAuthorization,
  hashDeveloperSecret,
  secretsEqual,
} from "./developer.auth.js";
import {
  assertIdempotencyRequestMatch,
  findIdempotencyRecord,
  hashRequestPayload,
  normalizeIdempotencyKey,
  saveIdempotencyRecord,
} from "./developer.idempotency.js";
import {
  defaultApiKeyRateLimit,
  parseRateLimitConfig,
  resolveApiKeyStatus,
} from "./developer.keys.js";
import { recordApiUsage } from "./developer.metrics.js";
import { assertApiKeyRequestLimit } from "./developer.ratelimit.js";
import {
  assertCapability,
  parseScopes,
  type ScopeSet,
  toScopeSet,
} from "./developer.scopes.js";

export type DeveloperApiPrincipal = {
  apiKeyId: string;
  organizationId: string;
  serviceAccountId: string | null;
  scopes: string[];
  scopeSet: ScopeSet;
  actorUserId: string | null;
  keyPrefix: string;
  authType: "api_key" | "service_account";
};

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    developer?: DeveloperApiPrincipal;
    idempotencyKey?: string | null;
    idempotencyReplay?: boolean;
  }
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

export function attachRequestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = headerValue(req, "x-request-id")?.trim();
    const requestId =
      incoming && incoming.length > 0 && incoming.length <= 128 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  };
}

async function resolveActorUserId(input: {
  createdById: string | null;
  organizationId: string;
  serviceAccountCreatedById?: string | null;
}): Promise<string | null> {
  if (input.createdById) return input.createdById;
  if (input.serviceAccountCreatedById) return input.serviceAccountCreatedById;

  const binding = await prisma.roleBinding.findFirst({
    where: {
      organizationId: input.organizationId,
      role: { key: { in: [RoleKeys.orgAdmin, RoleKeys.superAdmin] } },
    },
    orderBy: { createdAt: "asc" },
  });
  return binding?.userId ?? null;
}

async function authenticateApiKey(plaintext: string): Promise<DeveloperApiPrincipal> {
  const keyHash = hashDeveloperSecret(plaintext);
  const row = await prisma.apiKey.findFirst({
    where: { keyHash },
    include: { serviceAccount: true },
  });
  if (!row) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid API key");
  }

  const status = resolveApiKeyStatus({ status: row.status, expiresAt: row.expiresAt });
  if (status !== ApiKeyStatuses.active) {
    throw new AppError(401, "UNAUTHORIZED", `API key is ${status}`);
  }

  if (row.serviceAccount) {
    if (row.serviceAccount.status === ServiceAccountStatuses.suspended) {
      throw new AppError(403, "FORBIDDEN", "Service account is suspended");
    }
  }

  const scopes = parseScopes(row.scopesJson);
  const actorUserId = await resolveActorUserId({
    createdById: row.createdById,
    organizationId: row.organizationId,
    serviceAccountCreatedById: row.serviceAccount?.createdById ?? null,
  });

  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    apiKeyId: row.id,
    organizationId: row.organizationId,
    serviceAccountId: row.serviceAccountId,
    scopes,
    scopeSet: toScopeSet(scopes),
    actorUserId,
    keyPrefix: row.keyPrefix,
    authType: row.serviceAccountId ? "service_account" : "api_key",
  };
}

async function authenticateServiceAccountSecret(
  plaintext: string,
): Promise<DeveloperApiPrincipal> {
  const secretHash = hashDeveloperSecret(plaintext);
  const sa = await prisma.serviceAccount.findFirst({
    where: { secretHash },
    include: {
      apiKeys: {
        where: { status: ApiKeyStatuses.active },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!sa) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid service account credentials");
  }
  if (sa.status === ServiceAccountStatuses.suspended) {
    throw new AppError(403, "FORBIDDEN", "Service account is suspended");
  }

  const linkedKey = sa.apiKeys[0];
  if (!linkedKey) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Service account has no active API key; create one linked to this account",
    );
  }
  const scopes = parseScopes(linkedKey.scopesJson);
  const actorUserId = await resolveActorUserId({
    createdById: linkedKey.createdById ?? sa.createdById,
    organizationId: sa.organizationId,
    serviceAccountCreatedById: sa.createdById,
  });

  return {
    apiKeyId: linkedKey.id,
    organizationId: sa.organizationId,
    serviceAccountId: sa.id,
    scopes,
    scopeSet: toScopeSet(scopes),
    actorUserId,
    keyPrefix: linkedKey.keyPrefix,
    authType: "service_account",
  };
}

export function requireDeveloperApiAuth(): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = extractApiKeyFromAuthorization(req.headers.authorization);
      if (!token) {
        throw new AppError(401, "UNAUTHORIZED", "Missing Authorization: Bearer tc_***");
      }

      let principal: DeveloperApiPrincipal;
      if (
        token.startsWith(`${DeveloperIdPrefixes.apiKeyLive}_`) ||
        token.startsWith(`${DeveloperIdPrefixes.apiKeyTest}_`)
      ) {
        principal = await authenticateApiKey(token);
      } else if (token.startsWith("sa_sec_")) {
        principal = await authenticateServiceAccountSecret(token);
      } else {
        // Attempt API key hash lookup for non-prefixed tokens
        principal = await authenticateApiKey(token);
      }

      req.developer = principal;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireDeveloperCapability(
  capability:
    | "documents.read"
    | "documents.write"
    | "certificates.read"
    | "certificates.write"
    | "signatures.read"
    | "signatures.write"
    | "usage.read",
): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!req.developer) {
        throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
      }
      assertCapability(req.developer.scopeSet, capability);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function enforceDeveloperRateLimit(): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.developer) {
        throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
      }
      const { assertOrganizationRequestQuota } = await import("./developer.quotas.js");
      await assertOrganizationRequestQuota(req.developer.organizationId);

      const key = await prisma.apiKey.findUnique({
        where: { id: req.developer.apiKeyId },
        select: { rateLimitJson: true },
      });
      const config = key?.rateLimitJson
        ? parseRateLimitConfig(key.rateLimitJson)
        : defaultApiKeyRateLimit();
      await assertApiKeyRequestLimit(req.developer.apiKeyId, config);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function trackDeveloperApiUsage(): RequestHandler {
  return (req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (!req.developer) return;
      void recordApiUsage({
        organizationId: req.developer.organizationId,
        apiKeyId: req.developer.apiKeyId,
        serviceAccountId: req.developer.serviceAccountId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        scope: req.developer.scopes.join(","),
        requestId: req.requestId ?? null,
        durationMs: Date.now() - started,
      }).catch(() => undefined);

      void writeAdminAudit({
        actorUserId: req.developer.actorUserId,
        action: "developer.api.request",
        targetType: "api_key",
        targetId: req.developer.apiKeyId,
        organizationId: req.developer.organizationId,
        success: res.statusCode < 500,
        meta: {
          method: req.method,
          path: req.originalUrl || req.path,
          statusCode: res.statusCode,
          requestId: req.requestId,
          authType: req.developer.authType,
        },
      }).catch(() => undefined);
    });
    next();
  };
}

/**
 * Idempotency middleware for mutating routes.
 * On cache hit, short-circuits with stored response.
 */
export function withIdempotency(): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.developer) {
        throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
      }
      if (req.method.toUpperCase() === "GET" || req.method.toUpperCase() === "HEAD") {
        next();
        return;
      }

      const idempotencyKey = normalizeIdempotencyKey(headerValue(req, "idempotency-key"));
      req.idempotencyKey = idempotencyKey;
      if (!idempotencyKey) {
        next();
        return;
      }

      const requestHash = hashRequestPayload({
        method: req.method,
        path: req.path,
        body: req.body,
      });

      const existing = await findIdempotencyRecord({
        organizationId: req.developer.organizationId,
        apiKeyId: req.developer.apiKeyId,
        idempotencyKey,
      });

      if (existing) {
        assertIdempotencyRequestMatch(existing.requestHash, requestHash);
        req.idempotencyReplay = true;
        res.setHeader("Idempotency-Replayed", "true");
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const status = res.statusCode || 200;
        if (status >= 200 && status < 500 && req.developer && idempotencyKey) {
          void saveIdempotencyRecord({
            organizationId: req.developer.organizationId,
            apiKeyId: req.developer.apiKeyId,
            idempotencyKey,
            requestHash,
            responseStatus: status,
            responseBody: body,
          }).catch(() => undefined);
        }
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Test helpers */
export function verifyBearerLooksLikeApiKey(token: string): boolean {
  return (
    token.startsWith(`${DeveloperIdPrefixes.apiKeyLive}_`) ||
    token.startsWith(`${DeveloperIdPrefixes.apiKeyTest}_`)
  );
}

export function secretsMatch(a: string, bHash: string): boolean {
  return secretsEqual(a, bHash);
}
