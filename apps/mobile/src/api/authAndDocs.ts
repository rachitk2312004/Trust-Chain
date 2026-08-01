import type { AuthTokens, OrganizationSummary, DocumentSummary } from "../types/mobile.types";

function root(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}

export async function login(
  apiBaseUrl: string,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await fetch(`${root(apiBaseUrl)}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`MOBILE_LOGIN_${res.status}`);
  const json = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
    tokens?: AuthTokens;
  };
  const accessToken = json.accessToken ?? json.tokens?.accessToken;
  const refreshToken = json.refreshToken ?? json.tokens?.refreshToken;
  if (!accessToken || !refreshToken) throw new Error("MOBILE_LOGIN_MALFORMED");
  return { accessToken, refreshToken };
}

export async function register(
  apiBaseUrl: string,
  input: { email: string; password: string; firstName?: string },
): Promise<void> {
  const res = await fetch(`${root(apiBaseUrl)}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`MOBILE_REGISTER_${res.status}`);
}

export async function refresh(apiBaseUrl: string, refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${root(apiBaseUrl)}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(`MOBILE_REFRESH_${res.status}`);
  const json = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
    tokens?: AuthTokens;
  };
  const accessToken = json.accessToken ?? json.tokens?.accessToken;
  const nextRefresh = json.refreshToken ?? json.tokens?.refreshToken;
  if (!accessToken || !nextRefresh) throw new Error("MOBILE_REFRESH_MALFORMED");
  return { accessToken, refreshToken: nextRefresh };
}

export async function listOrganizations(
  apiBaseUrl: string,
  accessToken: string,
): Promise<OrganizationSummary[]> {
  const res = await fetch(`${root(apiBaseUrl)}/api/v1/organizations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MOBILE_ORGS_${res.status}`);
  const json = (await res.json()) as { organizations?: OrganizationSummary[] };
  return json.organizations ?? [];
}

export async function listDocuments(
  apiBaseUrl: string,
  accessToken: string,
  organizationId: string,
): Promise<DocumentSummary[]> {
  const res = await fetch(`${root(apiBaseUrl)}/api/v1/organizations/${organizationId}/documents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MOBILE_DOCS_${res.status}`);
  const json = (await res.json()) as { documents?: DocumentSummary[] };
  return json.documents ?? [];
}

export async function getDocument(
  apiBaseUrl: string,
  accessToken: string,
  organizationId: string,
  documentId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${root(apiBaseUrl)}/api/v1/organizations/${organizationId}/documents/${documentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`MOBILE_DOC_${res.status}`);
  const json = (await res.json()) as { document?: Record<string, unknown> };
  return json.document ?? json;
}
