import axios from "axios";
import { getApiBaseUrl } from "../lib/apiBase";
import type { CertificateVerificationResult } from "../types/api";

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
  };
  verification: CertificateVerificationResult;
};

const publicClient = axios.create({
  baseURL: `${getApiBaseUrl()}/api/public`,
  headers: { "content-type": "application/json" },
  timeout: 30_000,
});

export const publicCertificateApi = {
  verify(publicId: string) {
    return publicClient.get<PublicCertificateVerifyResponse>(
      `/certificates/verify/${encodeURIComponent(publicId)}`,
    );
  },
};
