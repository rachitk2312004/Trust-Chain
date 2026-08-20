import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@trustchain/ui";
import { useOrganizationMembers } from "../organizations/hooks";
import { useSignatures } from "./hooks";
import { useCreateSignatureWorkflow } from "./hooks";
import { getSignatureErrorMessage } from "../../lib/signatureErrors";

export function ApprovalWorkflowDialog({
  organizationId,
  open,
  onClose,
  onCreated,
  defaultSignatureId,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (workflowId: string) => void;
  defaultSignatureId?: string;
}) {
  const create = useCreateSignatureWorkflow(organizationId);
  const members = useOrganizationMembers(organizationId, open);
  const signatures = useSignatures(organizationId, { limit: 100 });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workflowType, setWorkflowType] = useState<"sequential" | "parallel" | "threshold">(
    "sequential",
  );
  const [thresholdCount, setThresholdCount] = useState("2");
  const [signatureId, setSignatureId] = useState(defaultSignatureId ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    create.reset();
    if (defaultSignatureId) setSignatureId(defaultSignatureId);
  }, [open, defaultSignatureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberOptions = useMemo(() => members.data ?? [], [members.data]);

  function reset() {
    setTitle("");
    setDescription("");
    setWorkflowType("sequential");
    setThresholdCount("2");
    setSignatureId(defaultSignatureId ?? "");
    setExpiresAt("");
    setSelectedReviewers([]);
    create.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleReviewer(userId: string) {
    setSelectedReviewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        workflowType,
        signatureId: signatureId || null,
        thresholdCount:
          workflowType === "threshold" ? Number.parseInt(thresholdCount, 10) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        reviewers: selectedReviewers.map((reviewerId, index) => ({
          reviewerId,
          stepOrder: workflowType === "sequential" ? index + 1 : 1,
        })),
      },
      {
        onSuccess: (result) => {
          handleClose();
          onCreated?.(result.workflow.id);
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Create approval workflow"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="approval-workflow-form"
            disabled={create.isPending || !title.trim() || selectedReviewers.length === 0}
          >
            {create.isPending ? "Creating…" : "Create workflow"}
          </Button>
        </>
      }
    >
      <form id="approval-workflow-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="wf-title">Title</Label>
          <Input
            id="wf-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dual control approval"
          />
        </Field>
        <Field>
          <Label htmlFor="wf-description">Description (optional)</Label>
          <Textarea
            id="wf-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="wf-type">Workflow type</Label>
          <Select
            id="wf-type"
            value={workflowType}
            onChange={(e) =>
              setWorkflowType(e.target.value as "sequential" | "parallel" | "threshold")
            }
          >
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel (all must approve)</option>
            <option value="threshold">Threshold (N of M)</option>
          </Select>
        </Field>
        {workflowType === "threshold" ? (
          <Field>
            <Label htmlFor="wf-threshold">Threshold count</Label>
            <Input
              id="wf-threshold"
              type="number"
              min={1}
              max={selectedReviewers.length || 50}
              value={thresholdCount}
              onChange={(e) => setThresholdCount(e.target.value)}
            />
          </Field>
        ) : null}
        <Field>
          <Label htmlFor="wf-signature">Linked signature (optional)</Label>
          <Select
            id="wf-signature"
            value={signatureId}
            onChange={(e) => setSignatureId(e.target.value)}
          >
            <option value="">None</option>
            {(signatures.data?.signatures ?? []).map((sig) => (
              <option key={sig.id} value={sig.id}>
                {sig.publicId}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="wf-expires">Expires (optional)</Label>
          <Input
            id="wf-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">Reviewers</p>
          <FormHint>Select organization members. Sequential order follows selection order.</FormHint>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded border border-[var(--tc-border)] p-2">
            {memberOptions.length === 0 ? (
              <FormHint>No members loaded.</FormHint>
            ) : (
              memberOptions.map((member) => {
                const userId = member.userId;
                const label =
                  [member.firstName, member.lastName].filter(Boolean).join(" ") ||
                  member.email ||
                  userId;
                return (
                  <label key={userId} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedReviewers.includes(userId)}
                      onChange={() => toggleReviewer(userId)}
                    />
                    <span>
                      {label}
                      {member.email && label !== member.email ? (
                        <span className="text-[var(--tc-muted)]"> · {member.email}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <FormError>{create.error ? getSignatureErrorMessage(create.error) : null}</FormError>
      </form>
    </Modal>
  );
}
