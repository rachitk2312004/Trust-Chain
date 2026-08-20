import { Link } from "react-router-dom";
import { FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { CodeSnippet } from "../features/developer";

export function SdkGuidePage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="SDK guide" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="SDK guide" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="SDK guide"
        description="Install and use the official TrustChain TypeScript, JavaScript, and Python SDKs."
        actions={
          <Link to="/developer/docs" className="text-sm text-[var(--tc-accent)] hover:underline">
            API docs
          </Link>
        }
      />

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Install
          </h2>
          <CodeSnippet
            snippets={{
              typescript: `npm install @trustchain/sdk
# or from monorepo workspace: packages/sdk-typescript`,
              javascript: `npm install @trustchain/sdk`,
              python: `pip install trustchain-sdk
# or: pip install -e packages/sdk-python`,
            }}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Quickstart
          </h2>
          <CodeSnippet
            snippets={{
              typescript: `import { TrustChain } from "@trustchain/sdk";

const sdk = new TrustChain({
  apiKey: process.env.TRUSTCHAIN_API_KEY!,
  baseUrl: "https://api.example.com",
});

const health = await sdk.health();
const { document } = await sdk.documents.create(
  { title: "Contract" },
  { idempotencyKey: crypto.randomUUID() },
);`,
              javascript: `import { TrustChain } from "@trustchain/sdk";

const sdk = new TrustChain({
  apiKey: process.env.TRUSTCHAIN_API_KEY,
  baseUrl: "https://api.example.com",
});

await sdk.health();
await sdk.certificates.create({
  title: "Completion",
  recipientName: "Ada Lovelace",
});`,
              python: `from trustchain import TrustChain

sdk = TrustChain("tc_live_...", base_url="https://api.example.com")
sdk.health()
sdk.signatures.create({"documentId": "..."})`,
            }}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Webhook verification
          </h2>
          <CodeSnippet
            snippets={{
              typescript: `import { verifyWebhook } from "@trustchain/sdk";

const result = verifyWebhook({
  secret: process.env.WEBHOOK_SECRET!,
  body: rawBody,
  signatureHeader: req.headers["x-trustchain-signature"] as string,
});`,
              python: `from trustchain import verify_webhook

result = verify_webhook(
    secret=os.environ["WEBHOOK_SECRET"],
    body=raw_body,
    signature_header=request.headers["X-TrustChain-Signature"],
)`,
            }}
          />
        </section>
      </div>
    </AppShellLayout>
  );
}
