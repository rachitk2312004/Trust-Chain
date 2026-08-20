import { SHOW_BLOCKCHAIN_WALLET_NAV } from "./demoFlags";

/** Maps sidebar paths to dynamic import loaders for hover prefetch. */
const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("../pages/DashboardPage"),
  "/documents": () => import("../pages/DocumentsPage"),
  "/search": () => import("../pages/SearchPage"),
  "/certificates": () => import("../pages/CertificatesPage"),
  "/verification": () => import("../pages/VerificationPage"),
  "/signatures": () => import("../pages/SignaturesPage"),
  "/developer": () => import("../pages/DeveloperDashboardPage"),
  "/audit": () => import("../pages/AuditExplorerPage"),
  "/admin": () => import("../pages/AdminDashboardPage"),
  // Holder workspace (eager in router — prefetch still warms transitive chunks in dev)
  "/organizations": () => import("../pages/OrganizationsPage"),
  "/notifications": () => import("../pages/NotificationsPage"),
  "/settings": () => import("../pages/SettingsPage"),
  "/sessions": () => import("../pages/SessionsPage"),
  "/verify": () => import("../pages/PublicVerificationPage"),
  "/my-certificates": () => import("../pages/MyCertificatesPage"),
  ...(SHOW_BLOCKCHAIN_WALLET_NAV
    ? { "/wallets": () => import("../pages/WalletDashboardPage") }
    : {}),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  const loader = ROUTE_LOADERS[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader();
}

/** Warm common chunks after the shell is idle (holder + employee routes). */
export function prefetchHolderRoutes(): void {
  for (const path of [
    "/organizations",
    "/notifications",
    "/settings",
    "/sessions",
    "/verify",
    "/my-certificates",
    ...(SHOW_BLOCKCHAIN_WALLET_NAV ? ["/wallets"] : []),
  ]) {
    prefetchRoute(path);
  }
}
