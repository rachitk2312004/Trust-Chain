import { Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";
import type { SignatureAnalyticsSnapshot } from "../../types/api";

export function SignatureMetricsPanel({
  analytics,
}: {
  analytics: SignatureAnalyticsSnapshot | undefined;
}) {
  if (!analytics) return null;
  const { lifecycle, revocation, verification, expiration } = analytics;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader>
          <CardTitle>Created</CardTitle>
          <CardDescription>{lifecycle.created}</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>{lifecycle.active}</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Revoked</CardTitle>
          <CardDescription>
            {revocation.revoked} · {revocation.revokeEvents} events
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Verified</CardTitle>
          <CardDescription>
            {verification.totalEvents}
            {verification.successRate != null ? ` · ${verification.successRate}% ok` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Expired</CardTitle>
          <CardDescription>
            {expiration.expired} · {expiration.expiringWithin30Days} soon
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
