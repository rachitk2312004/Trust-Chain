import { apiClient } from "./http";

export type MarketplaceListing = {
  id: string;
  publisherOrgId: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  category: string;
  connectorKey: string | null;
  authMode: string;
  status: string;
  latestVersion: string | null;
  installCount: number;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{
    id: string;
    version: string;
    changelog: string | null;
    minPlatformVersion: string;
    maxPlatformVersion: string | null;
    isLatest: boolean;
    publishedAt: string | null;
  }>;
  compatibility?: {
    compatible: boolean;
    reasons: string[];
    platformVersion: string;
    resolvedVersion: string;
  } | null;
};

export type MarketplaceAnalytics = {
  listingsPublished: number;
  listingsDraft: number;
  totalInstalls: number;
  activeInstalls: number;
  averageRating: number;
  reviewCount: number;
  ratingDistribution: Record<string, number>;
  topCategories: Array<{ category: string; installs: number; listings: number }>;
  topRated: Array<{
    id: string;
    averageRating: number;
    reviewCount: number;
    installCount: number;
  }>;
};

export const marketplaceApi = {
  list(params: {
    organizationId: string;
    category?: string;
    status?: string;
    publisherOrgId?: string;
    q?: string;
  }) {
    return apiClient.get<{
      listings: MarketplaceListing[];
      installations: Array<{
        id: string;
        listingId: string;
        status: string;
        installedVersion: string;
      }>;
      total: number;
      platformVersion: string;
    }>("/marketplace", { params });
  },

  publish(body: Record<string, unknown>) {
    return apiClient.post<{
      listing: MarketplaceListing;
      version: { id: string; version: string; isLatest: boolean };
    }>("/marketplace/connectors", body);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{
      listing: MarketplaceListing;
      version: { id: string; version: string } | null;
    }>(`/marketplace/connectors/${id}`, body);
  },

  install(body: {
    organizationId: string;
    listingId: string;
    version?: string;
    review?: { rating: number; title: string; body?: string };
  }) {
    return apiClient.post<{
      installation: {
        id: string;
        status: string;
        installedVersion: string;
        listingId: string;
        ecosystemIntegrationId?: string | null;
      };
      review: unknown;
      reused: boolean;
    }>("/marketplace/install", body);
  },

  reviews(params?: { organizationId?: string; listingId?: string; limit?: number }) {
    return apiClient.get<{
      reviews: Array<{
        id: string;
        listingId: string;
        listingName: string;
        rating: number;
        title: string;
        body: string | null;
        createdAt: string;
      }>;
      aggregation: {
        averageRating: number;
        reviewCount: number;
        distribution: Record<string, number>;
      };
      total: number;
    }>("/marketplace/reviews", { params });
  },

  analytics(params: { organizationId?: string; publisherOrgId?: string }) {
    return apiClient.get<{
      analytics: MarketplaceAnalytics;
      platformVersion: string;
    }>("/marketplace/analytics", { params });
  },
};
