import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { InviteMemberDialog } from "../features/organizations/InviteMemberDialog";
import {
  useAcceptInvitation,
  useBranches,
  useDepartments,
  useOrganizationInvitations,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getOrganizationErrorMessage, invitationStatus } from "../lib/orgErrors";

const statusTone = {
  pending: "info",
  accepted: "success",
  expired: "warning",
  revoked: "danger",
} as const;

export function OrganizationInvitationsPage() {
  const { organizationId = "" } = useParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [token, setToken] = useState("");
  const invitations = useOrganizationInvitations(organizationId);
  const branches = useBranches(organizationId, inviteOpen);
  const departments = useDepartments(organizationId, inviteOpen);
  const accept = useAcceptInvitation();
  const feedback = useFeedback();

  function onAccept(event: FormEvent) {
    event.preventDefault();
    accept.mutate(token.trim(), {
      onSuccess: () => {
        setToken("");
        feedback.success("Invitation accepted");
      },
      onError: (err) => feedback.error(err, "Could not accept invitation"),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Can capability="org.invite" organizationId={organizationId}>
          <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
        </Can>
      </div>

      {invitations.isError ? (
        <FormError>{getOrganizationErrorMessage(invitations.error)}</FormError>
      ) : null}

      {invitations.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading invitations…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Expires</TH>
            </TR>
          </THead>
          <TBody>
            {(invitations.data ?? []).map((invite) => {
              const status = invitationStatus(invite);
              return (
                <TR key={invite.id}>
                  <TD>{invite.email}</TD>
                  <TD>{invite.roleKey}</TD>
                  <TD>
                    <Badge tone={statusTone[status]}>{status}</Badge>
                  </TD>
                  <TD>{new Date(invite.expiresAt).toLocaleString()}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <form className="flex max-w-lg flex-col gap-3" onSubmit={onAccept}>
        <Field>
          <Label htmlFor="accept-token">Accept invitation token</Label>
          <Input
            id="accept-token"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste invitation token"
          />
          <FormHint>
            Pending invitation revoke is not exposed by the API. Accepted members can be disabled
            from the Members page.
          </FormHint>
        </Field>
        <FormError>{accept.error ? getOrganizationErrorMessage(accept.error) : null}</FormError>
        {accept.isSuccess ? <FormHint>Invitation accepted.</FormHint> : null}
        <Button type="submit" disabled={accept.isPending} className="self-start">
          {accept.isPending ? "Accepting…" : "Accept invitation"}
        </Button>
      </form>

      <InviteMemberDialog
        organizationId={organizationId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => feedback.success("Invitation sent")}
        branches={branches.data ?? []}
        departments={departments.data ?? []}
      />
    </div>
  );
}
