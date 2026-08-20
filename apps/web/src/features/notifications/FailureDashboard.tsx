import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { NotificationAnalytics, DeadLetterList } from "../../services/notificationOpsTypes";

export function FailureDashboard({
  failures,
  deadLetters,
  onRetryAll,
  onRetryOne,
  onInspect,
  retrying,
}: {
  failures?: NotificationAnalytics["failures"];
  deadLetters?: DeadLetterList;
  onRetryAll: () => void;
  onRetryOne: (id: string) => void;
  onInspect: (id: string) => void;
  retrying?: boolean;
}) {
  if (!failures || !deadLetters) {
    return <FormHint>Loading failure dashboard…</FormHint>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Failure analysis</CardTitle>
          <CardDescription>
            {failures.totalFailed} failed samples · {failures.deadLetters} dead letters ·{" "}
            {failures.permanentHintCount} permanent hints
          </CardDescription>
        </CardHeader>
        <ul className="space-y-2 px-6 pb-6">
          {failures.topErrors.length === 0 ? (
            <FormHint>No recent failures.</FormHint>
          ) : (
            failures.topErrors.map((row) => (
              <li
                key={row.error}
                className="flex items-center justify-between gap-3 border-b border-[var(--tc-border)] py-2 text-sm"
              >
                <span className="truncate text-[var(--tc-fg)]">{row.error}</span>
                <Badge tone="danger">{row.count}</Badge>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Dead letters</CardTitle>
              <CardDescription>{deadLetters.total} in queue</CardDescription>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={retrying || deadLetters.total === 0}
              onClick={onRetryAll}
            >
              Retry batch
            </Button>
          </div>
        </CardHeader>
        <ul className="divide-y divide-[var(--tc-border)] px-2 pb-4">
          {deadLetters.items.length === 0 ? (
            <li className="px-4 py-3">
              <FormHint>No dead-letter entries.</FormHint>
            </li>
          ) : (
            deadLetters.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--tc-fg)]">{item.eventType}</p>
                  <p className="truncate text-xs text-[var(--tc-muted)]">{item.lastError ?? "—"}</p>
                  <p className="mt-1 text-xs text-[var(--tc-muted)]">
                    attempts {item.attempts} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onInspect(item.id)}>
                    Inspect
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={retrying}
                    onClick={() => onRetryOne(item.id)}
                  >
                    Retry
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
