import { useState } from "react";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  EvidenceTable,
  EvidenceUploader,
  useCreateEvidence,
  useEvidenceList,
  useExportEvidence,
} from "../features/evidence";

export function EvidenceDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [framework, setFramework] = useState("");
  const [applied, setApplied] = useState<{ q?: string; status?: string; framework?: string }>({});

  const list = useEvidenceList(organizationId, applied, canManage);
  const create = useCreateEvidence();
  const exportJob = useExportEvidence();

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Evidence" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Evidence" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Evidence"
        description="Collect, validate, tag, version, and export compliance evidence with chain-of-custody."
        actions={
          <Button
            type="button"
            variant="ghost"
            disabled={exportJob.isPending}
            onClick={() =>
              exportJob.mutate(
                { organizationId, format: "json" },
                {
                  onSuccess: (data) => {
                    const blob = new Blob([data.export.content ?? ""], {
                      type: data.export.contentType || "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `evidence-export-${data.export.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  },
                },
              )
            }
          >
            {exportJob.isPending ? "Exporting…" : "Export JSON"}
          </Button>
        }
      />

      {list.isError ? <FormError>{getApiErrorMessage(list.error)}</FormError> : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
      {exportJob.isError ? <FormError>{getApiErrorMessage(exportJob.error)}</FormError> : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Collect
        </h2>
        <EvidenceUploader
          pending={create.isPending}
          onSubmit={(input) =>
            create.mutate({
              organizationId,
              ...input,
            })
          }
        />
      </section>

      <form
        className="mb-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({
            q: q || undefined,
            status: status || undefined,
            framework: framework || undefined,
          });
        }}
      >
        <div>
          <Label htmlFor="ev-q">Search</Label>
          <Input id="ev-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="title or code" />
        </div>
        <div>
          <Label htmlFor="ev-status">Status</Label>
          <Input
            id="ev-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="validated"
          />
        </div>
        <div>
          <Label htmlFor="ev-fw-filter">Framework</Label>
          <Input
            id="ev-fw-filter"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            placeholder="soc2"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit">Filter</Button>
        </div>
      </form>

      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading evidence…</p>
      ) : (
        <EvidenceTable evidence={list.data?.evidence ?? []} />
      )}
    </AppShellLayout>
  );
}
