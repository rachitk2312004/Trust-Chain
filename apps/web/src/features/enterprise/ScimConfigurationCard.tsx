import { useState } from "react";
import { Badge, Button, FormHint, Input, Label } from "@trustchain/ui";
import type { EnterpriseScim } from "../../services/enterpriseApi";

export function ScimConfigurationCard({
  scim,
  pending,
  lastToken,
  onSave,
}: {
  scim: EnterpriseScim | null;
  pending?: boolean;
  lastToken?: string | null;
  onSave: (input: {
    baseUrl: string;
    status: string;
    rotateToken: boolean;
    provisionEmail?: string;
  }) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(
    scim?.baseUrl ?? "https://api.trustchain.local/api/v1/scim/v2",
  );
  const [status, setStatus] = useState(scim?.status ?? "draft");
  const [rotateToken, setRotateToken] = useState(true);
  const [provisionEmail, setProvisionEmail] = useState("");

  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">SCIM provisioning</h2>
        {scim ? (
          <Badge tone={scim.status === "active" ? "success" : "neutral"}>
            {scim.status} · …{scim.tokenHint}
          </Badge>
        ) : null}
      </div>
      <FormHint>Issue a SCIM bearer token and optionally evaluate a user provision payload.</FormHint>
      {lastToken ? (
        <p className="mt-2 break-all rounded bg-[var(--tc-surface-muted,transparent)] p-2 font-mono text-xs">
          New token (copy now): {lastToken}
        </p>
      ) : null}
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            baseUrl,
            status,
            rotateToken,
            provisionEmail: provisionEmail || undefined,
          });
        }}
      >
        <div>
          <Label htmlFor="scim-base">Base URL</Label>
          <Input id="scim-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="scim-status">Status</Label>
            <select
              id="scim-status"
              className="mt-1 rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rotateToken}
              onChange={(e) => setRotateToken(e.target.checked)}
            />
            Rotate token
          </label>
        </div>
        <div>
          <Label htmlFor="scim-user">Provision test user (email)</Label>
          <Input
            id="scim-user"
            value={provisionEmail}
            onChange={(e) => setProvisionEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save SCIM"}
        </Button>
      </form>
    </div>
  );
}
