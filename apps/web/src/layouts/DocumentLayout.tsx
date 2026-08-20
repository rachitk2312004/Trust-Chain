import { Suspense } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { FormError } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { LoadingScreen } from "../components/ui";
import { useDocument } from "../features/documents/hooks";
import { getDocumentErrorMessage, isDocNotFound } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

const tabs = [
  { to: "", label: "Overview", end: true },
  { to: "versions", label: "Versions" },
  { to: "share", label: "Sharing" },
  { to: "history", label: "History" },
];

export function DocumentLayout() {
  const { documentId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const doc = useDocument(organizationId, documentId);

  if (!organizationId) {
    return (
      <>
        <PageHeader title="Document" />
        <FormError>Select an organization to view documents.</FormError>
      </>
    );
  }

  if (doc.isError) {
    return (
      <>
        <PageHeader title="Document" />
        <FormError>
          {isDocNotFound(doc.error) ? "Document not found." : getDocumentErrorMessage(doc.error)}
        </FormError>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={doc.data?.title ?? "Document"}
        description={
          doc.data
            ? `${doc.data.status}${doc.data.currentVersion ? ` · v${doc.data.currentVersion.versionNumber}` : ""}`
            : "Loading…"
        }
      />
      <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-tc-border bg-tc-surface p-1.5 shadow-soft">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to || "."}
            end={tab.end}
            className={({ isActive }) =>
              [
                "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                isActive
                  ? "bg-emerald-600 text-white shadow-soft"
                  : "text-tc-muted hover:bg-tc-surface-2 hover:text-tc-fg",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<LoadingScreen className="min-h-[30vh]" label="Loading section…" />}>
        <Outlet />
      </Suspense>
    </>
  );
}
