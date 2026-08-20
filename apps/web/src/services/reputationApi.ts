import { apiClient } from "./http";

export type ReputationProfile = {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  label: string | null;
  status: string;
  trustScore: number;
  contributionScore: number;
  fraudScore: number;
  overallScore: number;
  signals: unknown;
  lastScoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReputationSummary = {
  total: number;
  averageOverall: number;
  flagged: number;
  openAlerts: number;
};

export type ReputationHistoryEvent = {
  id: string;
  profileId: string;
  subjectType: string;
  subjectId: string;
  label: string | null;
  trustScore: number;
  contributionScore: number;
  fraudScore: number;
  overallScore: number;
  reason: string;
  meta: unknown;
  createdAt: string;
};

export type ReputationAlert = {
  id: string;
  profileId: string | null;
  severity: string;
  status: string;
  alertType: string;
  title: string;
  detail: string;
  scoreSnapshot: number | null;
  subjectType: string | null;
  subjectId: string | null;
  label: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  subjectType: string;
  subjectId: string;
  label: string | null;
  overallScore: number;
  trustScore: number;
};

export type ReputationTrend = {
  delta: number;
  direction: "up" | "down" | "flat";
  average: number;
};

export const reputationApi = {
  list(params: {
    organizationId: string;
    subjectType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      organizationId: string;
      profiles: ReputationProfile[];
      summary: ReputationSummary;
      total: number;
      limit: number;
      offset: number;
    }>("/reputation", { params });
  },

  score(body: Record<string, unknown>) {
    return apiClient.post<{
      profile: ReputationProfile;
      breakdown: unknown;
      fraud: unknown;
      alert: { id: string; severity: string; title: string; status: string } | null;
    }>("/reputation/score", body);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{
      profile: ReputationProfile;
      breakdown: unknown;
      fraud: unknown;
      alert: unknown;
    }>(`/reputation/${id}`, body);
  },

  history(params: {
    organizationId: string;
    profileId?: string;
    subjectType?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      events: ReputationHistoryEvent[];
      trend: ReputationTrend;
      total: number;
      limit: number;
      offset: number;
    }>("/reputation/history", { params });
  },

  alerts(params: {
    organizationId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      alerts: ReputationAlert[];
      counts: { open: number; critical: number };
      total: number;
      limit: number;
      offset: number;
    }>("/reputation/alerts", { params });
  },

  leaderboard(params: {
    organizationId: string;
    subjectType?: string;
    limit?: number;
  }) {
    return apiClient.get<{
      organizationId: string;
      subjectType: string | null;
      leaderboard: LeaderboardEntry[];
    }>("/reputation/leaderboard", { params });
  },
};
