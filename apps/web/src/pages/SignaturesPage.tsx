import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  TD,
  TH,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import { VirtualizedTable } from "../components/VirtualizedTable";
import {
  CreateSignatureDialog,
  DetachedSignatureDialog,
  SignatureFilters,
  useSignatures,
} from "../features/signatures";
import type { SignatureFilterState } from "../features/signatures/SignatureFilters";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  signatureStatusTone,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

export function SignaturesPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const [filters, setFilters] = useState<SignatureFilterState>({
    search: "",
    status: "",
    algorithm: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [detachedOpen, setDetachedOpen] = useState(false);
  const list = useSignatures(organizationId, {
    status: filters.status || undefined,
    limit: 100,
  });

  const rows = useMemo(() => {
    const items = list.data?.signatures ?? [];
    const q = filters.search.trim().toLowerCase();
    return items.filter((sig) => {
      if (filters.algorithm && sig.algorithm !== filters.algorithm) return false;
      if (!q) return true;
      const workflow =
        typeof sig.metadata?.workflow === "string" ? sig.metadata.workflow : "";
      return (
        sig.publicId.toLowerCase().includes(q) ||
        sig.algorithm.toLowerCase().includes(q) ||
        (sig.documentId?.toLowerCase().includes(q) ?? false) ||
        (sig.certificateId?.toLowerCase().includes(q) ?? false) ||
        workflow.toLowerCase().includes(q)
      );
    });
  }, [list.data, filters.search, filters.algorithm]);

  const totals = useMemo(() => {
    const items = list.data?.signatures ?? [];
    return {
      total: list.data?.total ?? items.length,
      active: items.filter((s) => s.status === "active").length,
      revoked: items.filter((s) => s.status === "revoked").length,
      expired: items.filter((s) => s.status === "expired").length,
    };
  }, [list.data]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Signatures" description="Create and verify digital signatures." />
        <FormHint>
          Select an organization in the switcher, or{" "}
          <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
            create one
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Signatures"
        description="Sign documents and certificates, verify integrity, and manage detached payloads."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can capability="signatures.create" organizationId={organizationId}>
              <Button onClick={() => setCreateOpen(true)}>Create signature</Button>
              <Button variant="secondary" onClick={() => setDetachedOpen(true)}>
                Detached
              </Button>
            </Can>
            <Button variant="ghost" onClick={() => navigate("/signatures/detached")}>
              Detached studio
            </Button>
            <Button variant="ghost" onClick={() => navigate("/signatures/workflows")}>
              Approvals
            </Button>
            <Can capability="signatures.manage" organizationId={organizationId}>
              <Button variant="ghost" onClick={() => navigate("/signatures/analytics")}>
                Analytics
              </Button>
            </Can>
            <Button variant="ghost" onClick={() => navigate("/signatures/history")}>
              History
            </Button>
            <Button variant="ghost" onClick={() => navigate("/signatures/policies")}>
              Policies
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
            <CardDescription>{list.isLoading ? "—" : totals.total}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>{list.isLoading ? "—" : totals.active}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revoked</CardTitle>
            <CardDescription>{list.isLoading ? "—" : totals.revoked}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expired</CardTitle>
            <CardDescription>{list.isLoading ? "—" : totals.expired}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <SignatureFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ search: "", status: "", algorithm: "" })}
      />

      {list.isError ? <FormError>{getSignatureErrorMessage(list.error)}</FormError> : null}

      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading signatures…</p>
      ) : (
        <VirtualizedTable
          rows={rows}
          getRowKey={(sig) => sig.id}
          header={
            <>
              <TH>Public ID</TH>
              <TH>Algorithm</TH>
              <TH>Workflow</TH>
              <TH>Status</TH>
              <TH>Signed</TH>
            </>
          }
          empty={<FormHint>No signatures yet. Create one to get started.</FormHint>}
          renderRow={(sig) => (
            <>
              <TD>
                <Link
                  to={`/signatures/${sig.id}`}
                  className="font-medium text-[var(--tc-accent)] hover:underline"
                >
                  {sig.publicId}
                </Link>
              </TD>
              <TD>{sig.algorithm}</TD>
              <TD>
                {typeof sig.metadata?.workflow === "string" ? sig.metadata.workflow : "generic"}
              </TD>
              <TD>
                <Badge tone={signatureStatusTone(sig.status)}>{sig.status}</Badge>
              </TD>
              <TD>{new Date(sig.signedAt).toLocaleString()}</TD>
            </>
          )}
        />
      )}

      <CreateSignatureDialog
        organizationId={organizationId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id, privateKey) => {
          if (privateKey) {
            feedback.warning(
              "Signature created — save the private key",
              "A one-time private key was generated and is not stored on the server.",
            );
          } else {
            feedback.success("Signature created");
          }
          navigate(`/signatures/${id}`);
        }}
      />
      <DetachedSignatureDialog
        organizationId={organizationId}
        open={detachedOpen}
        onClose={() => setDetachedOpen(false)}
        onSigned={(id, privateKey) => {
          if (privateKey) {
            feedback.warning(
              "Detached signature created — save the private key",
              "A one-time private key was generated and is not stored on the server.",
            );
          } else {
            feedback.success("Detached signature created");
          }
          navigate(`/signatures/${id}`);
        }}
      />
    </AppShellLayout>
  );
}
