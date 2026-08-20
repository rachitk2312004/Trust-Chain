import { Badge, Button, FormHint } from "@trustchain/ui";

export type RemediationItem = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  notes: string | null;
  completedAt?: string | null;
  violationTitle?: string;
};

export function RemediationPanel({
  items,
  onComplete,
  pendingId,
}: {
  items: RemediationItem[];
  onComplete?: (id: string) => void;
  pendingId?: string | null;
}) {
  if (items.length === 0) {
    return <FormHint>No open remediations.</FormHint>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded border border-[var(--tc-border)] px-3 py-3 text-sm"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                item.status === "completed"
                  ? "success"
                  : item.status === "in_progress"
                    ? "warning"
                    : "neutral"
              }
            >
              {item.status}
            </Badge>
            {item.dueAt ? (
              <span className="text-xs text-[var(--tc-muted)]">
                Due {new Date(item.dueAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          <div className="font-medium">{item.title}</div>
          {item.notes ? (
            <p className="mt-1 text-xs text-[var(--tc-muted)]">{item.notes}</p>
          ) : null}
          {onComplete && item.status !== "completed" ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                disabled={pendingId === item.id}
                onClick={() => onComplete(item.id)}
              >
                Mark completed
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
