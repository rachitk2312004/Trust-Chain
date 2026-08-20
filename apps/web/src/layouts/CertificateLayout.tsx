import { Suspense } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { Badge, FormError, FormHint } from "@trustchain/ui";
import { LoadingScreen } from "../components/ui";
import { PageHeader } from "../components/PageHeader";
import { useCertificate } from "../features/certificates";
import { certificateStatusTone, getCertificateErrorMessage } from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

const tabs = [
  { to: "", label: "Overview", end: true },
  { to: "history", label: "History" },
  { to: "verify", label: "Verify" },
];

export function CertificateLayout() {
  const { certificateId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const certificate = useCertificate(organizationId, certificateId);

  if (!organizationId) {
    return (
      <>
        <PageHeader title="Certificate" />
        <FormHint>Select an organization first.</FormHint>
      </>
    );
  }

  if (certificate.isError) {
    return (
      <>
        <PageHeader title="Certificate" />
        <FormError>{getCertificateErrorMessage(certificate.error)}</FormError>
      </>
    );
  }

  const data = certificate.data;

  return (
    <>
      <PageHeader
        title={data?.publicId ?? "Certificate"}
        description={data?.title ?? "Loading…"}
        actions={
          <Link to="/certificates" className="text-sm text-[var(--tc-accent)] hover:underline">
            All certificates
          </Link>
        }
      />

      {data ? (
        <div className="mb-4">
          <Badge tone={certificateStatusTone(data.status)}>{data.status}</Badge>
        </div>
      ) : null}

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
