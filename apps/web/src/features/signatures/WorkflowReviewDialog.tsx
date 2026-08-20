import { useState } from "react";
import { Button, Field, FormError, Input, Label, Modal, Textarea } from "@trustchain/ui";
import { getSignatureErrorMessage } from "../../lib/signatureErrors";
import {
  useApproveSignatureWorkflow,
  useRejectSignatureWorkflow,
} from "./hooks";

export function WorkflowReviewDialog({
  organizationId,
  workflowId,
  publicId,
  mode,
  open,
  onClose,
  onDone,
}: {
  organizationId: string;
  workflowId: string;
  publicId: string;
  mode: "approve" | "reject";
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const approve = useApproveSignatureWorkflow(organizationId);
  const reject = useRejectSignatureWorkflow(organizationId);
  const [comment, setComment] = useState("");
  const pending = mode === "approve" ? approve.isPending : reject.isPending;
  const error = mode === "approve" ? approve.error : reject.error;

  function handleClose() {
    setComment("");
    approve.reset();
    reject.reset();
    onClose();
  }

  function submit() {
    if (mode === "approve") {
      approve.mutate(
        { workflowId, comment: comment.trim() || undefined },
        {
          onSuccess: () => {
            handleClose();
            onDone?.();
          },
        },
      );
      return;
    }
    reject.mutate(
      { workflowId, comment: comment.trim() },
      {
        onSuccess: () => {
          handleClose();
          onDone?.();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title={mode === "approve" ? "Approve workflow" : "Reject workflow"}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={mode === "reject" ? "danger" : "primary"}
            disabled={pending || (mode === "reject" && !comment.trim())}
            onClick={submit}
          >
            {pending ? (mode === "approve" ? "Approving…" : "Rejecting…") : mode === "approve" ? "Approve" : "Reject"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        {mode === "approve" ? "Approve" : "Reject"} <strong>{publicId}</strong>?
      </p>
      <Field>
        <Label htmlFor="wf-review-comment">
          {mode === "reject" ? "Comment (required)" : "Comment (optional)"}
        </Label>
        {mode === "reject" ? (
          <Textarea
            id="wf-review-comment"
            required
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        ) : (
          <Input
            id="wf-review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Looks good"
          />
        )}
      </Field>
      <FormError>{error ? getSignatureErrorMessage(error) : null}</FormError>
    </Modal>
  );
}
