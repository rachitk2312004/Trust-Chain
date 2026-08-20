import {
  Badge,
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

export function CertificateTemplateMetrics({
  templates,
  unused,
}: {
  templates: Array<{
    templateId: string | null;
    templateCode: string | null;
    templateName: string | null;
    status: string | null;
    certificateCount: number;
  }>;
  unused?: Array<{ id: string; code: string; name: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Template utilization</CardTitle>
        <CardDescription>Certificates issued per template</CardDescription>
      </CardHeader>
      {templates.length === 0 ? (
        <FormHint>No template usage yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Template</TH>
              <TH>Code</TH>
              <TH>Status</TH>
              <TH>Count</TH>
            </TR>
          </THead>
          <TBody>
            {templates.map((row) => (
              <TR key={row.templateId ?? "none"}>
                <TD>{row.templateName ?? "Default / none"}</TD>
                <TD className="font-mono text-xs">{row.templateCode ?? "—"}</TD>
                <TD>
                  {row.status ? (
                    <Badge tone={row.status === "active" ? "success" : "neutral"}>
                      {row.status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>{row.certificateCount}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {unused && unused.length > 0 ? (
        <FormHint>Unused active templates: {unused.map((t) => t.code).join(", ")}</FormHint>
      ) : null}
    </Card>
  );
}
