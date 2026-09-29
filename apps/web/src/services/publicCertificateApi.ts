import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";
import type { CertificateTrustChain, CertificateVerificationResult } from "../types/api";

export type PublicCertificateVerifyResponse = {
  certificate: {
    publicId: string;
    title: string;
    recipientName: string;
    status: string;
    issuedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    revokeReason: string | null;
    organizationName: string | null;
    integrityHash?: string;
    verificationUrl?: string;
  };
  verification: CertificateVerificationResult;
  chain?: CertificateTrustChain;
};

import { tokenVault } from "../lib/tokenVault";
import { useSessionStore } from "../lib/sessionStore";

const publicClient = axios.create({
  baseURL: `${getApiBaseUrl()}/api/public`,
  headers: { "content-type": "application/json" },
  timeout: 30_000,
});

publicClient.interceptors.request.use((config) => {
  const token = tokenVault.getAccessToken() ?? useSessionStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const publicCertificateApi = {
  verify(publicId: string) {
    return publicClient.get<PublicCertificateVerifyResponse>(
      `/certificates/verify/${encodeURIComponent(publicId)}`,
    );
  },
};
