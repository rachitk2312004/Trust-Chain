import {
  IntegrationAuthModes,
  IntegrationCredentialKinds,
  IntegrationDefaults,
  IntegrationStatuses,
  IntegrationSyncJobStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  assertOAuthValid,
  exchangeAuthorizationCode,
  generateApiKeyMaterial,
  getConnector,
  hashSecret,
  listConnectors,
  maskSecret,
  startOAuthFlow,
  validateOAuthCallback,
} from "./integration.oauth.js";
import {
  buildSyncDashboard,
  executeIntegrationSync,
  matchSubscriptions,
  normalizeSyncPolicy,
  rotateCredential,
  shouldRunSync,
} from "./integration.sync.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toPublicIntegration(row: {
  id: string;
  organizationId: string;
  connectorKey: string;
  name: string;
  status: string;
  authMode: string;
  syncIntervalMinutes: number;
  syncMode: string;
  scopesJson: Prisma.JsonValue;
  configJson: Prisma.JsonValue;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const connector = getConnector(row.connectorKey);
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectorKey: row.connectorKey,
    connectorName: connector.name,
    category: connector.category,
    name: row.name,
    status: row.status,
    authMode: row.authMode,
    syncIntervalMinutes: row.syncIntervalMinutes,
    syncMode: row.syncMode,
    scopes: asStringArray(row.scopesJson),
    config: row.configJson,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicCredential(row: {
  id: string;
  kind: string;
  version: number;
  secretLast4: string;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    secretLast4: row.secretLast4,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    rotatedAt: row.rotatedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function upsertSubscriptions(
  organizationId: string,
  integrationId: string,
  eventTypes: string[],
) {
  for (const eventType of eventTypes.slice(
    0,
    IntegrationDefaults.maxSubscriptionsPerIntegration,
  )) {
    await prisma.integrationEventSubscription.upsert({
      where: {
        integrationId_eventType: { integrationId, eventType },
      },
      create: {
        organizationId,
        integrationId,
        eventType,
        enabled: true,
      },
      update: { enabled: true },
    });
  }
}

export async function listIntegrations(query: {
  organizationId: string;
  status?: string;
  connectorKey?: string;
  category?: string;
}) {
  const catalog = listConnectors(query.category);
  const integrations = await prisma.ecosystemIntegration.findMany({
    where: {
      organizationId: query.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.connectorKey ? { connectorKey: query.connectorKey } : {}),
      ...(query.category
        ? { connectorKey: { in: catalog.map((c) => c.key) } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      credentials: {
        where: { revokedAt: null },
        orderBy: { version: "desc" },
        take: 1,
      },
      subscriptions: true,
    },
  });

  const recentJobs = await prisma.integrationSyncJob.findMany({
    where: { organizationId: query.organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    organizationId: query.organizationId,
    catalog: catalog.map((c) => ({
      key: c.key,
      name: c.name,
      category: c.category,
      authMode: c.authMode,
      description: c.description,
      defaultScopes: c.defaultScopes,
      eventTypes: c.eventTypes,
    })),
    integrations: integrations.map((row) => ({
      ...toPublicIntegration(row),
      credential: row.credentials[0] ? toPublicCredential(row.credentials[0]) : null,
      subscriptions: row.subscriptions.map((s) => ({
        id: s.id,
        eventType: s.eventType,
        enabled: s.enabled,
      })),
    })),
    dashboard: buildSyncDashboard({
      integrations: integrations.map((i) => ({
        status: i.status,
        connectorKey: i.connectorKey,
      })),
      recentJobs: recentJobs.map((j) => ({ status: j.status })),
    }),
    recentSyncJobs: recentJobs.map((j) => ({
      id: j.id,
      integrationId: j.integrationId,
      status: j.status,
      mode: j.mode,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function createIntegration(input: {
  organizationId: string;
  connectorKey: string;
  name: string;
  authMode?: string;
  syncIntervalMinutes?: number;
  syncMode?: string;
  scopes?: string[];
  config?: Record<string, unknown>;
  apiKey?: string;
  eventTypes?: string[];
  createdById?: string | null;
}) {
  const connector = getConnector(input.connectorKey);
  const authMode = input.authMode ?? connector.authMode;
  const policy = normalizeSyncPolicy({
    intervalMinutes: input.syncIntervalMinutes,
    mode: input.syncMode,
    scopes: input.scopes ?? connector.defaultScopes,
  });

  if (authMode === IntegrationAuthModes.api_key && !input.apiKey) {
    // auto-generate foundation API key when none provided
  }

  try {
    const row = await prisma.ecosystemIntegration.create({
      data: {
        organizationId: input.organizationId,
        connectorKey: input.connectorKey,
        name: input.name,
        status: IntegrationStatuses.draft,
        authMode,
        syncIntervalMinutes: policy.intervalMinutes,
        syncMode: policy.mode,
        scopesJson: policy.scopes,
        configJson: (input.config ?? {}) as Prisma.InputJsonValue,
        createdById: input.createdById ?? null,
      },
    });

    let issuedSecret: string | null = null;
    if (authMode === IntegrationAuthModes.api_key) {
      const secret = input.apiKey ?? generateApiKeyMaterial(input.connectorKey);
      issuedSecret = input.apiKey ? null : secret;
      const masked = maskSecret(secret);
      await prisma.integrationCredential.create({
        data: {
          organizationId: input.organizationId,
          integrationId: row.id,
          kind: IntegrationCredentialKinds.api_key,
          version: 1,
          secretHash: hashSecret(secret),
          secretLast4: masked.last4,
          secretCipher: masked.cipher,
        },
      });
      await prisma.ecosystemIntegration.update({
        where: { id: row.id },
        data: { status: IntegrationStatuses.connected },
      });
    }

    const eventTypes = input.eventTypes?.length
      ? input.eventTypes
      : connector.eventTypes.slice(0, 2);
    await upsertSubscriptions(input.organizationId, row.id, eventTypes);

    const refreshed = await prisma.ecosystemIntegration.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        credentials: { where: { revokedAt: null }, orderBy: { version: "desc" }, take: 1 },
        subscriptions: true,
      },
    });

    return {
      integration: {
        ...toPublicIntegration(refreshed),
        credential: refreshed.credentials[0]
          ? toPublicCredential(refreshed.credentials[0])
          : null,
        subscriptions: refreshed.subscriptions.map((s) => ({
          id: s.id,
          eventType: s.eventType,
          enabled: s.enabled,
        })),
      },
      issuedApiKey: issuedSecret,
    };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new AppError(409, "CONFLICT", "Integration name already exists for connector");
    }
    throw err;
  }
}

export async function patchIntegration(
  id: string,
  input: {
    name?: string;
    status?: string;
    syncIntervalMinutes?: number;
    syncMode?: string;
    scopes?: string[];
    config?: Record<string, unknown>;
    eventTypes?: string[];
    rotateCredential?: boolean;
  },
) {
  const existing = await prisma.ecosystemIntegration.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Integration not found");

  let rotated: { version: number; secretLast4: string; issuedSecret?: string } | null = null;

  if (input.rotateCredential) {
    const latest = await prisma.integrationCredential.findFirst({
      where: { integrationId: id, revokedAt: null },
      orderBy: { version: "desc" },
    });
    const kind =
      latest?.kind ??
      (existing.authMode === IntegrationAuthModes.api_key
        ? IntegrationCredentialKinds.api_key
        : IntegrationCredentialKinds.oauth_token);
    const next = rotateCredential({
      kind,
      connectorKey: existing.connectorKey,
      previousVersion: latest?.version ?? 0,
    });
    if (latest) {
      await prisma.integrationCredential.update({
        where: { id: latest.id },
        data: { revokedAt: next.rotatedAt },
      });
    }
    await prisma.integrationCredential.create({
      data: {
        organizationId: existing.organizationId,
        integrationId: id,
        kind,
        version: next.version,
        secretHash: next.secretHash,
        secretLast4: next.secretLast4,
        secretCipher: next.secretCipher,
        rotatedAt: next.rotatedAt,
      },
    });
    rotated = {
      version: next.version,
      secretLast4: next.secretLast4,
      issuedSecret: kind === IntegrationCredentialKinds.api_key ? next.secret : undefined,
    };
  }

  if (input.eventTypes) {
    await upsertSubscriptions(existing.organizationId, id, input.eventTypes);
  }

  const updated = await prisma.ecosystemIntegration.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.syncIntervalMinutes !== undefined
        ? { syncIntervalMinutes: input.syncIntervalMinutes }
        : {}),
      ...(input.syncMode !== undefined ? { syncMode: input.syncMode } : {}),
      ...(input.scopes !== undefined ? { scopesJson: input.scopes } : {}),
      ...(input.config !== undefined
        ? { configJson: input.config as Prisma.InputJsonValue }
        : {}),
    },
    include: {
      credentials: { where: { revokedAt: null }, orderBy: { version: "desc" }, take: 1 },
      subscriptions: true,
    },
  });

  return {
    integration: {
      ...toPublicIntegration(updated),
      credential: updated.credentials[0] ? toPublicCredential(updated.credentials[0]) : null,
      subscriptions: updated.subscriptions.map((s) => ({
        id: s.id,
        eventType: s.eventType,
        enabled: s.enabled,
      })),
    },
    rotation: rotated,
  };
}

export async function handleOAuth(input: {
  organizationId: string;
  integrationId: string;
  action: "start" | "complete";
  userId: string;
  redirectUri?: string;
  clientId?: string;
  scopes?: string[];
  state?: string;
  code?: string;
}) {
  const integration = await prisma.ecosystemIntegration.findFirst({
    where: { id: input.integrationId, organizationId: input.organizationId },
  });
  if (!integration) throw new AppError(404, "NOT_FOUND", "Integration not found");

  if (input.action === "start") {
    if (!input.redirectUri || !input.clientId) {
      throw new AppError(400, "VALIDATION_ERROR", "redirectUri and clientId required to start OAuth");
    }
    const started = startOAuthFlow({
      connectorKey: integration.connectorKey,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      scopes: input.scopes ?? asStringArray(integration.scopesJson),
    });
    const session = await prisma.integrationOAuthSession.create({
      data: {
        organizationId: input.organizationId,
        integrationId: integration.id,
        userId: input.userId,
        state: started.state,
        codeVerifier: started.codeVerifier,
        redirectUri: input.redirectUri,
        scopesJson: input.scopes ?? asStringArray(integration.scopesJson),
        expiresAt: started.expiresAt,
      },
    });
    return {
      action: "start" as const,
      authorizeUrl: started.authorizeUrl,
      state: started.state,
      expiresAt: started.expiresAt.toISOString(),
      sessionId: session.id,
    };
  }

  if (!input.state || !input.code) {
    throw new AppError(400, "VALIDATION_ERROR", "state and code required to complete OAuth");
  }
  const session = await prisma.integrationOAuthSession.findFirst({
    where: {
      state: input.state,
      organizationId: input.organizationId,
      integrationId: integration.id,
    },
  });
  if (!session) throw new AppError(404, "NOT_FOUND", "OAuth session not found");

  const check = validateOAuthCallback({
    expectedState: session.state,
    providedState: input.state,
    expiresAt: session.expiresAt,
    completedAt: session.completedAt,
    authorizationCode: input.code,
  });
  assertOAuthValid(check);

  const tokens = exchangeAuthorizationCode({
    connectorKey: integration.connectorKey,
    code: input.code,
    codeVerifier: session.codeVerifier ?? "",
    redirectUri: session.redirectUri,
  });
  const masked = maskSecret(tokens.accessToken);

  const latest = await prisma.integrationCredential.findFirst({
    where: { integrationId: integration.id, revokedAt: null },
    orderBy: { version: "desc" },
  });
  if (latest) {
    await prisma.integrationCredential.update({
      where: { id: latest.id },
      data: { revokedAt: new Date() },
    });
  }

  await prisma.integrationCredential.create({
    data: {
      organizationId: input.organizationId,
      integrationId: integration.id,
      kind: IntegrationCredentialKinds.oauth_token,
      version: (latest?.version ?? 0) + 1,
      secretHash: hashSecret(tokens.accessToken),
      secretLast4: masked.last4,
      secretCipher: masked.cipher,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  });

  await prisma.integrationOAuthSession.update({
    where: { id: session.id },
    data: { completedAt: new Date() },
  });

  const updated = await prisma.ecosystemIntegration.update({
    where: { id: integration.id },
    data: { status: IntegrationStatuses.connected, lastError: null },
  });

  return {
    action: "complete" as const,
    integration: toPublicIntegration(updated),
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn,
  };
}

export async function syncIntegrations(input: {
  organizationId: string;
  integrationId?: string;
  force?: boolean;
  mode?: string;
  triggeredById: string;
}) {
  const integrations = await prisma.ecosystemIntegration.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.integrationId ? { id: input.integrationId } : {}),
      status: { in: [IntegrationStatuses.connected, IntegrationStatuses.draft] },
    },
    include: { subscriptions: true },
  });

  if (integrations.length === 0) {
    throw new AppError(404, "NOT_FOUND", "No integrations to sync");
  }

  const jobs = [];
  for (const integration of integrations) {
    const due = shouldRunSync({
      lastSyncedAt: integration.lastSyncedAt,
      intervalMinutes: integration.syncIntervalMinutes,
      force: input.force,
    });
    if (!due) continue;

    const mode = input.mode ?? integration.syncMode;
    const startedAt = new Date();
    const result = executeIntegrationSync({
      connectorKey: integration.connectorKey,
      mode,
      scopes: asStringArray(integration.scopesJson),
      subscribedEventTypes: integration.subscriptions
        .filter((s) => s.enabled)
        .map((s) => s.eventType),
      now: startedAt,
    });

    const matched = matchSubscriptions(integration.subscriptions, result.eventsEmitted);
    for (const eventType of matched) {
      await prisma.integrationEventLog.create({
        data: {
          organizationId: input.organizationId,
          integrationId: integration.id,
          eventType,
          payloadJson: {
            connectorKey: integration.connectorKey,
            mode,
            at: startedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    const job = await prisma.integrationSyncJob.create({
      data: {
        organizationId: input.organizationId,
        integrationId: integration.id,
        status: IntegrationSyncJobStatuses.completed,
        mode,
        scheduledFor: startedAt,
        startedAt,
        completedAt: result.completedAt,
        resultJson: {
          recordsProcessed: result.recordsProcessed,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          eventsEmitted: matched,
        } as Prisma.InputJsonValue,
        triggeredById: input.triggeredById,
      },
    });

    await prisma.ecosystemIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncedAt: result.completedAt,
        status: IntegrationStatuses.connected,
        lastError: null,
      },
    });

    jobs.push({
      id: job.id,
      integrationId: integration.id,
      status: job.status,
      mode,
      result: {
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        eventsEmitted: matched,
      },
      completedAt: result.completedAt.toISOString(),
    });
  }

  return { jobs, skipped: integrations.length - jobs.length };
}

export async function listEvents(query: {
  organizationId: string;
  integrationId?: string;
  eventType?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.IntegrationEventLogWhereInput = {
    organizationId: query.organizationId,
    ...(query.integrationId ? { integrationId: query.integrationId } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
  };

  const [events, total, subscriptions] = await Promise.all([
    prisma.integrationEventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.integrationEventLog.count({ where }),
    prisma.integrationEventSubscription.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.integrationId ? { integrationId: query.integrationId } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    events: events.map((e) => ({
      id: e.id,
      integrationId: e.integrationId,
      eventType: e.eventType,
      payload: e.payloadJson,
      createdAt: e.createdAt.toISOString(),
    })),
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      integrationId: s.integrationId,
      eventType: s.eventType,
      enabled: s.enabled,
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getIntegrationOrganizationId(id: string): Promise<string | null> {
  const row = await prisma.ecosystemIntegration.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}
