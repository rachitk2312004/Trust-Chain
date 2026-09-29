import { apiClient } from "./http";

export type OrganizationChainStatus = {
  network: {
    key: string;
    chainId: number;
    documentRegistryAddress: string | null;
  };
  registration: {
    status: string;
    ownerAddress: string | null;
    registeredAt: string | null;
  } | null;
};

export type DocumentAnchor = {
  id: string;
  documentId: string;
  documentVersionId: string;
  contentHash: string;
  versionNumber: number;
  status: string;
  blockNumber: number | null;
  blockHash: string | null;
  confirmationCount: number;
  anchoredAt: string | null;
  revokedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type DocumentChainStatus = {
  documentId: string;
  currentVersionId: string | null;
  currentContentHash: string | null;
  anchors: DocumentAnchor[];
};

function orgBase(organizationId: string) {
  return `/organizations/${organizationId}`;
}

export const blockchainApi = {
  orgStatus(organizationId: string) {
    return apiClient.get<OrganizationChainStatus>(`${orgBase(organizationId)}/blockchain`);
  },
  registerOrg(organizationId: string) {
    return apiClient.post<{
      alreadyRegistered?: boolean;
      explorerUrl?: string | null;
      registration?: { status: string };
    }>(`${orgBase(organizationId)}/blockchain/register`, {});
  },
  documentStatus(organizationId: string, documentId: string) {
    return apiClient.get<DocumentChainStatus>(
      `${orgBase(organizationId)}/documents/${documentId}/chain-status`,
    );
  },
  anchorDocument(organizationId: string, documentId: string) {
    return apiClient.post<{
      anchor: DocumentAnchor;
      transaction: { txHash: string | null };
      explorerUrl: string | null;
    }>(`${orgBase(organizationId)}/documents/${documentId}/anchor`, {});
  },
  revokeDocument(organizationId: string, documentId: string) {
    return apiClient.post<{
      anchor: DocumentAnchor;
      explorerUrl: string | null;
    }>(`${orgBase(organizationId)}/documents/${documentId}/revoke-on-chain`, {});
  },
};
