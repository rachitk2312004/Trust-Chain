import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AccessReview } from "../../services/enterpriseApi";

export function AccessReviewTable({ reviews }: { reviews: AccessReview[] }) {
  if (reviews.length === 0) {
    return <FormHint>No access reviews yet. Enable SAML with “Start access review” to create one.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Title</TH>
          <TH>Status</TH>
          <TH>Progress</TH>
          <TH>Due</TH>
          <TH>Created</TH>
        </TR>
      </THead>
      <TBody>
        {reviews.map((r) => (
          <TR key={r.id}>
            <TD>
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-[var(--tc-muted)]">{r.items.length} items</div>
            </TD>
            <TD>
              <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge>
            </TD>
            <TD className="text-xs">
              {r.summary.approved} approved · {r.summary.revoked} revoked · {r.summary.pending}{" "}
              pending
            </TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {r.dueAt ? new Date(r.dueAt).toLocaleDateString() : "—"}
            </TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(r.createdAt).toLocaleString()}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
