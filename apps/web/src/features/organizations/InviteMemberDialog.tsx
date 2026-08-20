import { useState, type FormEvent } from "react";
import { Button, Field, FormError, FormHint, Input, Label, Modal, Select } from "@trustchain/ui";
import { useInviteMember } from "./hooks";
import { getOrganizationErrorMessage } from "../../lib/orgErrors";
import type { InviteRoleKey } from "../../types/api";

export function InviteMemberDialog({
  organizationId,
  open,
  onClose,
  onInvited,
  branches,
  departments,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}) {
  const invite = useInviteMember(organizationId);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<InviteRoleKey>("employee");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  function reset() {
    setEmail("");
    setRoleKey("employee");
    setBranchId("");
    setDepartmentId("");
    invite.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    invite.mutate(
      {
        email: email.trim(),
        roleKey,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
      },
      {
        onSuccess: () => {
          handleClose();
          onInvited?.();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Invite member"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-member-form" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </>
      }
    >
      <form id="invite-member-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value as InviteRoleKey)}
          >
            <option value="employee">Employee (issue & verify)</option>
            <option value="public_user">Certificate holder</option>
            <option value="org_admin">Organization admin</option>
          </Select>
          <FormHint>
            Employees operate trust workflows. Holders receive and share their own certificates.
          </FormHint>
        </Field>
        <Field>
          <Label htmlFor="invite-branch">Branch (optional)</Label>
          <Select id="invite-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">None</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="invite-department">Department (optional)</Label>
          <Select
            id="invite-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <FormError>
          {invite.error ? getOrganizationErrorMessage(invite.error) : null}
        </FormError>
      </form>
    </Modal>
  );
}
