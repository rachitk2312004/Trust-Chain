import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import {
  WorkflowReviewDialog,
  WorkflowTimeline,
  useCancelSignatureWorkflow,
  useSignatureWorkflow,
} from "../features/signatures";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  workflowStatusTone,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

export function SignatureWorkflowDetailPage() {
  const navigate = useNavigate();
  const { workflowId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const userId = useSessionStore((s) => s.user?.id);
  const detail = useSignatureWorkflow(organizationId, workflowId);
  const cancel = useCancelSignatureWorkflow(organizationId ?? "");
  const feedback = useFeedback();
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Approval workflow" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (detail.isError) {
    return (
      <AppShellLayout>
        <PageHeader title="Approval workflow" />
        <FormError>{getSignatureErrorMessage(detail.error)}</FormError>
      </AppShellLayout>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <AppShellLayout>
        <PageHeader title="Approval workflow" />
        <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
      </AppShellLayout>
    );
  }

  const { workflow, approvals, events, counts } = detail.data;
  const myPending = approvals.find(
    (a) =>
      a.reviewerId === userId &&
      a.status === "pending" &&
      (workflow.workflowType !== "sequential" || a.stepOrder === workflow.currentStep),
  );

  return (
    <AppShellLayout>
      <PageHeader
        title={workflow.publicId}
        description={workflow.title}
        actions={
          <Link
            to="/signatures/workflows"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            All workflows
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={workflowStatusTone(workflow.status)}>{workflow.status}</Badge>
        <Badge tone="neutral">{workflow.workflowType}</Badge>
        {workflow.signatureId ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/signatures/${workflow.signatureId}`)}
          >
            Open signature
          </Button>
        ) : null}
        {myPending ? (
          <Can capability="signatures.verify" organizationId={organizationId}>
            <Button size="sm" variant="secondary" onClick={() => setReviewMode("approve")}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => setReviewMode("reject")}>
              Reject
            </Button>
          </Can>
        ) : null}
        {workflow.status === "pending" && workflow.createdById === userId ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(
                { workflowId, reason: "Cancelled from portal" },
                {
                  onSuccess: () => {
                    feedback.success("Workflow cancelled");
                    void detail.refetch();
                  },
                  onError: (err) => feedback.error(err, "Cancel failed"),
                },
              )
            }
          >
            Cancel workflow
          </Button>
        ) : workflow.status === "pending" ? (
          <Can capability="signatures.manage" organizationId={organizationId}>
            <Button
              size="sm"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { workflowId, reason: "Cancelled from portal" },
                  {
                    onSuccess: () => {
                      feedback.success("Workflow cancelled");
                      void detail.refetch();
                    },
                    onError: (err) => feedback.error(err, "Cancel failed"),
                  },
                )
              }
            >
              Cancel workflow
            </Button>
          </Can>
        ) : null}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
            <CardDescription>{counts.pending}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approved</CardTitle>
            <CardDescription>{counts.approved}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rejected</CardTitle>
            <CardDescription>{counts.rejected}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Skipped</CardTitle>
            <CardDescription>{counts.skipped}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {workflow.description ? (
        <p className="mb-4 text-sm text-[var(--tc-muted)]">{workflow.description}</p>
      ) : null}

      <WorkflowTimeline workflow={workflow} approvals={approvals} events={events} />

      {reviewMode ? (
        <WorkflowReviewDialog
          organizationId={organizationId}
          workflowId={workflowId}
          publicId={workflow.publicId}
          mode={reviewMode}
          open
          onClose={() => setReviewMode(null)}
          onDone={() => {
            feedback.success(reviewMode === "approve" ? "Approved" : "Rejected");
            void detail.refetch();
          }}
        />
      ) : null}
    </AppShellLayout>
  );
}
