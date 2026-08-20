import { createHash, randomBytes } from "node:crypto";
import {
  IntegrationAuthModes,
  IntegrationCategories,
  IntegrationConnectorKeys,
  IntegrationDefaults,
  type IntegrationConnectorKey,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type ConnectorDefinition = {
  key: IntegrationConnectorKey;
  name: string;
  category: string;
  authMode: string;
  description: string;
  defaultScopes: string[];
  authorizeBaseUrl: string;
  tokenBaseUrl: string;
  eventTypes: string[];
};

export const IntegrationConnectorCatalog: ConnectorDefinition[] = [
  {
    key: IntegrationConnectorKeys.okta,
    name: "Okta",
    category: IntegrationCategories.identity,
    authMode: IntegrationAuthModes.oauth,
    description: "Workforce identity provider SSO and directory sync.",
    defaultScopes: ["openid", "profile", "groups"],
    authorizeBaseUrl: "https://okta.example/oauth2/v1/authorize",
    tokenBaseUrl: "https://okta.example/oauth2/v1/token",
    eventTypes: ["user.provisioned", "user.deprovisioned", "group.updated"],
  },
  {
    key: IntegrationConnectorKeys.auth0,
    name: "Auth0",
    category: IntegrationCategories.identity,
    authMode: IntegrationAuthModes.oauth,
    description: "Customer identity platform authentication.",
    defaultScopes: ["openid", "profile", "email"],
    authorizeBaseUrl: "https://auth0.example/authorize",
    tokenBaseUrl: "https://auth0.example/oauth/token",
    eventTypes: ["user.created", "user.updated", "login.success"],
  },
  {
    key: IntegrationConnectorKeys.entra,
    name: "Microsoft Entra ID",
    category: IntegrationCategories.identity,
    authMode: IntegrationAuthModes.oauth,
    description: "Microsoft cloud identity and access management.",
    defaultScopes: ["User.Read.All", "Group.Read.All"],
    authorizeBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    eventTypes: ["user.synced", "group.synced"],
  },
  {
    key: IntegrationConnectorKeys.slack,
    name: "Slack",
    category: IntegrationCategories.communication,
    authMode: IntegrationAuthModes.oauth,
    description: "Team messaging and notification delivery.",
    defaultScopes: ["chat:write", "channels:read", "users:read"],
    authorizeBaseUrl: "https://slack.com/oauth/v2/authorize",
    tokenBaseUrl: "https://slack.com/api/oauth.v2.access",
    eventTypes: ["message.posted", "channel.created", "member.joined"],
  },
  {
    key: IntegrationConnectorKeys.teams,
    name: "Microsoft Teams",
    category: IntegrationCategories.communication,
    authMode: IntegrationAuthModes.oauth,
    description: "Microsoft Teams chat and channel notifications.",
    defaultScopes: ["ChannelMessage.Send", "Team.ReadBasic.All"],
    authorizeBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    eventTypes: ["message.sent", "channel.updated"],
  },
  {
    key: IntegrationConnectorKeys.google_drive,
    name: "Google Drive",
    category: IntegrationCategories.storage,
    authMode: IntegrationAuthModes.oauth,
    description: "Cloud file storage and document sync.",
    defaultScopes: ["https://www.googleapis.com/auth/drive.readonly"],
    authorizeBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenBaseUrl: "https://oauth2.googleapis.com/token",
    eventTypes: ["file.created", "file.updated", "file.deleted"],
  },
  {
    key: IntegrationConnectorKeys.dropbox,
    name: "Dropbox",
    category: IntegrationCategories.storage,
    authMode: IntegrationAuthModes.oauth,
    description: "File storage synchronization.",
    defaultScopes: ["files.metadata.read", "files.content.read"],
    authorizeBaseUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenBaseUrl: "https://api.dropboxapi.com/oauth2/token",
    eventTypes: ["file.added", "file.removed"],
  },
  {
    key: IntegrationConnectorKeys.jira,
    name: "Jira",
    category: IntegrationCategories.project,
    authMode: IntegrationAuthModes.api_key,
    description: "Issue tracking and project workflows.",
    defaultScopes: ["read:jira-work", "write:jira-work"],
    authorizeBaseUrl: "https://auth.atlassian.com/authorize",
    tokenBaseUrl: "https://auth.atlassian.com/oauth/token",
    eventTypes: ["issue.created", "issue.updated", "issue.resolved"],
  },
  {
    key: IntegrationConnectorKeys.asana,
    name: "Asana",
    category: IntegrationCategories.project,
    authMode: IntegrationAuthModes.oauth,
    description: "Work management and task synchronization.",
    defaultScopes: ["default"],
    authorizeBaseUrl: "https://app.asana.com/-/oauth_authorize",
    tokenBaseUrl: "https://app.asana.com/-/oauth_token",
    eventTypes: ["task.created", "task.completed", "project.updated"],
  },
];

export function getConnector(key: string): ConnectorDefinition {
  const found = IntegrationConnectorCatalog.find((c) => c.key === key);
  if (!found) {
    throw new AppError(400, "UNKNOWN_CONNECTOR", `Unknown connector: ${key}`);
  }
  return found;
}

export function listConnectors(category?: string): ConnectorDefinition[] {
  if (!category) return [...IntegrationConnectorCatalog];
  return IntegrationConnectorCatalog.filter((c) => c.category === category);
}

export type OAuthStartResult = {
  state: string;
  codeVerifier: string;
  authorizeUrl: string;
  expiresAt: Date;
};

export function startOAuthFlow(input: {
  connectorKey: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  now?: Date;
  ttlSeconds?: number;
}): OAuthStartResult {
  const connector = getConnector(input.connectorKey);
  if (connector.authMode !== IntegrationAuthModes.oauth) {
    throw new AppError(400, "OAUTH_UNSUPPORTED", `${connector.name} uses ${connector.authMode}`);
  }

  const now = input.now ?? new Date();
  const ttl = input.ttlSeconds ?? IntegrationDefaults.oauthStateTtlSeconds;
  const state = randomBytes(24).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const scopes = input.scopes?.length ? input.scopes : connector.defaultScopes;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  });

  return {
    state,
    codeVerifier,
    authorizeUrl: `${connector.authorizeBaseUrl}?${params.toString()}`,
    expiresAt: new Date(now.getTime() + ttl * 1000),
  };
}

export function validateOAuthCallback(input: {
  expectedState: string;
  providedState: string;
  expiresAt: Date | string;
  completedAt?: Date | string | null;
  authorizationCode?: string;
  now?: Date;
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  const expires =
    typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;

  if (input.completedAt) reasons.push("session_already_completed");
  if (expires.getTime() <= now.getTime()) reasons.push("state_expired");
  if (input.expectedState !== input.providedState) reasons.push("state_mismatch");
  if (!input.authorizationCode?.trim()) reasons.push("code_missing");

  return { valid: reasons.length === 0, reasons };
}

export function assertOAuthValid(result: { valid: boolean; reasons: string[] }): void {
  if (!result.valid) {
    throw new AppError(
      400,
      "OAUTH_FAILED",
      `OAuth failed: ${result.reasons.join(", ")}`,
    );
  }
}

/** Foundation token exchange — deterministic mock tokens, no live IdP calls. */
export function exchangeAuthorizationCode(input: {
  connectorKey: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
} {
  const connector = getConnector(input.connectorKey);
  const material = `${connector.key}:${input.code}:${input.codeVerifier}:${input.redirectUri}`;
  const accessToken = createHash("sha256").update(`access:${material}`).digest("hex");
  const refreshToken = createHash("sha256").update(`refresh:${material}`).digest("hex");
  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    tokenType: "Bearer",
  };
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function maskSecret(secret: string): { last4: string; cipher: string } {
  const last4 = secret.slice(-4);
  const cipher = Buffer.from(secret, "utf8").toString("base64");
  return { last4, cipher };
}

export function generateApiKeyMaterial(connectorKey: string): string {
  return `tc_${connectorKey}_${randomBytes(24).toString("hex")}`;
}
