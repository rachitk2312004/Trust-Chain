import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Input,
} from "@trustchain/ui";
import { useState } from "react";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { TenantQuotaView } from "../../types/api";
import { usePatchAdminTenant } from "./hooks";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function TenantQuotaPanel({
  tenantId,
  quotas,
}: {
  tenantId: string;
  quotas: TenantQuotaView | undefined;
}) {
  const feedback = useFeedback();
  const patch = usePatchAdminTenant(tenantId);
  const [users, setUsers] = useState(String(quotas?.limits.users ?? 50));
  const [organizations, setOrganizations] = useState(String(quotas?.limits.organizations ?? 10));
  const [documents, setDocuments] = useState(String(quotas?.limits.documents ?? 1000));
  const [certificates, setCertificates] = useState(String(quotas?.limits.certificates ?? 500));
  const [signatures, setSignatures] = useState(String(quotas?.limits.signatures ?? 500));
  const [storageBytes, setStorageBytes] = useState(String(quotas?.limits.storageBytes ?? 0));

  if (!quotas) {
    return <FormHint>No quota data.</FormHint>;
  }

  const rows = quotas.utilization ?? [
    { resource: "users", used: quotas.usage.users, limit: quotas.limits.users, percent: null },
    {
      resource: "organizations",
      used: quotas.usage.organizations,
      limit: quotas.limits.organizations,
      percent: null,
    },
    {
      resource: "documents",
      used: quotas.usage.documents,
      limit: quotas.limits.documents,
      percent: null,
    },
    {
      resource: "certificates",
      used: quotas.usage.certificates,
      limit: quotas.limits.certificates,
      percent: null,
    },
    {
      resource: "signatures",
      used: quotas.usage.signatures,
      limit: quotas.limits.signatures,
      percent: null,
    },
    {
      resource: "storageBytes",
      used: quotas.usage.storageBytes,
      limit: quotas.limits.storageBytes,
      percent: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotas</CardTitle>
        <CardDescription>Usage vs limits (0 = unlimited)</CardDescription>
      </CardHeader>

      <ul className="mb-4 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.resource} className="flex justify-between gap-3">
            <span className="font-mono text-xs">{row.resource}</span>
            <span>
              {row.resource === "storageBytes" ? formatBytes(row.used) : row.used}
              {" / "}
              {row.limit === 0
                ? "∞"
                : row.resource === "storageBytes"
                  ? formatBytes(row.limit)
                  : row.limit}
              {row.percent != null ? ` (${row.percent}%)` : ""}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["users", users, setUsers],
            ["organizations", organizations, setOrganizations],
            ["documents", documents, setDocuments],
            ["certificates", certificates, setCertificates],
            ["signatures", signatures, setSignatures],
            ["storageBytes", storageBytes, setStorageBytes],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label}>
            <label className="mb-1 block text-xs font-medium">{label}</label>
            <Input type="number" min={0} value={value} onChange={(e) => setter(e.target.value)} />
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Button
          size="sm"
          disabled={patch.isPending}
          onClick={() =>
            patch.mutate(
              {
                quotas: {
                  users: Number.parseInt(users, 10) || 0,
                  organizations: Number.parseInt(organizations, 10) || 0,
                  documents: Number.parseInt(documents, 10) || 0,
                  certificates: Number.parseInt(certificates, 10) || 0,
                  signatures: Number.parseInt(signatures, 10) || 0,
                  storageBytes: Number.parseInt(storageBytes, 10) || 0,
                },
              },
              {
                onSuccess: () => feedback.success("Quotas updated"),
                onError: (err) => feedback.error(err, "Quota update failed"),
              },
            )
          }
        >
          {patch.isPending ? "Saving…" : "Save quotas"}
        </Button>
      </div>
      <FormError>{patch.error ? getApiErrorMessage(patch.error) : null}</FormError>
    </Card>
  );
}
