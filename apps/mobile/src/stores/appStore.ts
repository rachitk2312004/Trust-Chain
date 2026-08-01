import { create } from "zustand";
import { MobileAppStates } from "@trustchain/config";
import type {
  DocumentSummary,
  FeatureFlags,
  HealthMetrics,
  MobileAppState,
  OrganizationSummary,
  PublicReportView,
} from "../types/mobile.types";
import { defaultFlags } from "../flags/local/store";

type AppStore = {
  apiBaseUrl: string;
  appState: MobileAppState;
  sessionId: string | null;
  accessToken: string | null;
  organizationId: string | null;
  organizations: OrganizationSummary[];
  documents: DocumentSummary[];
  lastReport: PublicReportView | null;
  lastFromCache: boolean;
  lastCachedAt: string | null;
  health: HealthMetrics | null;
  flags: FeatureFlags;
  setApiBaseUrl: (url: string) => void;
  setAppState: (state: MobileAppState) => void;
  setSessionId: (id: string | null) => void;
  setAccessToken: (token: string | null) => void;
  setOrganizationId: (id: string | null) => void;
  setOrganizations: (orgs: OrganizationSummary[]) => void;
  setDocuments: (docs: DocumentSummary[]) => void;
  setLastReport: (
    report: PublicReportView | null,
    meta?: { fromCache?: boolean; cachedAt?: string | null },
  ) => void;
  setHealth: (health: HealthMetrics) => void;
  setFlags: (flags: FeatureFlags) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  appState: MobileAppStates.online,
  sessionId: null,
  accessToken: null,
  organizationId: null,
  organizations: [],
  documents: [],
  lastReport: null,
  lastFromCache: false,
  lastCachedAt: null,
  health: null,
  flags: defaultFlags(),
  setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
  setAppState: (appState) => set({ appState }),
  setSessionId: (sessionId) => set({ sessionId }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setOrganizationId: (organizationId) => set({ organizationId }),
  setOrganizations: (organizations) => set({ organizations }),
  setDocuments: (documents) => set({ documents }),
  setLastReport: (lastReport, meta) =>
    set({
      lastReport,
      lastFromCache: meta?.fromCache ?? false,
      lastCachedAt: meta?.cachedAt ?? null,
    }),
  setHealth: (health) => set({ health }),
  setFlags: (flags) => set({ flags }),
}));
