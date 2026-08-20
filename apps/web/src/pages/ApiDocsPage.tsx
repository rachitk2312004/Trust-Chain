import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { CodeSnippet, useDeveloperOpenApi, useDeveloperSdk } from "../features/developer";

export function ApiDocsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const openapi = useDeveloperOpenApi(organizationId, canManage);
  const sdk = useDeveloperSdk(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="API docs" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="API docs" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const doc = openapi.data;
  const paths = doc?.paths ? Object.keys(doc.paths) : [];

  return (
    <AppShellLayout>
      <PageHeader
        title="API docs"
        description="OpenAPI reference for the TrustChain public developer API."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/developer/sdk" className="text-[var(--tc-accent)] hover:underline">
              SDK guide
            </Link>
            <Link to="/developer/explorer" className="text-[var(--tc-accent)] hover:underline">
              Explorer
            </Link>
          </div>
        }
      />

      {openapi.isError ? <FormError>{getApiErrorMessage(openapi.error)}</FormError> : null}
      {sdk.data?.sdk ? (
        <FormHint>
                      SDKs: {sdk.data.sdk.packages.typescript} · {sdk.data.sdk.packages.python} ·
                      base <span className="font-mono">/api/public/v1</span>
        </FormHint>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="rounded border border-[var(--tc-border)] p-3 text-left text-sm hover:border-[var(--tc-accent)]"
          disabled={!doc}
          onClick={() => {
            if (!doc) return;
            const blob = new Blob([JSON.stringify(doc, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "openapi.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download openapi.json
        </button>
        <FormHint>
          YAML is available from <span className="font-mono">GET /api/v1/developer/openapi.yaml</span>
        </FormHint>
      </div>

      <section className="mb-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Endpoints
        </h2>
        {openapi.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading OpenAPI…</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {paths.map((path) => {
              const item = doc?.paths?.[path] as Record<string, { summary?: string }> | undefined;
              const methods = item
                ? Object.keys(item).filter((m) =>
                    ["get", "post", "put", "patch", "delete"].includes(m),
                  )
                : [];
              return (
                <li key={path} className="rounded border border-[var(--tc-border)] p-3">
                  <div className="font-mono text-xs">{path}</div>
                  <div className="mt-1 text-[var(--tc-muted)]">
                    {methods
                      .map((m) => `${m.toUpperCase()} — ${item?.[m]?.summary ?? ""}`)
                      .join(" · ")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CodeSnippet
        title="Auth header"
        snippets={{
          curl: `curl -H 'Authorization: Bearer tc_live_***' \\
  https://api.example.com/api/public/v1/health`,
          typescript: `import { TrustChain } from "@trustchain/sdk";

const sdk = new TrustChain({ apiKey: "tc_live_***", baseUrl: "https://api.example.com" });
await sdk.health();`,
          python: `from trustchain import TrustChain

sdk = TrustChain("tc_live_***", base_url="https://api.example.com")
print(sdk.health())`,
        }}
      />
    </AppShellLayout>
  );
}
