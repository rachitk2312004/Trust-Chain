import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { SignatureAnalyticsSnapshot } from "../../types/api";

export function SignatureDetachedMetrics({
  detached,
  downloads,
}: {
  detached: SignatureAnalyticsSnapshot["detached"] | undefined;
  downloads?: SignatureAnalyticsSnapshot["downloads"];
}) {
  if (!detached) return null;

  const kindEntries = Object.entries(downloads?.byKind ?? {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detached signatures</CardTitle>
        <CardDescription>
          {detached.total} total · {detached.active} active · {detached.revoked} revoked ·{" "}
          {detached.expired} expired
        </CardDescription>
      </CardHeader>
      <p className="mb-2 text-sm text-[var(--tc-muted)]">
        Detached payload artifacts: {detached.artifactCount}
        {downloads ? ` · all artifacts: ${downloads.artifactCount}` : ""}
        {downloads ? ` · process downloads: ${downloads.processDownloads}` : ""}
      </p>
      {kindEntries.length === 0 ? (
        <FormHint>No artifact kind breakdown yet.</FormHint>
      ) : (
        <ul className="space-y-1 text-sm">
          {kindEntries.map(([kind, count]) => (
            <li key={kind} className="flex justify-between gap-2">
              <span className="font-mono text-xs">{kind}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
