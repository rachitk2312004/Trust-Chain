import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminTopBar } from "../components/AdminTopBar";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";

export function AdminShellLayout({ children }: { children: ReactNode }) {
  const roles = useSessionStore((s) => s.roles);
  const { isSuperAdmin } = usePermissions();

  // Roles briefly empty during token refresh / bootstrap — don't bounce to workspace.
  if (!roles.length) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--tc-muted)]">
        Loading admin console…
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen bg-tc-canvas">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="tc-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
