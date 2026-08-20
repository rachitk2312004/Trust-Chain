import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import type { SignatureAnalyticsSnapshot } from "../../types/api";

export function SignatureAlgorithmMetrics({
  algorithms,
}: {
  algorithms: SignatureAnalyticsSnapshot["algorithms"] | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Algorithm distribution</CardTitle>
        <CardDescription>Signatures by signing algorithm</CardDescription>
      </CardHeader>
      {!algorithms || algorithms.length === 0 ? (
        <FormHint>No algorithm data yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Algorithm</TH>
              <TH>Count</TH>
              <TH>Share</TH>
            </TR>
          </THead>
          <TBody>
            {algorithms.map((row) => (
              <TR key={row.algorithm}>
                <TD className="font-mono text-xs">{row.algorithm}</TD>
                <TD>{row.count}</TD>
                <TD>{row.share != null ? `${row.share}%` : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
