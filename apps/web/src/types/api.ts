export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSessionPayload = AuthTokens & {
  user: PublicUser;
  sessionId: string;
  deviceId: string | null;
  mfaRequired?: false;
  emailVerified?: boolean;
};

export type MfaChallengePayload = {
  mfaRequired: true;
  mfaToken: string;
  user: PublicUser;
  emailVerified?: boolean;
};

export type LoginResponse = AuthSessionPayload | MfaChallengePayload;

export type SessionRow = {
  id: string;
  deviceId: string | null;
  ip: string | null;
  userAgent: string | null;
  expiresAt: string;
  createdAt: string;
  current: boolean;
};

export type RoleBindingView = {
  roleKey: string;
  roleName: string;
  organizationId: string | null;
};

export type MeResponse = {
  user: PublicUser;
  roles: RoleBindingView[];
  memberships: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    status: string;
    title: string | null;
  }>;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMember = {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  status: string;
  branchId: string | null;
  departmentId: string | null;
  roleKeys?: string[];
  /** First org admin bound to this organization (who started it). */
  isFoundingAdmin?: boolean;
};

export type DiscoverableOrganization = OrganizationSummary & {
  membershipStatus: string | null;
  joinRequestStatus: string | null;
  isMember: boolean;
  hasPendingRequest: boolean;
};

export type MembershipJoinRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  organizationSlug: string | null;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  message: string | null;
  requestedRole: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  roleKey: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type Branch = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Department = {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationBranding = {
  organizationId: string;
  displayName: string | null;
  logoObjectKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  updatedAt: string;
};

export type InviteRoleKey = "org_admin" | "employee" | "public_user";

export type DocumentCategoryRef = {
  id: string;
  name: string;
};

export type DocumentTagRef = {
  id: string;
  name: string;
};

export type DocumentVersionSummary = {
  id: string;
  versionNumber: number;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
  createdAt: string;
  uploadedById?: string;
  isCurrent?: boolean;
};

export type DocumentDetail = {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  category: DocumentCategoryRef | null;
  tags: DocumentTagRef[];
  currentVersionId: string | null;
  currentVersion: DocumentVersionSummary | null;
  status: string;
  expiresAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permission?: string;
};

export type DocumentSummary = DocumentDetail;

export type DocumentListResponse = {
  documents: DocumentDetail[];
  limit: number;
  offset: number;
};

export type DocumentUploadSession = {
  id: string;
  documentId: string;
  objectKey: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export type DocumentUploadUrlResponse = {
  uploadSession: DocumentUploadSession;
  uploadUrl: string;
  objectKey: string;
  provider: string;
  bucket: string;
  expiresInSeconds: number;
};

export type DocumentConfirmResponse = {
  document: DocumentDetail;
  version: DocumentVersionSummary & {
    objectKey?: string;
    deduplicated?: boolean;
  };
};

export type DocumentShare = {
  id: string;
  documentId: string;
  sharedWithUserId: string | null;
  sharedWithEmail: string | null;
  permission: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentAuditEntry = {
  id: string;
  documentId: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  metadata: unknown;
  createdAt: string;
};

export type DocumentPermission = "view" | "download" | "edit" | "manage";

export type DocumentCategory = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTag = {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
};

export type DocumentAccessPolicy = {
  id: string;
  documentId: string;
  subjectType: "user" | "role" | "organization";
  subjectId: string;
  permission: DocumentPermission;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDownloadUrlResponse =
  | {
      downloadMode: "proxy";
      encrypted: true;
      proxyPath: string;
      versionId: string;
      versionNumber: number;
      contentHash: string;
      message?: string;
    }
  | {
      downloadMode: "presigned";
      encrypted: false;
      downloadUrl: string;
      objectKey: string;
      provider: string;
      bucket: string;
      expiresInSeconds: number;
      versionId: string;
      versionNumber: number;
      contentHash: string;
    };

export type LogoUploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  provider: string;
  bucket: string;
  expiresInSeconds: number;
};

export type VerificationOutcome =
  | "valid"
  | "invalid"
  | "revoked"
  | "expired"
  | "missing"
  | "tampered";

export type VerificationInternalStatus = "pending" | "processing" | "completed" | "failed";

export type VerificationCheck = {
  name: string;
  passed: boolean;
  code?: string;
  detail?: string;
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
  verificationResult: VerificationOutcome | string;
  status: VerificationInternalStatus | string;
  failureReasons: string[];
  checks: VerificationCheck[];
  cached: boolean;
  proofOfIntegrity: string | null;
  proofTimestamp: string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: number | null;
};

export type VerificationRequestSummary = {
  id: string;
  verificationCode: string;
  organizationId: string;
  documentId: string;
  documentVersionId: string | null;
  mode: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type VerificationListItem = {
  request: VerificationRequestSummary;
  outcome: string | null;
  verificationCode?: string;
  report: VerificationReport | null;
};

export type VerificationListResponse = {
  verifications: VerificationListItem[];
  limit: number;
  offset: number;
};

export type VerificationDetailResponse = {
  request: VerificationRequestSummary;
  outcome: string | null;
  report: VerificationReport | null;
};

export type StartVerificationResponse = {
  request: VerificationRequestSummary;
  report: VerificationReport | null;
  cached?: boolean;
  idempotentReplay?: boolean;
};

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

export type VerificationStatistics = {
  total: number;
  byOutcome: Record<string, number>;
  byStatus: Record<string, number>;
  validRate: number;
};

/** @deprecated Prefer VerificationListItem */
export type VerificationHistoryItem = VerificationListItem;

export type QrIntegrity = {
  payloadChecksum: string;
  payloadHash: string;
  signatureVersion: string;
  algorithm: string;
};

export type QrCodeSummary = {
  publicCode: string;
  documentId: string;
  formatVersion: string;
  status: string;
  visibility: string;
  integrity: QrIntegrity;
  payload: Record<string, unknown> | null;
  issuedAt: string;
  expiresAt: string | null;
  assets: {
    pngObjectKey: string | null;
    svgObjectKey: string | null;
  };
  createdAt: string;
};

export type QrCreateResponse = {
  qr: QrCodeSummary;
  scanUrl: string;
  download: {
    pngBase64: string;
    svg: string;
  };
};

export type QrRotateResponse = {
  previous: { publicCode: string; status: string };
  qr: QrCodeSummary;
  download: {
    pngBase64: string;
    svg: string;
  };
  scanUrl: string;
};

export type QrTemplate = {
  publicCode: string;
  name: string;
  description: string | null;
  sizePx: number;
  errorCorrection: string;
  foregroundColor: string;
  backgroundColor: string;
  marginModules: number;
  print: {
    pageSize: string;
    dpi: number;
    marginMm: number;
    bleedMm: number;
    qrPerPage: number;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QrAnalyticsRow = {
  id: string;
  organizationId: string;
  documentId: string | null;
  day: string;
  scanCount: number;
  downloadCount: number;
  validCount: number;
  invalidCount: number;
  revokedCount: number;
  expiredCount: number;
  errorCount: number;
  updatedAt: string;
};

export type QrEvent = {
  id: string;
  organizationId: string | null;
  documentId: string | null;
  qrCodeId: string | null;
  qrPublicCode: string | null;
  lookupType: string;
  outcome: string | null;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
};

export type CreateQrInput = {
  formatVersion?: "V1" | "V2" | "V3";
  templatePublicCode?: string;
  expiresAt?: string | null;
  maxUses?: number;
  visibility?: "public" | "restricted";
  label?: string;
};

export type CreateQrTemplateInput = {
  name: string;
  description?: string;
  sizePx?: number;
  errorCorrection?: "L" | "M" | "Q" | "H";
  foregroundColor?: string;
  backgroundColor?: string;
  marginModules?: number;
  printPageSize?: "A4" | "Letter";
  printDpi?: number;
  printMarginMm?: number;
  printBleedMm?: number;
  qrPerPage?: number;
  isDefault?: boolean;
};

export function isMfaChallenge(payload: LoginResponse): payload is MfaChallengePayload {
  return payload.mfaRequired === true;
}

export type NotificationEventType =
  | "invitation_created"
  | "invitation_accepted"
  | "member_added"
  | "document_uploaded"
  | "document_verified"
  | "document_archived"
  | "document_restored"
  | "share_created"
  | "qr_created"
  | "qr_revoked"
  | "verification_completed";

export type NotificationItem = {
  id: string;
  userId: string;
  organizationId: string | null;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  payload: unknown;
  channel: string;
  emailStatus: string | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
};

export type NotificationListResponse = {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  limit: number;
  offset: number;
};

export type NotificationPreference = {
  id: string | null;
  userId: string;
  organizationId: string | null;
  eventType: NotificationEventType | string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string | null;
  label?: string;
};

export type NotificationPreferencesResponse = {
  preferences: NotificationPreference[];
  eventTypes: string[];
};

export type CertificateStatus = "draft" | "issued" | "revoked" | "expired";

export type CertificateSummary = {
  id: string;
  publicId: string;
  organizationId: string;
  templateId: string | null;
  documentId: string | null;
  title: string;
  description: string | null;
  recipient: {
    name: string;
    email: string | null;
    userId: string | null;
  };
  status: CertificateStatus | string;
  issuedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  integrityHash: string;
  verificationUrl: string;
  qrPublicCode: string | null;
  issuedById: string;
  revokedAt: string | null;
  revokedById: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CertificateListResponse = {
  certificates: CertificateSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type CertificateLayout = {
  version?: number;
  orientation?: "portrait" | "landscape";
  pageSize?: "A4" | "Letter";
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  borderColor?: string;
  titleTemplate?: string;
  subtitleTemplate?: string;
  bodyTemplate?: string;
  footerTemplate?: string;
  showQr?: boolean;
  showLogo?: boolean;
  showSignature?: boolean;
  signatureLabel?: string;
  backgroundImageKey?: string | null;
  logoObjectKey?: string | null;
  signatureImageKey?: string | null;
  fields?: string[];
  [key: string]: unknown;
};

export type CertificateTemplate = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  layout: CertificateLayout | Record<string, unknown>;
  status: "active" | "archived" | string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CertificateEvent = {
  id: string;
  certificateId: string;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payload: unknown;
  createdAt: string;
};

export type CertificateHistoryResponse = {
  certificateId: string;
  events: CertificateEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type CertificateVerificationResult = {
  valid: boolean;
  status: string;
  checks: {
    integrity: boolean;
    notRevoked: boolean;
    notExpired: boolean;
    documentOk: boolean;
  };
  integrityHash?: string;
  expectedHash?: string;
  reasons: string[];
};

export type CertificateVerifyResponse = {
  certificate: CertificateSummary;
  verification: CertificateVerificationResult;
};

export type IssueCertificateInput = {
  organizationId: string;
  title: string;
  description?: string | null;
  recipientName: string;
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  templateId?: string | null;
  documentId?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  createQr?: boolean;
};

export type CreateCertificateTemplateInput = {
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  layout?: CertificateLayout;
};

export type UpdateCertificateTemplateInput = {
  name?: string;
  description?: string | null;
  layout?: CertificateLayout;
  status?: "active" | "archived";
};

export type CertificateExportFormat = "pdf" | "png" | "svg";

export type CertificateDownloadResult = {
  format: CertificateExportFormat;
  blob: Blob;
  fileName: string;
  warnings: string[];
};

export type CertificateBulkFormat = "csv" | "json";

export type CertificateBulkJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type CertificateBulkRowIssue = {
  code: string;
  message: string;
};

export type CertificateBulkPreviewRow = {
  rowNumber: number;
  recipientName: string;
  recipientEmail: string | null;
  certificateIdentifier: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  templateIdentifier: string | null;
  title: string | null;
  metadata: Record<string, unknown>;
  errors: CertificateBulkRowIssue[];
  warnings: CertificateBulkRowIssue[];
  resolvedTemplateId: string | null;
};

export type CertificateBulkPreview = {
  format: CertificateBulkFormat;
  valid: boolean;
  rows: CertificateBulkPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateCount: number;
    invalidEmailCount: number;
    invalidDateCount: number;
    missingTemplateCount: number;
    malformedMetadataCount: number;
    revokedTemplateCount: number;
  };
};

export type CertificateBulkJob = {
  jobId: string;
  organizationId: string;
  status: CertificateBulkJobStatus | string;
  format: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  rolledBackCount: number;
  cancelRequested: boolean;
  rollbackOnCancel: boolean;
  percentComplete: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  errors: Array<{
    rowNumber: number;
    code: string;
    message: string;
    certificateIdentifier?: string | null;
  }>;
  issuedCertificateIds: string[];
};

export type CertificateBulkPreviewInput = {
  organizationId: string;
  format: CertificateBulkFormat;
  content: string;
  defaultTemplateId?: string | null;
};

export type CertificateBulkStartInput = CertificateBulkPreviewInput & {
  defaultTitle?: string | null;
  rollbackOnCancel?: boolean;
  requireAllValid?: boolean;
};

export type CertificateAnalyticsSnapshot = {
  generatedAt: string;
  organizationId: string;
  issuance: {
    issued: number;
    draft: number;
    revoked: number;
    expired: number;
    active: number;
    total: number;
  };
  revocation: { revoked: number; revokeEvents: number };
  verification: {
    totalEvents: number;
    valid: number;
    invalid: number;
    successRate: number | null;
    averageVerificationTimeMs: number | null;
  };
  expiration: {
    expired: number;
    expiringWithin30Days: number;
    neverExpires: number;
  };
  downloads: {
    totalEvents: number;
    byFormat: Record<string, number>;
    averageRenderTimeMs: number | null;
  };
  rendering: {
    renderEvents: number;
    averageRenderTimeMs: number | null;
    processAverageRenderTimeMs: number | null;
    processRenderFailures: number;
  };
  templates: Array<{
    templateId: string | null;
    templateCode: string | null;
    templateName: string | null;
    status: string | null;
    certificateCount: number;
  }>;
  bulk: {
    totalJobs: number;
    byStatus: Record<string, number>;
    totalRows: number;
    successRows: number;
    failedRows: number;
    rolledBackCount: number;
    successRate: number | null;
  };
  process: {
    downloads: number;
    renders: number;
    renderFailures: number;
    verifications: number;
    averageRenderTimeMs: number | null;
    averageVerificationTimeMs: number | null;
    downloadByFormat: Record<string, number>;
  };
};

export type CertificateAdminReprocessResult = {
  organizationId: string;
  requested: number;
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    certificateId: string;
    publicId: string;
    verified: boolean;
    rendered: boolean;
    durationMs: number;
    error?: string;
  }>;
};

export type CertificateAdminCleanupResult = {
  preview: {
    eventsEligible: number;
    bulkJobsEligible: number;
    temporaryAssetEventsEligible: number;
  };
  result: {
    deletedEvents: number;
    deletedBulkJobs: number;
    deletedTemporaryAssetEvents: number;
  };
};

/** Phase D — digital signatures */

export type SignatureStatus = "pending" | "active" | "revoked" | "expired";

export type SignatureAlgorithm = "RSA-SHA256" | "ECDSA-P256-SHA256" | "Ed25519" | string;

export type SignatureSummary = {
  id: string;
  publicId: string;
  organizationId: string;
  signerId: string;
  documentId: string | null;
  certificateId: string | null;
  algorithm: SignatureAlgorithm;
  status: SignatureStatus | string;
  publicKeyPem: string;
  signatureValue: string;
  payloadHash: string;
  integrityHash: string;
  signedAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  revokedAt: string | null;
  revokedById: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignatureArtifact = {
  id: string;
  signatureId: string;
  organizationId: string;
  kind: string;
  content: string;
  contentType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type SignatureEvent = {
  id: string;
  signatureId: string;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payload: unknown;
  createdAt: string;
};

export type SignatureListResponse = {
  signatures: SignatureSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type SignatureDetailResponse = {
  signature: SignatureSummary;
  artifacts: SignatureArtifact[];
};

export type SignatureHistoryResponse = {
  signatureId: string;
  events: SignatureEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type SignatureVerificationResult = {
  valid: boolean;
  status: string;
  checks: {
    algorithmSupported: boolean;
    cryptographic: boolean;
    integrity: boolean;
    notRevoked: boolean;
    notExpired: boolean;
    documentContentMatch?: boolean | null;
  };
  reasons: string[];
  payloadHash?: string;
  expectedPayloadHash?: string;
  integrityHash?: string;
  expectedIntegrityHash?: string;
  contentHash?: string;
  detached?: boolean;
};

export type SignatureVerifyResponse = {
  signature: SignatureSummary;
  verification: SignatureVerificationResult;
};

export type SignatureCreateInput = {
  organizationId: string;
  documentId?: string | null;
  certificateId?: string | null;
  algorithm?: SignatureAlgorithm;
  privateKeyPem?: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  contentHash?: string | null;
};

export type SignatureCreateResponse = {
  signature: SignatureSummary;
  generatedPrivateKeyPem?: string | null;
};

export type SignatureWorkflowSignInput = {
  organizationId: string;
  algorithm?: SignatureAlgorithm;
  privateKeyPem?: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type SignDocumentInput = SignatureWorkflowSignInput & { documentId: string };
export type SignCertificateInput = SignatureWorkflowSignInput & { certificateId: string };
export type SignDetachedInput = SignatureWorkflowSignInput & {
  payload: string | Record<string, unknown> | { content: string; contentType?: string };
};

export type SignatureWorkflowResponse = SignatureCreateResponse & {
  workflow: string;
  expiration?: {
    expired: boolean;
    status: string;
    expiresAt: string | null;
    remainingMs: number | null;
  };
  detached?: {
    contentHash: string;
    contentType: string;
    artifacts: {
      payload: SignatureArtifact | null;
      signature: SignatureArtifact | null;
      publicKey: SignatureArtifact | null;
      canonical: SignatureArtifact | null;
    };
  };
};

export type SignatureVerifyWorkflowInput = {
  organizationId: string;
  signatureId?: string;
  detached?: {
    signerId: string;
    algorithm: SignatureAlgorithm;
    publicKeyPem: string;
    signatureValue: string;
    signedAt: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    payload: string | Record<string, unknown> | { content: string; contentType?: string };
    publicId?: string;
    payloadHash?: string;
    integrityHash?: string;
    status?: string;
  };
};

export type SignatureVerifyWorkflowResponse = {
  workflow: string;
  mode: "stored" | "detached";
  signature?: SignatureSummary;
  verification: SignatureVerificationResult;
  expiration?: {
    expired: boolean;
    status: string;
    expiresAt: string | null;
    remainingMs: number | null;
  };
  detachedArtifacts?: {
    payload: SignatureArtifact | null;
    signature: SignatureArtifact | null;
    publicKey: SignatureArtifact | null;
    canonical: SignatureArtifact | null;
  } | null;
};

export type SignaturePolicyView = {
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

/** Phase D Step 4 — multi-party approval workflows */

export type SignatureApprovalWorkflowType = "sequential" | "parallel" | "threshold" | string;
export type SignatureApprovalWorkflowStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | string;
export type SignatureApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "skipped"
  | "expired"
  | string;

export type SignatureApprovalSummary = {
  id: string;
  workflowId: string;
  organizationId: string;
  reviewerId: string;
  stepOrder: number;
  status: SignatureApprovalStatus;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignatureApprovalEvent = {
  id: string;
  workflowId: string;
  approvalId: string | null;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payload: unknown;
  createdAt: string;
};

export type SignatureApprovalWorkflow = {
  id: string;
  publicId: string;
  organizationId: string;
  signatureId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  workflowType: SignatureApprovalWorkflowType;
  status: SignatureApprovalWorkflowStatus;
  thresholdCount: number | null;
  currentStep: number;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancelReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  approvals?: SignatureApprovalSummary[];
  counts?: {
    pending: number;
    approved: number;
    rejected: number;
    skipped: number;
  };
};

export type SignatureApprovalWorkflowListResponse = {
  workflows: SignatureApprovalWorkflow[];
  total: number;
  limit: number;
  offset: number;
};

export type SignatureApprovalWorkflowDetailResponse = {
  workflow: SignatureApprovalWorkflow;
  approvals: SignatureApprovalSummary[];
  events: SignatureApprovalEvent[];
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    skipped: number;
  };
};

export type CreateSignatureApprovalWorkflowInput = {
  organizationId: string;
  title: string;
  description?: string | null;
  workflowType: SignatureApprovalWorkflowType;
  signatureId?: string | null;
  thresholdCount?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  reviewers: Array<{ reviewerId: string; stepOrder?: number }>;
};

/** Phase D Step 5 — signature analytics & ops */

export type SignatureAnalyticsSnapshot = {
  generatedAt: string;
  organizationId: string;
  lifecycle: {
    created: number;
    active: number;
    pending: number;
    revoked: number;
    expired: number;
    total: number;
  };
  verification: {
    totalEvents: number;
    valid: number;
    invalid: number;
    successRate: number | null;
    averageVerificationTimeMs: number | null;
  };
  algorithms: Array<{
    algorithm: string;
    count: number;
    share: number | null;
  }>;
  workflows: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    completionRate: number | null;
    rejectionRate: number | null;
    averageApprovalLatencyMs: number | null;
    pending: number;
  };
  detached: {
    total: number;
    active: number;
    revoked: number;
    expired: number;
    artifactCount: number;
  };
  downloads: {
    artifactCount: number;
    byKind: Record<string, number>;
    processDownloads: number;
    processDownloadByKind: Record<string, number>;
  };
  revocation: { revoked: number; revokeEvents: number };
  expiration: { expired: number; expiringWithin30Days: number };
  process: {
    verifications: number;
    verificationFailures: number;
    approvals: number;
    downloads: number;
    averageVerificationTimeMs: number | null;
    averageApprovalTimeMs: number | null;
    downloadByKind: Record<string, number>;
  };
};

export type SignatureAdminReprocessResult = {
  requested: number;
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    signatureId: string;
    publicId: string;
    verified: boolean;
    status: string;
    durationMs: number;
    error?: string;
  }>;
};

export type SignatureAdminCleanupResult = {
  preview: {
    eventsEligible: number;
    approvalEventsEligible: number;
    workflowsEligible: number;
    artifactsEligible: number;
    diagnosticEventsEligible: number;
  };
  result: {
    deletedEvents: number;
    deletedApprovalEvents: number;
    deletedWorkflows: number;
    deletedArtifacts: number;
    deletedDiagnosticEvents: number;
  };
};

/** Phase E Step 1 — administration platform */

export type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ roleKey: string; roleName: string; organizationId: string | null }>;
  memberships: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    status: string;
    title: string | null;
  }>;
};

export type AdminUserListResponse = {
  users: AdminUserSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  parentOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    memberships: number;
    roleBindings: number;
    documents: number;
  };
};

export type AdminOrganizationListResponse = {
  organizations: AdminOrganizationSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminRoleSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  bindingCount: number;
  createdAt: string;
};

export type AdminRolesResponse = {
  roles: AdminRoleSummary[];
};

export type AdminPermissionCatalogEntry = {
  key: string;
  name: string;
  description: string;
  category: string;
};

export type AdminPermissionsResponse = {
  catalog: AdminPermissionCatalogEntry[];
  roleCapabilities: Record<string, string[]>;
  defaults: Record<string, string[]>;
};

export type AdminConfigurationEntry = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConfigurationResponse = {
  configurations: AdminConfigurationEntry[];
  roleCapabilities: Record<string, string[]>;
  knownKeys: string[];
};

export type AdminFeatureFlag = {
  id: string;
  publicCode: string;
  organizationId: string | null;
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  targeting: unknown;
  experiments: unknown;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  organizationId: string | null;
  success: boolean;
  meta: unknown;
  createdAt: string;
};

export type AdminAuditListResponse = {
  events: AdminAuditEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminDashboardResponse = {
  summary: {
    users: number;
    organizations: number;
    roles: number;
    featureFlags: number;
    recentAuditEvents: number;
  };
  recentAudit: AdminAuditEvent[];
};

export type AdminAssignRoleInput = {
  userId: string;
  roleKey: string;
  organizationId?: string | null;
};

export type AdminAssignPermissionsInput = {
  roleKey: string;
  capabilities: string[];
};

export type AdminUpdateConfigurationInput = {
  key: string;
  value: unknown;
  description?: string | null;
};

export type AdminCreateFeatureFlagInput = {
  organizationId?: string | null;
  key: string;
  status?: string;
  rolloutPercent?: number;
  killSwitch?: boolean;
  targeting?: Record<string, unknown> | null;
  experiments?: Record<string, unknown> | null;
};

export type AdminUpdateFeatureFlagInput = {
  status?: string;
  rolloutPercent?: number;
  killSwitch?: boolean;
  targeting?: Record<string, unknown> | null;
  experiments?: Record<string, unknown> | null;
};

/** Phase E Step 2 — tenant administration */

export type TenantLifecycleStatus = "active" | "suspended" | "archived" | "transferred" | string;

export type TenantQuotaLimits = {
  users: number;
  organizations: number;
  documents: number;
  certificates: number;
  signatures: number;
  storageBytes: number;
};

export type TenantQuotaView = {
  id: string;
  organizationId: string;
  limits: TenantQuotaLimits;
  usage: TenantQuotaLimits;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  utilization?: Array<{
    resource: string;
    used: number;
    limit: number;
    percent: number | null;
  }>;
};

export type TenantLifecycleEvent = {
  id: string;
  organizationId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  meta: unknown;
  createdAt: string;
};

export type AdminTenantSummary = {
  id: string;
  name: string;
  slug: string;
  status: TenantLifecycleStatus;
  parentOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    users: number;
    organizations: number;
    documents: number;
    certificates: number;
    signatures: number;
  };
  quotas: TenantQuotaView | null;
};

export type AdminTenantListResponse = {
  tenants: AdminTenantSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminTenantDetailResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantLifecycleStatus;
    parentOrganizationId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  parent: { id: string; name: string; slug: string; status: string } | null;
  children: Array<{ id: string; name: string; slug: string; status: string }>;
  counts: {
    memberships: number;
    children: number;
    documents: number;
    certificates: number;
    signatures: number;
  };
  memberships: Array<{
    id: string;
    status: string;
    title: string | null;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
    };
  }>;
  roleBindings: Array<{
    id: string;
    roleKey: string;
    roleName: string;
    user: { id: string; email: string; firstName: string | null; lastName: string | null };
    createdAt: string;
  }>;
  quotas: TenantQuotaView;
  lifecycle: TenantLifecycleEvent[];
};

export type AdminCreateTenantInput = {
  name: string;
  slug?: string;
  ownerUserId?: string;
  ownerEmail?: string;
  parentOrganizationId?: string | null;
  quotas?: Partial<TenantQuotaLimits>;
};

export type AdminPatchTenantInput = {
  name?: string;
  status?: TenantLifecycleStatus;
  parentOrganizationId?: string | null;
  quotas?: Partial<TenantQuotaLimits>;
};

export type AdminTransferTenantInput = {
  toUserId: string;
  toParentOrganizationId?: string | null;
  reason?: string;
};

/** Phase E Step 3 — portal expansion */

export type AdminHealthCheck = {
  name: string;
  status: "ok" | "degraded" | "down" | string;
  latencyMs: number | null;
  detail?: string;
};

export type AdminHealthReport = {
  status: "ok" | "degraded" | "down" | string;
  generatedAt: string;
  uptimeSeconds: number;
  checks: AdminHealthCheck[];
  process: {
    nodeVersion: string;
    pid: number;
    memoryRssBytes: number;
  };
};

export type AdminInspectionSection = {
  id: string;
  title: string;
  status: "ok" | "warning" | "empty" | string;
  summary: string;
  data: unknown;
};

export type AdminInspectionResponse = {
  generatedAt: string;
  sections: AdminInspectionSection[];
};

export type AdminConfigurationHistoryEntry = {
  auditId: string;
  key: string;
  action: string;
  previousValue: unknown;
  newValue: unknown;
  description: string | null;
  actorUserId: string | null;
  createdAt: string;
  rolledBack?: boolean;
};

export type AdminConfigurationHistoryResponse = {
  history: AdminConfigurationHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
  knownKeys: string[];
};

export type AdminAuditFilterParams = {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  success?: boolean;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

/** Phase E Step 4 — policy engine */

export type AdminPolicyType =
  | "permission"
  | "quota"
  | "retention"
  | "workflow"
  | "feature"
  | "organization"
  | string;

export type AdminPolicyAssignment = {
  id: string;
  policyId: string;
  organizationId: string;
  inheritToChildren: boolean;
  enabled: boolean;
  createdById: string | null;
  createdAt: string;
};

export type AdminPolicy = {
  id: string;
  publicCode: string;
  name: string;
  description: string | null;
  policyType: AdminPolicyType;
  status: "draft" | "active" | "disabled" | string;
  priority: number;
  parentPolicyId: string | null;
  rules: Record<string, unknown>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: AdminPolicyAssignment[];
};

export type AdminPolicyConflict = {
  policyType: string;
  key: string;
  leftPolicyId: string;
  rightPolicyId: string;
  leftValue: unknown;
  rightValue: unknown;
  reason: string;
};

export type AdminPolicyEvaluation = {
  decision: "allow" | "deny" | "conflict" | "not_applicable" | string;
  policyType: string | null;
  matchedPolicyIds: string[];
  effectiveRules: Record<string, unknown>;
  conflicts: AdminPolicyConflict[];
  evaluations: Array<{
    decision: string;
    policyId: string | null;
    reason: string;
    details?: Record<string, unknown>;
  }>;
  reason: string;
};

export type AdminPolicyEvaluationEvent = {
  id: string;
  policyId: string | null;
  organizationId: string | null;
  actorUserId: string | null;
  policyType: string | null;
  decision: string;
  context: unknown;
  result: unknown;
  createdAt: string;
};

export type AdminPolicyListResponse = {
  policies: AdminPolicy[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminPolicyDetailResponse = {
  policy: AdminPolicy;
  evaluations: AdminPolicyEvaluationEvent[];
  conflicts: AdminPolicyConflict[];
};

export type AdminPolicyAssignmentInput = {
  organizationId: string;
  inheritToChildren?: boolean;
  enabled?: boolean;
};

export type AdminCreatePolicyInput = {
  name: string;
  description?: string | null;
  policyType: AdminPolicyType;
  status?: string;
  priority?: number;
  parentPolicyId?: string | null;
  rules: Record<string, unknown>;
  assignments?: AdminPolicyAssignmentInput[];
};

export type AdminPatchPolicyInput = {
  name?: string;
  description?: string | null;
  status?: string;
  priority?: number;
  parentPolicyId?: string | null;
  rules?: Record<string, unknown>;
  assignments?: AdminPolicyAssignmentInput[];
};

export type AdminEvaluatePolicyInput = {
  organizationId?: string | null;
  policyType?: AdminPolicyType;
  includeGlobal?: boolean;
  context?: {
    capability?: string;
    resource?: string;
    usage?: number;
    featureKey?: string;
    retentionAgeDays?: number;
    workflowStep?: string;
    approvalCount?: number;
    orgStatus?: string;
    childCount?: number;
  };
};

export type AdminEvaluatePolicyResponse = {
  evaluation: AdminPolicyEvaluation;
  event: AdminPolicyEvaluationEvent;
};

/** Phase E Step 5 — analytics & operations */

export type AdminGrowthBucket = { date: string; count: number };

export type AdminLifecycleRates = {
  suspensionRate: number | null;
  restorationRate: number | null;
  transferRate: number | null;
  suspensionEvents: number;
  restorationEvents: number;
  transferEvents: number;
  current: {
    suspended: number;
    restored: number;
    transferred: number;
    totalTenants: number;
  };
};

export type AdminQuotaMetrics = {
  tenantsWithQuota: number;
  overLimitTenants: number;
  resources: Record<
    string,
    { used: number; limit: number; tenantsOver: number; avgPercent: number | null }
  >;
};

export type AdminAuditMetrics = {
  total: number;
  successCount: number;
  failureCount: number;
  successRate: number | null;
  configurationChanges: number;
  byAction: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
};

export type AdminPolicyMetrics = {
  total: number;
  byDecision: Record<string, number>;
  byType: Record<string, number>;
  allowRate: number | null;
  denyRate: number | null;
  conflictRate: number | null;
  definitions?: number;
};

export type AdminFeatureMetrics = {
  total: number;
  byStatus: Record<string, number>;
  active: number;
  inactive: number;
  killSwitchCount: number;
  averageRolloutPercent: number | null;
  flags?: Array<{
    key: string;
    status: string;
    rolloutPercent: number;
    killSwitch: boolean;
  }>;
};

export type AdminAnalyticsSummary = {
  generatedAt: string;
  tenants: {
    total: number;
    growth: AdminGrowthBucket[];
    lifecycle: AdminLifecycleRates;
  };
  users: { total: number; growth: AdminGrowthBucket[] };
  organizations: { total: number; growth: AdminGrowthBucket[] };
  policies: AdminPolicyMetrics & { definitions: number };
  features: AdminFeatureMetrics;
  quotas: AdminQuotaMetrics;
  audit: AdminAuditMetrics;
  process: {
    analyticsReads: number;
    operationsReprocess: number;
    operationsCleanup: number;
    retentionRuns: number;
    repairs: Record<string, number>;
    averageAnalyticsLatencyMs: number | null;
    averageOperationLatencyMs: number | null;
  };
};

export type AdminTenantAnalytics = {
  generatedAt: string;
  days: number;
  total: number;
  byStatus: Record<string, number>;
  growth: AdminGrowthBucket[];
  lifecycle: AdminLifecycleRates;
  quotas: AdminQuotaMetrics;
};

export type AdminPolicyAnalytics = {
  generatedAt: string;
  definitions: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  evaluations: AdminPolicyMetrics;
};

export type AdminAuditAnalytics = AdminAuditMetrics & { generatedAt: string };

export type AdminFeatureAnalytics = AdminFeatureMetrics & { generatedAt: string };

export type AdminOperationsReprocessInput = {
  targets?: Array<"tenants" | "policies" | "configuration" | "audit" | "diagnostics" | string>;
  tenantIds?: string[];
  dryRun?: boolean;
};

export type AdminOperationsCleanupInput = {
  dryRun?: boolean;
  auditDays?: number;
  policyEventDays?: number;
  lifecycleEventDays?: number;
  configurationAuditDays?: number;
  diagnosticDays?: number;
};

export type AdminOperationsReprocessResponse = {
  dryRun: boolean;
  targets: string[];
  targetCount: number;
  repaired: number;
  skipped: number;
  results: Array<{
    target: string;
    repaired: number;
    skipped: number;
    details: unknown[];
  }>;
  diagnostics: unknown;
  process: AdminAnalyticsSummary["process"];
};

export type AdminOperationsCleanupResponse = {
  cleanup: {
    deletedAudit: number;
    deletedPolicyEvents: number;
    deletedLifecycleEvents: number;
    deletedConfigurationAudits: number;
    deletedDiagnostics: number;
    cutoffs: Record<string, string>;
    policy: Record<string, number>;
    dryRun: boolean;
  };
  remainingEligible: unknown;
  process: AdminAnalyticsSummary["process"];
};

/** Phase F Step 1 — developer platform */

export type DeveloperApiKey = {
  id: string;
  organizationId: string;
  serviceAccountId: string | null;
  publicCode: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rotatedFromId: string | null;
  revokedAt: string | null;
  rateLimit: { maxRequests: number; windowMs: number };
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperWebhook = {
  id: string;
  organizationId: string;
  publicCode: string;
  name: string;
  url: string;
  secretPrefix: string;
  events: string[];
  status: string;
  retryPolicy: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  failureCount: number;
  lastDeliveredAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperWebhookDelivery = {
  id: string;
  webhookEndpointId: string;
  organizationId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  nextRetryAt: string | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  payload?: unknown;
  responseBody?: string | null;
};

export type DeveloperServiceAccount = {
  id: string;
  organizationId: string;
  publicCode: string;
  name: string;
  description: string | null;
  status: string;
  secretPrefix: string | null;
  lastRotatedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperSdkMetadata = {
  name: string;
  version: string;
  languages: string[];
  packages: Record<string, string>;
  docsPath: string;
  openapiPath?: string;
  authSchemes: string[];
  basePath: string;
  publicBasePath?: string;
  openapi?: { json?: string; yaml?: string };
};

export type DeveloperDashboardResponse = {
  organizationId: string;
  counts: {
    keys: number;
    webhooks: number;
    serviceAccounts: number;
    deliveries: number;
  };
  sdk: DeveloperSdkMetadata;
  generatedAt: string;
};

export type DeveloperCreateKeyInput = {
  organizationId: string;
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
  serviceAccountId?: string | null;
  environment?: "live" | "test";
  rateLimit?: { maxRequests?: number; windowMs?: number };
};

export type DeveloperPatchKeyInput = {
  name?: string;
  scopes?: string[];
  expiresAt?: string | null;
  status?: "active" | "revoked";
  rotate?: boolean;
  rateLimit?: { maxRequests?: number; windowMs?: number } | null;
};

export type DeveloperCreateWebhookInput = {
  organizationId: string;
  name: string;
  url: string;
  events?: string[];
  retryPolicy?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
};

export type DeveloperPatchWebhookInput = {
  name?: string;
  url?: string;
  events?: string[];
  status?: string;
  retryPolicy?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
  rotateSecret?: boolean;
};

export type DeveloperCreateServiceAccountInput = {
  organizationId: string;
  name: string;
  description?: string | null;
};

export type DeveloperPatchServiceAccountInput = {
  name?: string;
  description?: string | null;
  status?: "active" | "suspended";
  rotate?: boolean;
};
