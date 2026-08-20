import type { ReactNode } from "react";
import { PageHeader as UiPageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <UiPageHeader title={title} description={description} actions={actions} />;
}

/** Empty connected-state panel — no fabricated lists. */
export function RouteReadyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold tracking-tight text-tc-fg">{title}</h3>
      <p className="mt-2 text-sm text-tc-muted">{description}</p>
    </Card>
  );
}
