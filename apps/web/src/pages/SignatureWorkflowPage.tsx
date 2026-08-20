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
  ApprovalWorkflowDialog,
  WorkflowFilters,
  useSignatureWorkflows,
} from "../features/signatures";
import type { WorkflowFilterState } from "../features/signatures/WorkflowFilters";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  workflowStatusTone,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

export function SignatureWorkflowPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const [filters, setFilters] = useState<WorkflowFilterState>({
    search: "",
    status: "",
    workflowType: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const list = useSignatureWorkflows(organizationId, {
    status: filters.status || undefined,
    limit: 100,
  });

  const rows = useMemo(() => {
    const items = list.data?.workflows ?? [];
    const q = filters.search.trim().toLowerCase();
    return items.filter((wf) => {
      if (filters.workflowType && wf.workflowType !== filters.workflowType) return false;
      if (!q) return true;
      return (
        wf.title.toLowerCase().includes(q) ||
        wf.publicId.toLowerCase().includes(q) ||
        wf.workflowType.toLowerCase().includes(q)
      );
    });
  }, [list.data, filters]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Approval workflows" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Approval workflows"
        description="Sequential, parallel, and threshold multi-party signature approvals."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can capability="signatures.create" organizationId={organizationId}>
              <Button onClick={() => setCreateOpen(true)}>New workflow</Button>
            </Can>
            <Button variant="ghost" onClick={() => navigate("/signatures")}>
              Signatures
            </Button>
          </div>
        }
      />

      <WorkflowFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ search: "", status: "", workflowType: "" })}
      />

      {list.isError ? <FormError>{getSignatureErrorMessage(list.error)}</FormError> : null}

      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading workflows…</p>
      ) : (
        <VirtualizedTable
          rows={rows}
          getRowKey={(wf) => wf.id}
          header={
            <>
              <TH>Public ID</TH>
              <TH>Title</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </>
          }
          empty={<FormHint>No approval workflows yet.</FormHint>}
          renderRow={(wf) => (
            <>
              <TD>
                <Link
                  to={`/signatures/workflows/${wf.id}`}
                  className="font-medium text-[var(--tc-accent)] hover:underline"
                >
                  {wf.publicId}
                </Link>
              </TD>
              <TD>{wf.title}</TD>
              <TD>{wf.workflowType}</TD>
              <TD>
                <Badge tone={workflowStatusTone(wf.status)}>{wf.status}</Badge>
              </TD>
              <TD>{new Date(wf.createdAt).toLocaleString()}</TD>
            </>
          )}
        />
      )}

      <ApprovalWorkflowDialog
        organizationId={organizationId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          feedback.success("Approval workflow created");
          navigate(`/signatures/workflows/${id}`);
        }}
      />
    </AppShellLayout>
  );
}
