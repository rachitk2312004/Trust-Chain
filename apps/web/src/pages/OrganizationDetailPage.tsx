import { Link, useParams } from "react-router-dom";
import { Mail, UserCheck, UserPlus, Users } from "lucide-react";
import { Badge, Card, CardDescription, CardHeader, CardTitle, FormError } from "@trustchain/ui";
import { useOrganizationOverview } from "../features/organizations/hooks";
import { usePermissions } from "../hooks/usePermissions";
import { getOrganizationErrorMessage } from "../lib/orgErrors";

export function OrganizationDetailPage() {
  const { organizationId = "" } = useParams();
  const overview = useOrganizationOverview(organizationId);
  const { can } = usePermissions(organizationId);

  if (overview.isError) {
    return <FormError>{getOrganizationErrorMessage(overview.error)}</FormError>;
  }

  const org = overview.data?.organization;
  const stats = overview.data?.stats;
  const pendingJoins = stats?.pendingJoinCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-500" />
              Members
            </CardTitle>
            <CardDescription className="text-2xl font-bold text-tc-fg">
              {stats?.memberCount ?? "—"}
            </CardDescription>
          </CardHeader>
        </Card>
        {can("org.members.manage") ? (
          <Card className="shadow-soft ring-1 ring-amber-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-amber-500" />
                Join requests
              </CardTitle>
              <CardDescription className="text-2xl font-bold text-tc-fg">
                {stats ? pendingJoins : "—"}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Branches</CardTitle>
            <CardDescription className="text-2xl font-bold text-tc-fg">
              {stats?.branchCount ?? "—"}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Departments</CardTitle>
            <CardDescription className="text-2xl font-bold text-tc-fg">
              {stats?.departmentCount ?? "—"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Admin actions</CardTitle>
            <CardDescription>Common organization management tasks</CardDescription>
            <div className="mt-4 grid gap-2">
              <Link
                to="members"
                className="flex items-center gap-3 rounded-xl border border-tc-border px-4 py-3 text-sm transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
              >
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <span>
                  <span className="block font-medium text-tc-fg">Manage members</span>
                  <span className="text-tc-muted">Roles, suspend, disable, search</span>
                </span>
              </Link>
              {can("org.members.manage") ? (
                <Link
                  to="join-requests"
                  className="flex items-center gap-3 rounded-xl border border-tc-border px-4 py-3 text-sm transition hover:border-amber-500/30 hover:bg-amber-500/5"
                >
                  <UserPlus className="h-4 w-4 text-amber-500" />
                  <span>
                    <span className="block font-medium text-tc-fg">
                      Review join requests
                      {pendingJoins > 0 ? ` (${pendingJoins})` : ""}
                    </span>
                    <span className="text-tc-muted">Approve or reject access applications</span>
                  </span>
                </Link>
              ) : null}
              {can("org.invite") ? (
                <Link
                  to="invitations"
                  className="flex items-center gap-3 rounded-xl border border-tc-border px-4 py-3 text-sm transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
                >
                  <Mail className="h-4 w-4 text-emerald-500" />
                  <span>
                    <span className="block font-medium text-tc-fg">Send invitations</span>
                    <span className="text-tc-muted">Invite by email — auto-enrolls on accept</span>
                  </span>
                </Link>
              ) : null}
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Organization status</CardTitle>
            <CardDescription className="mt-2">
              {org ? (
                <Badge tone={org.status === "active" ? "success" : "warning"}>
                  {org.status}
                </Badge>
              ) : (
                "—"
              )}
            </CardDescription>
            <p className="mt-4 text-sm text-tc-muted">
              Invitations automatically create active membership when the recipient accepts. Join
              requests require your approval in the Join requests tab.
            </p>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
