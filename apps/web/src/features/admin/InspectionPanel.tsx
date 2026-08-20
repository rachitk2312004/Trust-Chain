import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminInspectionSection } from "../../types/api";

function toneFor(status: string) {
  if (status === "ok") return "success" as const;
  if (status === "warning") return "warning" as const;
  return "neutral" as const;
}

export function InspectionPanel({
  sections,
  generatedAt,
}: {
  sections: AdminInspectionSection[];
  generatedAt?: string;
}) {
  if (sections.length === 0) {
    return <FormHint>No inspection data.</FormHint>;
  }

  return (
    <div className="flex flex-col gap-4">
      {generatedAt ? (
        <p className="text-sm text-[var(--tc-muted)]">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {section.title}
                <Badge tone={toneFor(section.status)}>{section.status}</Badge>
              </CardTitle>
              <CardDescription>{section.summary}</CardDescription>
            </CardHeader>
            <pre className="max-h-48 overflow-auto rounded bg-[var(--tc-surface-2)] p-2 text-[10px]">
              {JSON.stringify(section.data, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
