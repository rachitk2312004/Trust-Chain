import { http, HttpResponse } from "msw";

const API = "http://localhost:3000/api/v1";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "active",
  emailVerifiedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const organization = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Acme Trust",
  slug: "acme-trust",
  parentOrganizationId: null,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const document = {
  id: "33333333-3333-3333-3333-333333333333",
  organizationId: organization.id,
  createdById: user.id,
  title: "Certificate of Origin",
  description: null,
  categoryId: null,
  category: null,
  tags: [],
  currentVersionId: "44444444-4444-4444-4444-444444444444",
  currentVersion: {
    id: "44444444-4444-4444-4444-444444444444",
    versionNumber: 1,
    contentHash: "a".repeat(64),
    mimeType: "application/pdf",
    sizeBytes: 1024,
    originalFileName: "cert.pdf",
    createdAt: new Date().toISOString(),
  },
  status: "active",
  expiresAt: null,
  archivedAt: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  permission: "manage",
};

const qr = {
  publicCode: "QR-PUBLIC-001",
  documentId: document.id,
  formatVersion: "V1",
  visibility: "restricted",
  status: "active",
  issuedAt: new Date().toISOString(),
  expiresAt: null,
  payload: { scanUrl: "https://verify.example/q/token" },
  integrity: {
    algorithm: "sha256",
    payloadHash: "b".repeat(64),
    payloadChecksum: "c".repeat(16),
  },
};

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email !== "admin@example.com" || body.password !== "Password123!") {
      return HttpResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user,
      mfaRequired: false,
    });
  }),

  http.post(`${API}/auth/refresh`, async () =>
    HttpResponse.json({
      accessToken: "access-token-refreshed",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user,
    }),
  ),

  http.get(`${API}/me`, () =>
    HttpResponse.json({
      user,
      roles: [
        { roleKey: "org_admin", roleName: "Org Admin", organizationId: organization.id },
      ],
      memberships: [
        {
          id: "66666666-6666-6666-6666-666666666666",
          organizationId: organization.id,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          status: "active",
          title: null,
        },
      ],
    }),
  ),

  http.get(`${API}/organizations`, () => HttpResponse.json({ organizations: [organization] })),
  http.get(`${API}/organizations/:id`, () => HttpResponse.json({ organization })),

  http.get(`${API}/organizations/:id/documents`, () =>
    HttpResponse.json({ documents: [document], limit: 50, offset: 0 }),
  ),

  http.post(`${API}/organizations/:id/documents`, async () =>
    HttpResponse.json({ document }, { status: 201 }),
  ),

  http.post(`${API}/organizations/:id/documents/:documentId/upload-url`, () =>
    HttpResponse.json({
      uploadSession: {
        id: "77777777-7777-7777-7777-777777777777",
        documentId: document.id,
        objectKey: "uploads/test.pdf",
        status: "pending",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      uploadUrl: "https://storage.example/upload",
      objectKey: "uploads/test.pdf",
      provider: "r2",
      bucket: "trustchain",
      expiresInSeconds: 3600,
    }),
  ),

  http.put("https://storage.example/upload", () => new HttpResponse(null, { status: 200 })),

  http.post(`${API}/organizations/:id/documents/:documentId/versions/confirm`, () =>
    HttpResponse.json({
      document,
      version: document.currentVersion,
    }),
  ),

  http.post(`${API}/organizations/:id/documents/:documentId/verify`, () =>
    HttpResponse.json({
      request: {
        id: "88888888-8888-8888-8888-888888888888",
        verificationCode: "VER-001",
        organizationId: organization.id,
        documentId: document.id,
        documentVersionId: document.currentVersionId,
        mode: "organization",
        status: "completed",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      report: {
        verificationId: "88888888-8888-8888-8888-888888888888",
        verificationCode: "VER-001",
        organizationId: organization.id,
        documentId: document.id,
        versionNumber: 1,
        contentHash: document.currentVersion!.contentHash,
        blockchainStatus: "anchored",
        revocationStatus: "active",
        verificationTimestamp: new Date().toISOString(),
        verificationResult: "valid",
        status: "completed",
        failureReasons: [],
        checks: [{ name: "hash", passed: true }],
        cached: false,
        proofOfIntegrity: null,
        proofTimestamp: null,
        networkName: null,
        transactionHash: null,
        blockNumber: null,
      },
    }),
  ),

  http.get(`${API}/organizations/:id/document-categories`, () =>
    HttpResponse.json({ categories: [] }),
  ),
  http.get(`${API}/organizations/:id/document-tags`, () => HttpResponse.json({ tags: [] })),

  http.get(`${API}/organizations/:id/qr`, () => HttpResponse.json({ qrs: [qr] })),
  http.get(`${API}/organizations/:id/qr/templates`, () => HttpResponse.json({ templates: [] })),
  http.get(`${API}/organizations/:id/qr/analytics`, () => HttpResponse.json({ analytics: [] })),

  http.post(`${API}/organizations/:id/documents/:documentId/qr`, () =>
    HttpResponse.json({ qr }, { status: 201 }),
  ),

  http.get(`${API}/organizations/:id/qr/:publicCode/download`, () =>
    HttpResponse.json({ pngBase64: "iVBORw0KGgo=" }),
  ),

  http.get(`${API}/notifications`, () =>
    HttpResponse.json({
      notifications: [],
      total: 0,
      unreadCount: 0,
      limit: 20,
      offset: 0,
    }),
  ),
  http.get(`${API}/notifications/unread-count`, () =>
    HttpResponse.json({ unreadCount: 0 }),
  ),
  http.get(`${API}/notifications/preferences`, () =>
    HttpResponse.json({ preferences: [], eventTypes: [] }),
  ),
];

export const fixtures = { user, organization, document, qr };
