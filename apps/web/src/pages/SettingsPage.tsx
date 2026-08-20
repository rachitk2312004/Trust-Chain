import { Link } from "react-router-dom";
import { Badge, Card, CardDescription, CardHeader, CardTitle, FormError } from "@trustchain/ui";
import { useCurrentUser } from "../features/auth/hooks";
import { PageHeader } from "../components/PageHeader";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

export function SettingsPage() {
  const me = useCurrentUser();
  const { displayRoles, showHolderFeatures } = usePermissions();
  const user = me.data?.user;

  return (
    <>
      <PageHeader title="Settings" description="Account profile and security." />
      {me.isError ? (
        <FormError>{getApiErrorMessage(me.error)}</FormError>
      ) : null}

      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>From GET /api/v1/me</CardDescription>
          </CardHeader>
          {user ? (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-[var(--tc-muted)]">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-[var(--tc-muted)]">Name</dt>
              <dd>
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
              </dd>
              <dt className="text-[var(--tc-muted)]">Status</dt>
              <dd>
                <Badge tone={user.status === "active" ? "success" : "warning"}>{user.status}</Badge>
              </dd>
              <dt className="text-[var(--tc-muted)]">Email verified</dt>
              <dd>{user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : "No"}</dd>
              <dt className="text-[var(--tc-muted)]">Member since</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </dl>
          ) : (
            <p className="text-sm text-[var(--tc-muted)]">Loading profile…</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Organization role bindings for this account</CardDescription>
          </CardHeader>
          <ul className="space-y-2 text-sm">
            {displayRoles.map((role, index) => (
              <li
                key={`${role.roleKey}-${role.organizationId ?? "global"}-${index}`}
                className="flex flex-wrap items-center gap-2"
              >
                <Badge>{role.roleKey}</Badge>
                <span className="text-[var(--tc-muted)]">
                  {role.organizationId ? `org ${role.organizationId.slice(0, 8)}…` : "global"}
                </span>
              </li>
            ))}
            {displayRoles.length === 0 && !me.isLoading ? (
              <li className="text-[var(--tc-muted)]">No role bindings returned.</li>
            ) : null}
          </ul>
        </Card>

        {showHolderFeatures ? (
          <Card>
            <CardHeader>
              <CardTitle>My certificates</CardTitle>
              <CardDescription>Credentials issued to you by organizations</CardDescription>
            </CardHeader>
            <Link to="/my-certificates" className="text-sm text-[var(--tc-accent)] hover:underline">
              Open my certificates
            </Link>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage signed-in devices and sessions</CardDescription>
          </CardHeader>
          <Link to="/sessions" className="text-sm text-[var(--tc-accent)] hover:underline">
            View active sessions
          </Link>
        </Card>
      </div>
    </>
  );
}
