import { Link } from "react-router-dom";
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useSignaturePolicies } from "../features/signatures";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getSignatureErrorMessage } from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

function boolBadge(value: boolean) {
  return <Badge tone={value ? "success" : "danger"}>{value ? "enabled" : "disabled"}</Badge>;
}

export function SignaturePoliciesPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const policies = useSignaturePolicies(organizationId);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature policies" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  const policy = policies.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Signature policies"
        description="Organization signing defaults applied by the signature workflows."
        actions={
          <Link to="/signatures" className="text-sm text-[var(--tc-accent)] hover:underline">
            Back to signatures
          </Link>
        }
      />

      {policies.isError ? <FormError>{getSignatureErrorMessage(policies.error)}</FormError> : null}
      {policies.isLoading || !policy ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading policies…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Algorithms</CardTitle>
              <CardDescription>Default and allowed signing algorithms</CardDescription>
            </CardHeader>
            <div className="space-y-3 px-4 pb-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-[var(--tc-muted)]">Default</span>
                <span className="font-mono">{policy.defaultAlgorithm}</span>
              </div>
              <div>
                <p className="mb-2 text-[var(--tc-muted)]">Allowed</p>
                <div className="flex flex-wrap gap-2">
                  {policy.allowedAlgorithms.map((alg) => (
                    <Badge key={alg} tone="info">
                      {alg}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expiration</CardTitle>
              <CardDescription>Default and maximum lifetime</CardDescription>
            </CardHeader>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 px-4 pb-4 text-sm">
              <dt className="text-[var(--tc-muted)]">Require expiration</dt>
              <dd>{boolBadge(policy.requireExpiration)}</dd>
              <dt className="text-[var(--tc-muted)]">Default days</dt>
              <dd>{policy.defaultExpirationDays ?? "—"}</dd>
              <dt className="text-[var(--tc-muted)]">Max days</dt>
              <dd>{policy.maxExpirationDays ?? "unlimited"}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>Which signing flows are permitted</CardDescription>
            </CardHeader>
            <dl className="grid grid-cols-[12rem_1fr] gap-x-3 gap-y-2 px-4 pb-4 text-sm">
              <dt className="text-[var(--tc-muted)]">Document signing</dt>
              <dd>{boolBadge(policy.allowDocumentSigning)}</dd>
              <dt className="text-[var(--tc-muted)]">Certificate signing</dt>
              <dd>{boolBadge(policy.allowCertificateSigning)}</dd>
              <dt className="text-[var(--tc-muted)]">Detached signing</dt>
              <dd>{boolBadge(policy.allowDetached)}</dd>
              <dt className="text-[var(--tc-muted)]">Revoke by signer</dt>
              <dd>{boolBadge(policy.allowRevokeBySigner)}</dd>
              <dt className="text-[var(--tc-muted)]">Revoke by admin</dt>
              <dd>{boolBadge(policy.allowRevokeByAdmin)}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signable statuses</CardTitle>
              <CardDescription>Eligible document and certificate states</CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Target</TH>
                    <TH>Statuses</TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD>Documents</TD>
                    <TD>{policy.signableDocumentStatuses.join(", ")}</TD>
                  </TR>
                  <TR>
                    <TD>Certificates</TD>
                    <TD>{policy.signableCertificateStatuses.join(", ")}</TD>
                  </TR>
                </TBody>
              </Table>
              <FormHint>
                Policies are currently served from platform defaults. Per-organization persistence
                arrives in a later step.
              </FormHint>
            </div>
          </Card>
        </div>
      )}
    </AppShellLayout>
  );
}
