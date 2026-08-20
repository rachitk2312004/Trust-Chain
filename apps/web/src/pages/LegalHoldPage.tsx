import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label, Textarea } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  LegalHoldTable,
  useCreateLegalHold,
  useLegalHolds,
  usePatchLegalHold,
} from "../features/retention";

export function LegalHoldPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const holds = useLegalHolds(organizationId, canManage);
  const create = useCreateLegalHold();
  const patch = usePatchLegalHold();

  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("all");
  const [targetType, setTargetType] = useState("document");
  const [targetIds, setTargetIds] = useState("");

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Legal holds" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Legal holds" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Legal holds"
        description="Freeze archive and purge for org-wide, type, or target-scoped litigation holds."
        actions={
          <Link to="/retention" className="text-sm text-[var(--tc-accent)] hover:underline">
            Retention
          </Link>
        }
      />

      {holds.isError ? <FormError>{getApiErrorMessage(holds.error)}</FormError> : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
      {patch.isError ? <FormError>{getApiErrorMessage(patch.error)}</FormError> : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Create hold
        </h2>
        <form
          className="space-y-3 rounded border border-[var(--tc-border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              organizationId,
              name,
              reason,
              scope,
              targetType: scope === "all" ? undefined : targetType,
              targetIds:
                scope === "targets"
                  ? targetIds
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : undefined,
            });
            setName("");
            setReason("");
            setTargetIds("");
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="hold-name">Name</Label>
              <Input id="hold-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="hold-scope">Scope</Label>
              <select
                id="hold-scope"
                className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="all">all</option>
                <option value="target_type">target_type</option>
                <option value="targets">targets</option>
              </select>
            </div>
          </div>
          {scope !== "all" ? (
            <div>
              <Label htmlFor="hold-type">Target type</Label>
              <select
                id="hold-type"
                className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                <option value="document">document</option>
                <option value="certificate">certificate</option>
                <option value="signature">signature</option>
                <option value="audit_event">audit_event</option>
                <option value="evidence">evidence</option>
                <option value="report">report</option>
              </select>
            </div>
          ) : null}
          {scope === "targets" ? (
            <div>
              <Label htmlFor="hold-ids">Target ids (comma-separated)</Label>
              <Input
                id="hold-ids"
                value={targetIds}
                onChange={(e) => setTargetIds(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="hold-reason">Reason</Label>
            <Textarea
              id="hold-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
            />
          </div>
          <Button type="submit" disabled={create.isPending || !name || !reason}>
            {create.isPending ? "Creating…" : "Create hold"}
          </Button>
        </form>
      </section>

      <section>
        {holds.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading holds…</p>
        ) : (
          <LegalHoldTable
            holds={holds.data?.holds ?? []}
            releasingId={patch.isPending ? String(patch.variables?.id ?? "") : null}
            onRelease={(id) => patch.mutate({ id, body: { status: "released" } })}
          />
        )}
      </section>
    </AppShellLayout>
  );
}
