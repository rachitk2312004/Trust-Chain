import { useState } from "react";
import { Button, FormError, FormHint, Input, Modal } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminPolicy, AdminPolicyAssignmentInput } from "../../types/api";
import { usePatchAdminPolicy } from "./hooks";

export function PolicyAssignmentDialog({
  open,
  onClose,
  policy,
}: {
  open: boolean;
  onClose: () => void;
  policy: AdminPolicy;
}) {
  const feedback = useFeedback();
  const patch = usePatchAdminPolicy();
  const [organizationId, setOrganizationId] = useState("");
  const [inheritToChildren, setInheritToChildren] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const existing: AdminPolicyAssignmentInput[] = policy.assignments.map((a) => ({
    organizationId: a.organizationId,
    inheritToChildren: a.inheritToChildren,
    enabled: a.enabled,
  }));

  const addAssignment = () => {
    const id = organizationId.trim();
    if (!id) return;
    const next = [
      ...existing.filter((a) => a.organizationId !== id),
      { organizationId: id, inheritToChildren, enabled },
    ];
    patch.mutate(
      { policyId: policy.id, body: { assignments: next } },
      {
        onSuccess: () => {
          feedback.success("Policy assigned");
          setOrganizationId("");
          onClose();
        },
        onError: (err) => feedback.error(err, "Assignment failed"),
      },
    );
  };

  const removeAssignment = (orgId: string) => {
    const next = existing.filter((a) => a.organizationId !== orgId);
    patch.mutate(
      { policyId: policy.id, body: { assignments: next } },
      {
        onSuccess: () => feedback.success("Assignment removed"),
        onError: (err) => feedback.error(err, "Remove failed"),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Policy assignments">
      <FormHint>
        Assign <strong>{policy.name}</strong> to organizations. Child inheritance can be enabled
        per assignment.
      </FormHint>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Organization ID</label>
          <Input
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inheritToChildren}
            onChange={(e) => setInheritToChildren(e.target.checked)}
          />
          Inherit to children
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={patch.isPending}>
            Close
          </Button>
          <Button
            disabled={!organizationId.trim() || patch.isPending}
            onClick={addAssignment}
          >
            {patch.isPending ? "Saving…" : "Assign"}
          </Button>
        </div>
        <FormError>{patch.error ? getApiErrorMessage(patch.error) : null}</FormError>
        {policy.assignments.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {policy.assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded border border-[var(--tc-border)] px-3 py-2"
              >
                <span className="font-mono text-xs">
                  {a.organizationId}
                  {!a.enabled ? " (disabled)" : ""}
                  {a.inheritToChildren ? " · inherit" : ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={patch.isPending}
                  onClick={() => removeAssignment(a.organizationId)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <FormHint>No assignments yet — unassigned policies apply globally when active.</FormHint>
        )}
      </div>
    </Modal>
  );
}
