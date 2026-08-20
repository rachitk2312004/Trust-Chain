import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@trustchain/ui";
import { getSignatureErrorMessage } from "../../lib/signatureErrors";
import { useSessionStore } from "../../lib/sessionStore";
import { SUPPORTED_SIGNATURE_ALGORITHMS, useDetachedSignature } from "./hooks";

export function DetachedSignatureDialog({
  organizationId,
  open,
  onClose,
  onSigned,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onSigned?: (signatureId: string, generatedPrivateKeyPem?: string | null) => void;
}) {
  const detached = useDetachedSignature(organizationId);
  const userId = useSessionStore((s) => s.user?.id);
  const [tab, setTab] = useState<"sign" | "verify">("sign");
  const [payload, setPayload] = useState('{"statement":"Approved"}');
  const [algorithm, setAlgorithm] = useState<string>(SUPPORTED_SIGNATURE_ALGORITHMS[0] ?? "RSA-SHA256");
  const [expiresAt, setExpiresAt] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [publicKeyPem, setPublicKeyPem] = useState("");
  const [signatureValue, setSignatureValue] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    detached.reset();
    setVerifyResult(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setTab("sign");
    setPayload('{"statement":"Approved"}');
    setAlgorithm(SUPPORTED_SIGNATURE_ALGORITHMS[0] ?? "RSA-SHA256");
    setExpiresAt("");
    setPrivateKeyPem("");
    setPublicKeyPem("");
    setSignatureValue("");
    setSignedAt("");
    setVerifyResult(null);
    detached.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function parsePayload(): string | Record<string, unknown> {
    const trimmed = payload.trim();
    if (!trimmed) return "";
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return trimmed;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (tab === "sign") {
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
            if (result.kind === "sign") {
              handleClose();
              onSigned?.(result.data.signature.id, result.data.generatedPrivateKeyPem);
            }
          },
        },
      );
      return;
    }

    if (!userId) {
      setVerifyResult("Sign in is required to verify with a signer identity.");
      return;
    }
    detached.mutate(
      {
        action: "verify",
        detached: {
          signerId: userId,
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
          if (result.kind === "verify") {
            const valid = result.data.verification.valid;
            setVerifyResult(
              valid
                ? "Detached signature verification passed."
                : `Verification failed: ${(result.data.verification.reasons ?? []).join(", ") || "unknown"}`,
            );
          }
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Detached signature"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="detached-signature-form" disabled={detached.isPending}>
            {detached.isPending
              ? tab === "sign"
                ? "Signing…"
                : "Verifying…"
              : tab === "sign"
                ? "Sign payload"
                : "Verify payload"}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-2">
        <Button
          size="sm"
          variant={tab === "sign" ? "primary" : "ghost"}
          onClick={() => setTab("sign")}
        >
          Sign
        </Button>
        <Button
          size="sm"
          variant={tab === "verify" ? "primary" : "ghost"}
          onClick={() => setTab("verify")}
        >
          Verify
        </Button>
      </div>

      <form id="detached-signature-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="detached-payload">Payload</Label>
          <Textarea
            id="detached-payload"
            rows={5}
            required
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"statement":"Approved"} or plain text'
          />
          <FormHint>JSON objects are hashed as canonical JSON; otherwise treated as text.</FormHint>
        </Field>

        <Field>
          <Label htmlFor="detached-algorithm">Algorithm</Label>
          <Select
            id="detached-algorithm"
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

        {tab === "sign" ? (
          <>
            <Field>
              <Label htmlFor="detached-expires">Expiration (optional)</Label>
              <Input
                id="detached-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="detached-private-key">Private key PEM (optional)</Label>
              <Textarea
                id="detached-private-key"
                rows={3}
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field>
              <Label htmlFor="detached-public-key">Public key PEM</Label>
              <Textarea
                id="detached-public-key"
                rows={3}
                required
                value={publicKeyPem}
                onChange={(e) => setPublicKeyPem(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="detached-signature-value">Signature value (base64)</Label>
              <Textarea
                id="detached-signature-value"
                rows={2}
                required
                value={signatureValue}
                onChange={(e) => setSignatureValue(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="detached-signed-at">Signed at</Label>
              <Input
                id="detached-signed-at"
                type="datetime-local"
                required
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="detached-verify-expires">Expires at (optional)</Label>
              <Input
                id="detached-verify-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
          </>
        )}

        {verifyResult ? <FormHint>{verifyResult}</FormHint> : null}
        <FormError>{detached.error ? getSignatureErrorMessage(detached.error) : null}</FormError>
      </form>
    </Modal>
  );
}
