import { Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";
import type { SignatureAnalyticsSnapshot } from "../../types/api";

export function SignatureVerificationMetrics({
  verification,
  process,
}: {
  verification: SignatureAnalyticsSnapshot["verification"] | undefined;
  process?: SignatureAnalyticsSnapshot["process"];
}) {
  if (!verification) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifications</CardTitle>
        <CardDescription>
          {verification.totalEvents} events · {verification.valid} valid · {verification.invalid}{" "}
          invalid
        </CardDescription>
      </CardHeader>
      <ul className="space-y-1 text-sm text-[var(--tc-muted)]">
        <li>
          Success rate:{" "}
          {verification.successRate != null ? `${verification.successRate}%` : "—"}
        </li>
        <li>
          Avg verification latency:{" "}
          {verification.averageVerificationTimeMs != null
            ? `${verification.averageVerificationTimeMs}ms`
            : "—"}
        </li>
        {process ? (
          <>
            <li>
              Process counters: {process.verifications} verifies · {process.verificationFailures}{" "}
              failures
            </li>
            <li>
              Process avg:{" "}
              {process.averageVerificationTimeMs != null
                ? `${process.averageVerificationTimeMs}ms`
                : "—"}
            </li>
          </>
        ) : null}
      </ul>
    </Card>
  );
}
