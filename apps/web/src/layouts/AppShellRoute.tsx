import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopBar } from "../components/AppTopBar";
import { WorkspaceRoleRedirect } from "../components/WorkspaceRoleRedirect";

/** Persistent authenticated shell — must not be reused inside page components. */
export function AppShellRoute() {
  return (
    <div className="flex min-h-screen bg-tc-canvas">
      <WorkspaceRoleRedirect />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="tc-page">
            <Suspense
              fallback={
                <p className="py-8 text-sm text-tc-muted" aria-live="polite">
                  Loading…
                </p>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
