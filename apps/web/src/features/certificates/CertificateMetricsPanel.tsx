import { Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";
import type { CertificateAnalyticsSnapshot } from "../../types/api";

export function CertificateMetricsPanel({
  analytics,
}: {
  analytics: CertificateAnalyticsSnapshot | undefined;
}) {
  if (!analytics) return null;
  const { issuance, revocation, verification, expiration } = analytics;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader>
          <CardTitle>Issued</CardTitle>
          <CardDescription>{issuance.issued}</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>{issuance.active}</CardDescription>
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
