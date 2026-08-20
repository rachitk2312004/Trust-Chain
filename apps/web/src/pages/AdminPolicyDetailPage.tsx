import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { Badge, Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import {
  PolicyAssignmentDialog,
  PolicyConflictViewer,
  PolicyEditor,
  useAdminPolicy,
  useDeleteAdminPolicy,
} from "../features/admin";

export function AdminPolicyDetailPage() {
  const { policyId } = useParams<{ policyId: string }>();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const detail = useAdminPolicy(policyId, isSuperAdmin);
  const remove = useDeleteAdminPolicy();
  const [assignOpen, setAssignOpen] = useState(false);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Policy" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  if (detail.isLoading) {
    return (
      <AdminShellLayout>
        <PageHeader title="Policy" />
        <p className="text-sm text-[var(--tc-muted)]">Loading policy…</p>
      </AdminShellLayout>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <AdminShellLayout>
        <PageHeader title="Policy" />
        <FormError>{getApiErrorMessage(detail.error)}</FormError>
      </AdminShellLayout>
    );
  }

  const { policy, evaluations, conflicts } = detail.data;

  return (
    <AdminShellLayout>
      <PageHeader
        title={policy.name}
        description={`${policy.publicCode} · ${policy.policyType}`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/policies" className="text-sm text-[var(--tc-accent)] hover:underline">
              All policies
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setAssignOpen(true)}>
              Assignments
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(policy.id, {
                  onSuccess: () => {
                    feedback.success("Policy deleted");
                    navigate("/admin/policies");
                  },
                  onError: (err) => feedback.error(err, "Delete failed"),
                })
              }
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{policy.status}</Badge>
        <Badge>priority {policy.priority}</Badge>
        {policy.parentPolicyId ? <Badge>inherits parent</Badge> : null}
      </div>

      <div className="mb-8">
        <PolicyEditor mode="edit" policy={policy} />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">Conflicts</h2>
        <PolicyConflictViewer conflicts={conflicts} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent evaluations</h2>
        {evaluations.length === 0 ? (
          <FormHint>No evaluation events yet.</FormHint>
        ) : (
          <ul className="space-y-2 text-sm">
            {evaluations.map((event) => (
              <li
                key={event.id}
                className="rounded border border-[var(--tc-border)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{event.decision}</Badge>
                  <span className="text-[var(--tc-muted)]">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PolicyAssignmentDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        policy={policy}
      />
    </AdminShellLayout>
  );
}
