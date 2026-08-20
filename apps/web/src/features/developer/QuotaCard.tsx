import { Badge } from "@trustchain/ui";

export type QuotaView = {
  id: string;
  limits: {
    requestsPerDay: number;
    requestsPerMonth: number;
    maxApiKeys: number;
    maxWebhooks: number;
    maxServiceAccounts: number;
  };
  usage: {
    requestsToday: number;
    requestsMonth: number;
    apiKeys: number;
    webhooks: number;
    serviceAccounts: number;
  };
  utilization: Array<{
    key: string;
    limit: number;
    used: number;
    ratio: number;
    exhausted: boolean;
  }>;
  exhausted: boolean;
  exhaustedAt: string | null;
};

const LABELS: Record<string, string> = {
  requestsPerDay: "Requests / day",
  requestsPerMonth: "Requests / month",
  maxApiKeys: "API keys",
  maxWebhooks: "Webhooks",
  maxServiceAccounts: "Service accounts",
};

export function QuotaCard({ quota }: { quota: QuotaView }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Organization quotas</h3>
        <Badge tone={quota.exhausted ? "danger" : "success"}>
          {quota.exhausted ? "Exhausted" : "OK"}
        </Badge>
      </div>
      <ul className="space-y-3">
        {quota.utilization.map((row) => (
          <li key={row.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{LABELS[row.key] ?? row.key}</span>
              <span className="text-[var(--tc-muted)]">
                {row.used} / {row.limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[var(--tc-border)]">
              <div
                className={row.exhausted ? "h-full bg-red-600" : "h-full bg-[var(--tc-accent)]"}
                style={{ width: `${Math.min(100, Math.round(row.ratio * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {quota.exhaustedAt ? (
        <p className="mt-3 text-xs text-[var(--tc-muted)]">
          Exhausted since {new Date(quota.exhaustedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
