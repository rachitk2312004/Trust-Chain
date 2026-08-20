import { Badge } from "@trustchain/ui";
import {
  approvalStatusTone,
  signatureEventTone,
  workflowStatusTone,
} from "../../lib/signatureErrors";
import type {
  SignatureApprovalEvent,
  SignatureApprovalSummary,
  SignatureApprovalWorkflow,
} from "../../types/api";

export function WorkflowTimeline({
  workflow,
  approvals,
  events = [],
}: {
  workflow: SignatureApprovalWorkflow;
  approvals: SignatureApprovalSummary[];
  events?: SignatureApprovalEvent[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={workflowStatusTone(workflow.status)}>{workflow.status}</Badge>
          <Badge tone="neutral">{workflow.workflowType}</Badge>
          {workflow.thresholdCount != null ? (
            <Badge tone="info">threshold {workflow.thresholdCount}</Badge>
          ) : null}
          <span className="text-xs text-[var(--tc-muted)]">Step {workflow.currentStep}</span>
        </div>
        <ol className="space-y-3">
          {approvals.map((approval) => (
            <li
              key={approval.id}
              className="rounded border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={approvalStatusTone(approval.status)}>{approval.status}</Badge>
                <span className="font-medium">Step {approval.stepOrder}</span>
                <span className="font-mono text-xs text-[var(--tc-muted)]">
                  {approval.reviewerId}
                </span>
              </div>
              {approval.comment ? (
                <p className="text-[var(--tc-muted)]">{approval.comment}</p>
              ) : null}
              {approval.decidedAt ? (
                <p className="mt-1 text-xs text-[var(--tc-muted)]">
                  Decided {new Date(approval.decidedAt).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {events.length ? (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Audit log</h3>
          {events.map((event, index) => (
            <div
              key={event.id}
              className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={signatureEventTone(event.eventType)}>{event.eventType}</Badge>
                <span className="text-xs text-[var(--tc-muted)]">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
                {index === 0 ? <Badge tone="info">latest</Badge> : null}
              </div>
              <pre className="max-h-32 overflow-auto rounded bg-[var(--tc-surface-2)] p-2 text-xs">
                {JSON.stringify(event.payload ?? {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
