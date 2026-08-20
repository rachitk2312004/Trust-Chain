import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { CertificateAnalyticsSnapshot } from "../../types/api";

export function CertificateDownloadMetrics({
  downloads,
  rendering,
  process,
}: {
  downloads: CertificateAnalyticsSnapshot["downloads"] | undefined;
  rendering?: CertificateAnalyticsSnapshot["rendering"];
  process?: CertificateAnalyticsSnapshot["process"];
}) {
  if (!downloads) return <FormHint>No download metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloads & rendering</CardTitle>
        <CardDescription>
          {downloads.totalEvents} downloads · avg render{" "}
          {downloads.averageRenderTimeMs != null ? `${downloads.averageRenderTimeMs}ms` : "—"}
        </CardDescription>
      </CardHeader>
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        {Object.entries(downloads.byFormat).map(([format, count]) => (
          <span key={format}>
            {format.toUpperCase()}: <strong>{count}</strong>
          </span>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--tc-muted)]">Render events</dt>
          <dd className="font-medium">{rendering?.renderEvents ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Process avg render</dt>
          <dd className="font-medium">
            {process?.averageRenderTimeMs != null ? `${process.averageRenderTimeMs}ms` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Render failures</dt>
          <dd className="font-medium">{process?.renderFailures ?? rendering?.processRenderFailures ?? 0}</dd>
        </div>
      </dl>
    </Card>
  );
}
