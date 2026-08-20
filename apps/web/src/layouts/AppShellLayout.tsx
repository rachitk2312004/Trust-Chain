import type { ReactNode } from "react";

/**
 * Legacy page wrapper — passthrough only.
 * Authenticated shell lives in `AppShellRoute` (router layout). Do not reuse that component here.
 */
export function AppShellLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
