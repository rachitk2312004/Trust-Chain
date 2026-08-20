import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import {
  SUPPORTED_SIGNATURE_ALGORITHMS,
  useDetachedSignature,
} from "../features/signatures";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  signatureVerificationReasonLabel,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { SignatureVerificationResult } from "../types/api";

export function DetachedSignaturePage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const userId = useSessionStore((s) => s.user?.id ?? "");
  const detached = useDetachedSignature(organizationId ?? "");
  const feedback = useFeedback();

  const [payload, setPayload] = useState('{"statement":"Approved"}');
  const [algorithm, setAlgorithm] = useState<string>(SUPPORTED_SIGNATURE_ALGORITHMS[0] ?? "RSA-SHA256");
  const [expiresAt, setExpiresAt] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [signerId, setSignerId] = useState(userId);
  const [publicKeyPem, setPublicKeyPem] = useState("");
  const [signatureValue, setSignatureValue] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [verification, setVerification] = useState<SignatureVerificationResult | null>(null);

  function parsePayload(): string | Record<string, unknown> {
    const trimmed = payload.trim();
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return trimmed;
    }
  }

  function onSign(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    detached.mutate(
      {
        action: "sign",
        payload: parsePayload(),
        algorithm,
        privateKeyPem: privateKeyPem.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      },
      {
        onSuccess: (result) => {
          if (result.kind !== "sign") return;
          if (result.data.generatedPrivateKeyPem) {
            feedback.warning(
              "Detached signature created — save the private key",
              "A one-time private key was generated and is not stored on the server.",
            );
            setPrivateKeyPem(result.data.generatedPrivateKeyPem);
          } else {
            feedback.success("Detached signature created");
          }
          setPublicKeyPem(result.data.signature.publicKeyPem);
          setSignatureValue(result.data.signature.signatureValue);
          setSignedAt(result.data.signature.signedAt.slice(0, 16));
          setSignerId(result.data.signature.signerId);
          navigate(`/signatures/${result.data.signature.id}`);
        },
        onError: (err) => feedback.error(err, "Detached signing failed"),
      },
    );
  }

  function onVerify(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    detached.mutate(
      {
        action: "verify",
        detached: {
          signerId: signerId.trim(),
          algorithm,
          publicKeyPem: publicKeyPem.trim(),
          signatureValue: signatureValue.trim(),
          signedAt: signedAt ? new Date(signedAt).toISOString() : new Date().toISOString(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          metadata: { workflow: "detached" },
          payload: parsePayload(),
        },
      },
      {
        onSuccess: (result) => {
          if (result.kind !== "verify") return;
          setVerification(result.data.verification);
          if (result.data.verification.valid) {
            feedback.success("Detached verification passed");
          } else {
            feedback.error(
              new Error(result.data.verification.reasons.join(", ") || "failed"),
              "Detached verification failed",
            );
          }
        },
        onError: (err) => feedback.error(err, "Detached verification failed"),
      },
    );
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Detached signatures" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Detached signatures"
        description="Sign or verify arbitrary payloads without binding a document or certificate."
        actions={
          <Link to="/signatures" className="text-sm text-[var(--tc-accent)] hover:underline">
            All signatures
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign payload</CardTitle>
            <CardDescription>Creates a stored detached signature and artifacts</CardDescription>
          </CardHeader>
          <form className="flex flex-col gap-3 px-4 pb-4" onSubmit={onSign}>
            <Field>
              <Label htmlFor="studio-payload">Payload</Label>
              <Textarea
                id="studio-payload"
                rows={6}
                required
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="studio-algorithm">Algorithm</Label>
              <Select
                id="studio-algorithm"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
              >
                {SUPPORTED_SIGNATURE_ALGORITHMS.map((alg) => (
                  <option key={alg} value={alg}>
                    {alg}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label htmlFor="studio-expires">Expiration (optional)</Label>
              <Input
                id="studio-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="studio-private-key">Private key PEM (optional)</Label>
              <Textarea
                id="studio-private-key"
                rows={3}
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
              />
            </Field>
            <Can capability="signatures.create" organizationId={organizationId}>
              <Button type="submit" disabled={detached.isPending}>
                {detached.isPending ? "Signing…" : "Sign detached payload"}
              </Button>
            </Can>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verify payload</CardTitle>
            <CardDescription>Stateless detached verification</CardDescription>
          </CardHeader>
          <form className="flex flex-col gap-3 px-4 pb-4" onSubmit={onVerify}>
            <Field>
              <Label htmlFor="studio-signer">Signer ID</Label>
              <Input
                id="studio-signer"
                required
                value={signerId}
                onChange={(e) => setSignerId(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="studio-public-key">Public key PEM</Label>
              <Textarea
                id="studio-public-key"
                rows={3}
                required
                value={publicKeyPem}
                onChange={(e) => setPublicKeyPem(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="studio-signature-value">Signature value</Label>
              <Textarea
                id="studio-signature-value"
                rows={2}
                required
                value={signatureValue}
                onChange={(e) => setSignatureValue(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="studio-signed-at">Signed at</Label>
              <Input
                id="studio-signed-at"
                type="datetime-local"
                required
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </Field>
            <Can capability="signatures.verify" organizationId={organizationId}>
              <Button type="submit" variant="secondary" disabled={detached.isPending}>
                {detached.isPending ? "Verifying…" : "Verify detached payload"}
              </Button>
            </Can>

            {verification ? (
              <div className="rounded border border-[var(--tc-border)] p-3 text-sm">
                <div className="mb-2 flex gap-2">
                  <Badge tone={verification.valid ? "success" : "danger"}>
                    {verification.valid ? "valid" : "invalid"}
                  </Badge>
                </div>
                {verification.reasons.length ? (
                  <ul className="list-disc pl-5">
                    {verification.reasons.map((reason) => (
                      <li key={reason}>{signatureVerificationReasonLabel(reason)}</li>
                    ))}
                  </ul>
                ) : (
                  <FormHint>No failure reasons.</FormHint>
                )}
              </div>
            ) : null}
          </form>
        </Card>
      </div>

      {detached.error ? (
        <div className="mt-4">
          <FormError>{getSignatureErrorMessage(detached.error)}</FormError>
        </div>
      ) : null}
    </AppShellLayout>
  );
}
