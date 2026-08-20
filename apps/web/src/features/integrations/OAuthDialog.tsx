import { useEffect, useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";
import type { EcosystemIntegration } from "../../services/integrationApi";

export function OAuthDialog({
  open,
  onClose,
  integration,
  pending,
  authorizeUrl,
  initialState,
  onStart,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  integration: EcosystemIntegration | null;
  pending?: boolean;
  authorizeUrl?: string | null;
  initialState?: string | null;
  onStart: (input: { clientId: string; redirectUri: string }) => void;
  onComplete: (input: { state: string; code: string }) => void;
}) {
  const [clientId, setClientId] = useState("trustchain-client");
  const [redirectUri, setRedirectUri] = useState(
    "https://app.trustchain.local/integrations/oauth/callback",
  );
  const [state, setState] = useState("");
  const [code, setCode] = useState("demo-auth-code");

  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);

  return (
    <Modal open={open} title="OAuth connect" onClose={onClose}>
      {!integration ? (
        <FormHint>Select an integration first.</FormHint>
      ) : (
        <div className="space-y-4">
          <FormHint>
            Foundation OAuth: start issues a authorize URL + state; complete exchanges a code for a
            mock token (no live IdP call).
          </FormHint>
          <p className="text-sm">
            <span className="font-medium">{integration.name}</span> · {integration.connectorName}
          </p>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onStart({ clientId, redirectUri });
            }}
          >
            <div>
              <Label htmlFor="oa-client">Client ID</Label>
              <Input
                id="oa-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="oa-redirect">Redirect URI</Label>
              <Input
                id="oa-redirect"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Starting…" : "Start OAuth"}
            </Button>
          </form>

          {authorizeUrl ? (
            <div className="space-y-2">
              <Label>Authorize URL</Label>
              <pre className="max-h-24 overflow-auto rounded border border-[var(--tc-border)] p-2 text-xs break-all whitespace-pre-wrap">
                {authorizeUrl}
              </pre>
            </div>
          ) : null}

          <form
            className="space-y-3 border-t border-[var(--tc-border)] pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              onComplete({ state, code });
            }}
          >
            <div>
              <Label htmlFor="oa-state">State</Label>
              <Input
                id="oa-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="oa-code">Authorization code</Label>
              <Input id="oa-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Completing…" : "Complete OAuth"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
