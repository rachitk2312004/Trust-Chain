import axios from "axios";
import { apiClient } from "./http";
import { getApiBaseUrl } from "../lib/apiBase";
import type {
  PublicVerificationReport,
  StartVerificationResponse,
  VerificationDetailResponse,
  VerificationListResponse,
} from "../types/api";

export type ListVerificationsParams = {
  status?: string;
  outcome?: string;
  documentId?: string;
  limit?: number;
  offset?: number;
};

export type StartVerifyInput = {
  mode?: "sync" | "async";
  documentVersionId?: string;
  expectedContentHash?: string;
  rehashFromR2?: boolean;
  requireAnchor?: boolean;
  requireLiveChain?: boolean;
  idempotencyKey?: string;
};

export type PublicVerifyBody = {
  verificationCode?: string;
  contentHash?: string;
  transactionHash?: string;
  publicVerifyCode?: string;
  token?: string;
};

/** Anonymous public verification client (`/api/public`). */
export const publicVerificationClient = axios.create({
  baseURL: `${getApiBaseUrl()}/api/public`,
  headers: { "content-type": "application/json" },
  timeout: 30_000,
});

function orgPath(organizationId: string) {
  return `/organizations/${organizationId}`;
}

export const verificationApi = {
  list(organizationId: string, params?: ListVerificationsParams) {
    return apiClient.get<VerificationListResponse>(`${orgPath(organizationId)}/verifications`, {
      params,
    });
  },
  get(organizationId: string, verificationId: string) {
    return apiClient.get<VerificationDetailResponse>(
      `${orgPath(organizationId)}/verifications/${verificationId}`,
    );
  },
  history(
    organizationId: string,
    documentId: string,
    params?: { limit?: number; offset?: number },
  ) {
    return apiClient.get<VerificationListResponse>(
      `${orgPath(organizationId)}/documents/${documentId}/verification-history`,
      { params },
    );
  },
  status(organizationId: string, documentId: string) {
    return apiClient.get(`${orgPath(organizationId)}/documents/${documentId}/verification-status`);
  },
  verifyDocument(organizationId: string, documentId: string, body: StartVerifyInput = {}) {
    return apiClient.post<StartVerificationResponse>(
      `${orgPath(organizationId)}/documents/${documentId}/verify`,
      body,
    );
  },
  publicVerify(body: PublicVerifyBody) {
    return publicVerificationClient.post<{ report: PublicVerificationReport }>("/verify", body);
  },
  publicByHash(hash: string) {
    return publicVerificationClient.get<{ report: PublicVerificationReport }>(
      `/hash/${encodeURIComponent(hash)}`,
    );
  },
  publicByCode(code: string) {
    return publicVerificationClient.get<{ report: PublicVerificationReport }>(
      `/verify/${encodeURIComponent(code)}`,
    );
  },
  publicByTx(transactionHash: string) {
    return publicVerificationClient.get<{ report: PublicVerificationReport }>(
      `/tx/${encodeURIComponent(transactionHash)}`,
    );
  },
  publicByDocumentCode(publicVerifyCode: string) {
    return publicVerificationClient.get<{ report: PublicVerificationReport }>(
      `/document/${encodeURIComponent(publicVerifyCode)}`,
    );
  },
  publicByLinkToken(token: string) {
    return publicVerificationClient.get<{ report: PublicVerificationReport }>(
      `/link/${encodeURIComponent(token)}`,
    );
  },
};
