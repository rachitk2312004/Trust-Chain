import { Link } from "react-router-dom";
import { useState } from "react";
import { Button, FormHint, Input, Textarea } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { ScopeEditor } from "../features/developer";

const ENDPOINTS = [
  { method: "GET", path: "/api/public/v1/health", scope: "any" },
  { method: "GET", path: "/api/public/v1/usage", scope: "read|keys" },
  { method: "POST", path: "/api/public/v1/documents", scope: "write" },
  { method: "GET", path: "/api/public/v1/documents/:id", scope: "read" },
  { method: "POST", path: "/api/public/v1/certificates", scope: "write" },
  { method: "GET", path: "/api/public/v1/certificates/:id", scope: "read" },
  { method: "POST", path: "/api/public/v1/signatures", scope: "write" },
  { method: "GET", path: "/api/public/v1/signatures/:id", scope: "read" },
] as const;

export function DeveloperApiExplorerPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const [apiKey, setApiKey] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read", "write"]);
  const [selected, setSelected] = useState<(typeof ENDPOINTS)[number]>(ENDPOINTS[0]);
  const [body, setBody] = useState('{\n  "title": "Sample document"\n}');
  const [idempotencyKey, setIdempotencyKey] = useState(() => String(crypto.randomUUID()));
  const [requestId, setRequestId] = useState(() => String(crypto.randomUUID()));
  const [curl, setCurl] = useState("");

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="API explorer" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="API explorer" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const buildCurl = () => {
    const lines = [
      `curl -X ${selected.method} '${selected.path.replace(":id", "<uuid>")}' \\`,
      `  -H 'Authorization: Bearer ${apiKey || "tc_live_***"}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H 'X-Request-Id: ${requestId}' \\`,
    ];
    if (selected.method !== "GET") {
      lines.push(`  -H 'Idempotency-Key: ${idempotencyKey}' \\`);
      lines.push(`  -d '${body.replace(/\n/g, " ")}'`);
    } else {
      const last = lines[lines.length - 1];
      if (last) lines[lines.length - 1] = last.replace(/ \\$/, "");
    }
    setCurl(lines.join("\n"));
  };

  return (
    <AppShellLayout>
      <PageHeader
        title="API explorer"
        description="Build authenticated public API requests with scopes, idempotency, and request tracing headers."
        actions={
          <Link to="/developer/usage" className="text-sm text-[var(--tc-accent)] hover:underline">
            Usage
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">API key (local only)</label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tc_live_..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Key scopes</label>
            <ScopeEditor scopes={scopes} onChange={setScopes} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Endpoint</label>
            <select
              className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
              value={`${selected.method} ${selected.path}`}
              onChange={(e) => {
                const next = ENDPOINTS.find((ep) => `${ep.method} ${ep.path}` === e.target.value);
                if (next) setSelected(next);
              }}
            >
              {ENDPOINTS.map((ep) => (
                <option key={`${ep.method}:${ep.path}`} value={`${ep.method} ${ep.path}`}>
                  {ep.method} {ep.path} ({ep.scope})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Idempotency-Key</label>
              <Input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">X-Request-Id</label>
              <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} />
            </div>
          </div>
          {selected.method !== "GET" ? (
            <div>
              <label className="mb-1 block text-sm font-medium">JSON body</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
            </div>
          ) : null}
          <Button onClick={buildCurl}>Generate curl</Button>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Request preview
          </h2>
          <FormHint>
            Public base path <span className="font-mono">/api/public/v1</span>. Auth uses{" "}
            <span className="font-mono">Authorization: Bearer tc_***</span>.
          </FormHint>
          <pre className="mt-3 max-h-[480px] overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {curl || "Click Generate curl to preview the request."}
          </pre>
        </section>
      </div>
    </AppShellLayout>
  );
}
