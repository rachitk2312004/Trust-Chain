import { apiClient } from "./http";
import type {
  SignCertificateInput,
  SignDetachedInput,
  SignDocumentInput,
  SignatureCreateInput,
  SignatureCreateResponse,
  SignatureDetailResponse,
  SignatureHistoryResponse,
  SignatureListResponse,
  SignatureSummary,
  SignatureVerifyResponse,
  SignatureVerifyWorkflowInput,
  SignatureVerifyWorkflowResponse,
  SignatureWorkflowResponse,
} from "../types/api";

export const signatureApi = {
  list(
    organizationId: string,
    params?: { status?: string; documentId?: string; limit?: number; offset?: number },
  ) {
    return apiClient.get<SignatureListResponse>("/signatures", {
      params: { organizationId, ...params },
    });
  },

  get(organizationId: string, signatureId: string) {
    return apiClient.get<SignatureDetailResponse>(`/signatures/${signatureId}`, {
      params: { organizationId },
    });
  },

  create(body: SignatureCreateInput) {
    return apiClient.post<SignatureCreateResponse>("/signatures", body);
  },

  signDocument(body: SignDocumentInput) {
    return apiClient.post<SignatureWorkflowResponse>("/signatures/document", body);
  },

  signCertificate(body: SignCertificateInput) {
    return apiClient.post<SignatureWorkflowResponse>("/signatures/certificate", body);
  },

  signDetached(body: SignDetachedInput) {
    return apiClient.post<SignatureWorkflowResponse>("/signatures/detached", body);
  },

  verify(signatureId: string, body: { organizationId: string }) {
    return apiClient.post<SignatureVerifyResponse>(`/signatures/${signatureId}/verify`, body);
  },

  verifyWorkflow(body: SignatureVerifyWorkflowInput) {
    return apiClient.post<SignatureVerifyWorkflowResponse>("/signatures/verify", body);
  },

  revoke(signatureId: string, body: { organizationId: string; reason?: string }) {
    return apiClient.post<{ signature: SignatureSummary }>(
      `/signatures/${signatureId}/revoke`,
      body,
    );
  },

  history(
    organizationId: string,
    signatureId: string,
    params?: { limit?: number; offset?: number },
  ) {
    return apiClient.get<SignatureHistoryResponse>(`/signatures/${signatureId}/history`, {
      params: { organizationId, ...params },
    });
  },

  listWorkflows(
    organizationId: string,
    params?: {
      status?: string;
      signatureId?: string;
      reviewerId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return apiClient.get<import("../types/api").SignatureApprovalWorkflowListResponse>(
      "/signatures/workflows",
      { params: { organizationId, ...params } },
    );
  },

  getWorkflow(organizationId: string, workflowId: string) {
    return apiClient.get<import("../types/api").SignatureApprovalWorkflowDetailResponse>(
      `/signatures/workflows/${workflowId}`,
      { params: { organizationId } },
    );
  },

  createWorkflow(body: import("../types/api").CreateSignatureApprovalWorkflowInput) {
    return apiClient.post<{
      workflow: import("../types/api").SignatureApprovalWorkflow;
      approvals: import("../types/api").SignatureApprovalSummary[];
      counts: import("../types/api").SignatureApprovalWorkflowDetailResponse["counts"];
    }>("/signatures/workflows", body);
  },

  approveWorkflow(workflowId: string, body: { organizationId: string; comment?: string }) {
    return apiClient.post<{
      workflow: import("../types/api").SignatureApprovalWorkflow;
      approvals: import("../types/api").SignatureApprovalSummary[];
      counts: import("../types/api").SignatureApprovalWorkflowDetailResponse["counts"];
    }>(`/signatures/workflows/${workflowId}/approve`, body);
  },

  rejectWorkflow(workflowId: string, body: { organizationId: string; comment: string }) {
    return apiClient.post<{
      workflow: import("../types/api").SignatureApprovalWorkflow;
      approvals: import("../types/api").SignatureApprovalSummary[];
      counts: import("../types/api").SignatureApprovalWorkflowDetailResponse["counts"];
    }>(`/signatures/workflows/${workflowId}/reject`, body);
  },

  cancelWorkflow(workflowId: string, body: { organizationId: string; reason?: string }) {
    return apiClient.post<{
      workflow: import("../types/api").SignatureApprovalWorkflow;
      approvals: import("../types/api").SignatureApprovalSummary[];
      counts: import("../types/api").SignatureApprovalWorkflowDetailResponse["counts"];
    }>(`/signatures/workflows/${workflowId}/cancel`, body);
  },

  analytics(organizationId: string) {
    return apiClient.get<{ analytics: import("../types/api").SignatureAnalyticsSnapshot }>(
      "/signatures/analytics",
      { params: { organizationId } },
    );
  },

  analyticsWorkflows(organizationId: string) {
    return apiClient.get<{
      workflows: import("../types/api").SignatureAnalyticsSnapshot["workflows"];
      process: { averageApprovalTimeMs: number | null };
    }>("/signatures/analytics/workflows", { params: { organizationId } });
  },

  analyticsAlgorithms(organizationId: string) {
    return apiClient.get<{
      algorithms: import("../types/api").SignatureAnalyticsSnapshot["algorithms"];
      lifecycle: import("../types/api").SignatureAnalyticsSnapshot["lifecycle"];
    }>("/signatures/analytics/algorithms", { params: { organizationId } });
  },

  analyticsVerifications(organizationId: string) {
    return apiClient.get<{
      verification: import("../types/api").SignatureAnalyticsSnapshot["verification"];
      process: import("../types/api").SignatureAnalyticsSnapshot["process"];
    }>("/signatures/analytics/verifications", { params: { organizationId } });
  },

  analyticsDetached(organizationId: string) {
    return apiClient.get<{
      detached: import("../types/api").SignatureAnalyticsSnapshot["detached"];
      downloads: import("../types/api").SignatureAnalyticsSnapshot["downloads"];
    }>("/signatures/analytics/detached", { params: { organizationId } });
  },

  adminReprocess(
    organizationId: string,
    body?: { signatureIds?: string[]; limit?: number },
  ) {
    return apiClient.post<import("../types/api").SignatureAdminReprocessResult>(
      "/signatures/admin/reprocess",
      { organizationId, ...body },
    );
  },

  adminCleanup(
    organizationId: string,
    body?: {
      eventDays?: number;
      approvalEventDays?: number;
      workflowDays?: number;
      artifactDays?: number;
      diagnosticEventDays?: number;
    },
  ) {
    return apiClient.post<import("../types/api").SignatureAdminCleanupResult>(
      "/signatures/admin/cleanup",
      { organizationId, ...body },
    );
  },
};
