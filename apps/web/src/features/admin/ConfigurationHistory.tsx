import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminConfigurationHistoryEntry } from "../../types/api";
import { useRollbackAdminConfiguration } from "./hooks";

export function ConfigurationHistory({
  history,
  emptyMessage = "No configuration history yet. Updates after Step 3 record previous/new values.",
}: {
  history: AdminConfigurationHistoryEntry[];
  emptyMessage?: string;
}) {
  const feedback = useFeedback();
  const rollback = useRollbackAdminConfiguration();

  if (history.length === 0) {
    return <FormHint>{emptyMessage}</FormHint>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration history</CardTitle>
        <CardDescription>Rollback restores the previousValue from an audit entry</CardDescription>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Key</TH>
            <TH>Action</TH>
            <TH>Previous → New</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {history.map((entry) => (
            <TR key={entry.auditId}>
              <TD className="whitespace-nowrap text-xs">
                {new Date(entry.createdAt).toLocaleString()}
              </TD>
              <TD className="font-mono text-xs">{entry.key}</TD>
              <TD className="font-mono text-xs">{entry.action}</TD>
              <TD className="max-w-xs truncate font-mono text-[10px]">
                {JSON.stringify(entry.previousValue)} → {JSON.stringify(entry.newValue)}
              </TD>
              <TD>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={rollback.isPending || entry.previousValue === undefined}
                  onClick={() =>
                    rollback.mutate(
                      { key: entry.key, auditId: entry.auditId },
                      {
                        onSuccess: () => feedback.success(`Rolled back ${entry.key}`),
                        onError: (err) => feedback.error(err, "Rollback failed"),
                      },
                    )
                  }
                >
                  Rollback
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <FormError>{rollback.error ? getApiErrorMessage(rollback.error) : null}</FormError>
    </Card>
  );
}
