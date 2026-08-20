import { Link } from "react-router-dom";
import { useState } from "react";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { AuditTimeline, useAuditTimeline } from "../features/audit";

export function AuditTimelinePage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const [correlationId, setCorrelationId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [applied, setApplied] = useState<{
    correlationId?: string;
    requestId?: string;
    resourceType?: string;
    resourceId?: string;
  }>({});

  const timeline = useAuditTimeline(organizationId, applied, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Audit timeline" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Audit timeline" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Audit timeline"
        description="Correlate and replay immutable audit chains by correlation, request, or resource."
        actions={
          <Link to="/audit" className="text-sm text-[var(--tc-accent)] hover:underline">
            Explorer
          </Link>
        }
      />

      <form
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({
            correlationId: correlationId || undefined,
            requestId: requestId || undefined,
            resourceType: resourceType || undefined,
            resourceId: resourceId || undefined,
          });
        }}
      >
        <div>
          <Label htmlFor="corr">Correlation id</Label>
          <Input id="corr" value={correlationId} onChange={(e) => setCorrelationId(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="req">Request id</Label>
          <Input id="req" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rtype">Resource type</Label>
          <Input
            id="rtype"
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="rid">Resource id</Label>
          <Input id="rid" value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit">Load timeline</Button>
        </div>
      </form>

      {timeline.isError ? <FormError>{getApiErrorMessage(timeline.error)}</FormError> : null}
      {!applied.correlationId &&
      !applied.requestId &&
      !(applied.resourceType && applied.resourceId) ? (
        <FormHint>Enter a correlation id, request id, or resource to load a timeline.</FormHint>
      ) : timeline.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading timeline…</p>
      ) : (
        <AuditTimeline
          events={timeline.data?.events ?? []}
          buckets={timeline.data?.buckets}
          replay={timeline.data?.replay}
          chainValid={timeline.data?.chainValid}
        />
      )}
    </AppShellLayout>
  );
}
