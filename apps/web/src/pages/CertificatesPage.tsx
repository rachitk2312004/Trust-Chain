import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  FormError,
  FormHint,
  TD,
  TH,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import { VirtualizedTable } from "../components/VirtualizedTable";
import {
  BulkCertificateDialog,
  CertificateFilters,
  CreateCertificateDialog,
  useCertificates,
} from "../features/certificates";
import type { CertificateFilterState } from "../features/certificates/CertificateFilters";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  certificateStatusTone,
  getCertificateErrorMessage,
} from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

export function CertificatesPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgMember } = usePermissions(organizationId);
  const feedback = useFeedback();
  const [filters, setFilters] = useState<CertificateFilterState>({ search: "", status: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const list = useCertificates(organizationId, {
    status: filters.status || undefined,
    limit: 100,
  });

  const rows = useMemo(() => {
    const items = list.data?.certificates ?? [];
    const q = filters.search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((cert) => {
      return (
        cert.title.toLowerCase().includes(q) ||
        cert.publicId.toLowerCase().includes(q) ||
        cert.recipient.name.toLowerCase().includes(q) ||
        (cert.recipient.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [list.data, filters.search]);

  const totals = useMemo(() => {
    const items = list.data?.certificates ?? [];
    return {
      total: list.data?.total ?? items.length,
      issued: items.filter((c) => c.status === "issued").length,
      revoked: items.filter((c) => c.status === "revoked").length,
      expired: items.filter((c) => c.status === "expired").length,
    };
  }, [list.data]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Certificates" description="Issue and manage certificates." />
        <FormHint>
          Select an organization in the switcher, or{" "}
          <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
            view your organizations
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  if (!isOrgMember) {
    return (
      <AppShellLayout>
        <PageHeader title="Certificates" description="Issue and manage certificates." />
        <FormHint>
          Certificate management is for organization staff.{" "}
          <Link to="/my-certificates" className="text-[var(--tc-accent)] hover:underline">
            View your certificates
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Certificates"
        description="Issue printable certificates, verify integrity, and manage templates."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can capability="certificates.issue" organizationId={organizationId}>
              <Button onClick={() => setCreateOpen(true)}>Issue certificate</Button>
              <Button variant="secondary" onClick={() => setBulkOpen(true)}>
                Bulk issue
              </Button>
            </Can>
            <Button variant="secondary" onClick={() => navigate("/certificates/templates")}>
              Templates
            </Button>
            <Button variant="ghost" onClick={() => navigate("/certificates/bulk")}>
              Bulk upload
            </Button>
            <Can capability="certificates.manage" organizationId={organizationId}>
              <Button variant="ghost" onClick={() => navigate("/certificates/analytics")}>
                Analytics
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-tc-border bg-tc-surface p-5 shadow-soft">
          <p className="text-sm text-tc-muted">Total</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight">{list.isLoading ? "—" : totals.total}</p>
        </div>
        <div className="rounded-2xl border border-tc-border bg-tc-surface p-5 shadow-soft">
          <p className="text-sm text-tc-muted">Issued</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-emerald-600">{list.isLoading ? "—" : totals.issued}</p>
        </div>
        <div className="rounded-2xl border border-tc-border bg-tc-surface p-5 shadow-soft">
          <p className="text-sm text-tc-muted">Revoked</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-rose-600">{list.isLoading ? "—" : totals.revoked}</p>
        </div>
        <div className="rounded-2xl border border-tc-border bg-tc-surface p-5 shadow-soft">
          <p className="text-sm text-tc-muted">Expired</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-amber-600">{list.isLoading ? "—" : totals.expired}</p>
        </div>
      </div>

      <CertificateFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ search: "", status: "" })}
      />

      {list.isError ? <FormError>{getCertificateErrorMessage(list.error)}</FormError> : null}

      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading certificates…</p>
      ) : (
        <VirtualizedTable
          rows={rows}
          getRowKey={(cert) => cert.id}
          header={
            <>
              <TH>Public ID</TH>
              <TH>Title</TH>
              <TH>Recipient</TH>
              <TH>Status</TH>
              <TH>Issued</TH>
            </>
          }
          empty={<FormHint>No certificates yet. Issue one to get started.</FormHint>}
          renderRow={(cert) => (
            <>
              <TD>
                <Link
                  to={`/certificates/${cert.id}`}
                  className="font-medium text-[var(--tc-accent)] hover:underline"
                >
                  {cert.publicId}
                </Link>
              </TD>
              <TD>{cert.title}</TD>
              <TD>{cert.recipient.name}</TD>
              <TD>
                <Badge tone={certificateStatusTone(cert.status)}>{cert.status}</Badge>
              </TD>
              <TD>{cert.issuedAt ? new Date(cert.issuedAt).toLocaleString() : "—"}</TD>
            </>
          )}
        />
      )}

      <CreateCertificateDialog
        organizationId={organizationId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          feedback.success("Certificate issued");
          navigate(`/certificates/${id}`);
        }}
      />
      <BulkCertificateDialog
        organizationId={organizationId}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
      />
    </AppShellLayout>
  );
}
