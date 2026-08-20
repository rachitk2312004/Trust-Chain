import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  FormError,
  Input,
  Select,
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
  useBranches,
  useDepartments,
  useOrganizationMembers,
  useUpdateMember,
  useUpdateMemberRole,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import { getOrganizationErrorMessage } from "../lib/orgErrors";
import { roleDisplayLabel } from "../lib/roleDisplay";
import type { MemberRoleKey } from "../services/organizationApi";

function memberStatusTone(status: string): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "suspended") return "danger";
  return "warning";
}

function isOrgAdminMember(member: { roleKeys?: string[] }): boolean {
  return (member.roleKeys ?? []).includes("org_admin");
}

export function OrganizationMembersPage() {
  const { organizationId = "" } = useParams();
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<Record<string, MemberRoleKey>>({});
  const members = useOrganizationMembers(organizationId);
  const branches = useBranches(organizationId, inviteOpen);
  const departments = useDepartments(organizationId, inviteOpen);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = members.data ?? [];
    if (!q) return rows;
    return rows.filter((m) => {
      const roles = (m.roleKeys ?? []).join(" ");
      const hay = `${m.email} ${m.firstName ?? ""} ${m.lastName ?? ""} ${m.title ?? ""} ${roles} ${m.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members.data, query]);

  const updateMember = useUpdateMember(organizationId);
  const updateRole = useUpdateMemberRole(organizationId);
  const feedback = useFeedback();
  const { can, isSuperAdmin } = usePermissions(organizationId);
  const canManage = can("org.members.manage");

  function canManageMember(member: (typeof filtered)[number]): boolean {
    if (!canManage) return false;
    if (!isOrgAdminMember(member)) return true;
    return isSuperAdmin;
  }

  function primaryRole(member: (typeof filtered)[number]): MemberRoleKey {
    const keys = member.roleKeys ?? [];
    if (keys.includes("org_admin")) return "org_admin";
    if (keys.includes("employee")) return "employee";
    if (keys.includes("public_user")) return "public_user";
    return "employee";
  }

  if (members.isLoading) {
    return <p className="text-sm text-tc-muted">Loading members…</p>;
  }

  if (members.isError) {
    return <FormError>{getOrganizationErrorMessage(members.error)}</FormError>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-tc-fg">Members</h2>
        <p className="mt-1 text-sm text-tc-muted">
          Search, assign roles, suspend, or disable organization members. Organization admin
          accounts can only be changed by a platform administrator.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search members by name, email, role, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search members"
        />
        <Can capability="org.invite" organizationId={organizationId}>
          <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
        </Can>
      </div>

      {updateMember.isError ? (
        <FormError>{getOrganizationErrorMessage(updateMember.error)}</FormError>
      ) : null}
      {updateRole.isError ? (
        <FormError>{getOrganizationErrorMessage(updateRole.error)}</FormError>
      ) : null}

      <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Title</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {filtered.map((member) => {
              const currentRole = roleDraft[member.id] ?? primaryRole(member);
              const memberManageable = canManageMember(member);
              const orgAdminMember = isOrgAdminMember(member);
              return (
                <TR key={member.id}>
                  <TD>{member.email}</TD>
                  <TD>
                    {[member.firstName, member.lastName].filter(Boolean).join(" ") || "—"}
                  </TD>
                  <TD>{member.title ?? "—"}</TD>
                  <TD>
                    {memberManageable && member.status === "active" ? (
                      <Select
                        className="h-8 min-w-[10rem]"
                        value={currentRole}
                        onChange={(e) =>
                          setRoleDraft((prev) => ({
                            ...prev,
                            [member.id]: e.target.value as MemberRoleKey,
                          }))
                        }
                      >
                        <option value="employee">Employee</option>
                        <option value="public_user">Certificate holder</option>
                        <option value="org_admin">Organization admin</option>
                      </Select>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-sm">{roleDisplayLabel(primaryRole(member))}</span>
                        {member.isFoundingAdmin ? (
                          <Badge tone="info">Parent org admin</Badge>
                        ) : orgAdminMember ? (
                          <span className="text-xs text-tc-muted">Platform admin only</span>
                        ) : null}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={memberStatusTone(member.status)}>{member.status}</Badge>
                  </TD>
                  <TD>
                    {memberManageable ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {member.status === "active" &&
                        currentRole !== primaryRole(member) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updateRole.isPending}
                            onClick={() =>
                              updateRole.mutate(
                                { membershipId: member.id, roleKey: currentRole },
                                {
                                  onSuccess: () =>
                                    feedback.success(`Role updated to ${roleDisplayLabel(currentRole)}`),
                                  onError: (err) => feedback.error(err, "Role update failed"),
                                },
                              )
                            }
                          >
                            Save role
                          </Button>
                        ) : null}
                        {member.status === "active" ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updateMember.isPending}
                              onClick={() =>
                                updateMember.mutate(
                                  { membershipId: member.id, status: "suspended" },
                                  {
                                    onSuccess: () => feedback.success("Member suspended"),
                                    onError: (err) => feedback.error(err, "Suspend failed"),
                                  },
                                )
                              }
                            >
                              Suspend
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updateMember.isPending}
                              onClick={() =>
                                updateMember.mutate(
                                  { membershipId: member.id, status: "disabled" },
                                  {
                                    onSuccess: () => feedback.success("Member disabled"),
                                    onError: (err) => feedback.error(err, "Update failed"),
                                  },
                                )
                              }
                            >
                              Disable
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updateMember.isPending}
                            onClick={() =>
                              updateMember.mutate(
                                { membershipId: member.id, status: "active" },
                                {
                                  onSuccess: () => feedback.success("Member reactivated"),
                                  onError: (err) => feedback.error(err, "Update failed"),
                                },
                              )
                            }
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>

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
