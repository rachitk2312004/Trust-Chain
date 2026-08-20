import { Suspense } from "react";
import { Outlet } from "react-router-dom";

/** Lazy route fallback inside the persistent shell (sidebar stays visible). */
export function ShellContent() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-sm text-tc-muted" aria-live="polite">
          Loading…
        </p>
      }
    >
      <Outlet />
    </Suspense>
  );
}
