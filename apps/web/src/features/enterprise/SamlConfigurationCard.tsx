import { useState } from "react";
import { Badge, Button, FormHint, Input, Label, Textarea } from "@trustchain/ui";
import type { EnterpriseSaml } from "../../services/enterpriseApi";

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
-----END CERTIFICATE-----`;

export function SamlConfigurationCard({
  saml,
  pending,
  onSave,
}: {
  saml: EnterpriseSaml | null;
  pending?: boolean;
  onSave: (input: {
    entityId: string;
    acsUrl: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificatePem: string;
    status: string;
    startAccessReview: boolean;
  }) => void;
}) {
  const [entityId, setEntityId] = useState(saml?.entityId ?? "https://sp.trustchain.local/saml");
  const [acsUrl, setAcsUrl] = useState(
    saml?.acsUrl ?? "https://api.trustchain.local/api/v1/auth/saml/acs",
  );
  const [idpEntityId, setIdpEntityId] = useState(saml?.idpEntityId ?? "");
  const [idpSsoUrl, setIdpSsoUrl] = useState(saml?.idpSsoUrl ?? "");
  const [cert, setCert] = useState(SAMPLE_PEM);
  const [status, setStatus] = useState(saml?.status ?? "draft");
  const [startReview, setStartReview] = useState(false);

  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">SAML SSO</h2>
        {saml ? <Badge tone={saml.status === "active" ? "success" : "neutral"}>{saml.status}</Badge> : null}
      </div>
      <FormHint>Configure service-provider SAML metadata and IdP federation.</FormHint>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            entityId,
            acsUrl,
            idpEntityId,
            idpSsoUrl,
            idpCertificatePem: cert,
            status,
            startAccessReview: startReview,
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="saml-entity">SP entity ID</Label>
            <Input id="saml-entity" value={entityId} onChange={(e) => setEntityId(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="saml-acs">ACS URL</Label>
            <Input id="saml-acs" value={acsUrl} onChange={(e) => setAcsUrl(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="saml-idp">IdP entity ID</Label>
            <Input
              id="saml-idp"
              value={idpEntityId}
              onChange={(e) => setIdpEntityId(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="saml-sso">IdP SSO URL</Label>
            <Input id="saml-sso" value={idpSsoUrl} onChange={(e) => setIdpSsoUrl(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="saml-cert">IdP certificate (PEM)</Label>
          <Textarea id="saml-cert" value={cert} onChange={(e) => setCert(e.target.value)} rows={4} required />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <Label htmlFor="saml-status">Status</Label>
            <select
              id="saml-status"
              className="mt-1 rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={startReview}
              onChange={(e) => setStartReview(e.target.checked)}
            />
            Start access review
          </label>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save SAML"}
        </Button>
      </form>
    </div>
  );
}
