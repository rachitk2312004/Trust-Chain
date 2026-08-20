import { Badge, Button, FormHint } from "@trustchain/ui";
import {
  downloadTextArtifact,
  signatureStatusTone,
} from "../../lib/signatureErrors";
import type { SignatureArtifact, SignatureSummary } from "../../types/api";

function artifactFileName(publicId: string, kind: string, contentType: string): string {
  const ext =
    contentType.includes("json")
      ? "json"
      : contentType.includes("pem") || kind === "public_key"
        ? "pem"
        : "txt";
  return `${publicId}-${kind}.${ext}`;
}

export function SignaturePreview({
  signature,
  artifacts = [],
}: {
  signature: SignatureSummary;
  artifacts?: SignatureArtifact[];
}) {
  const detachedPayload = artifacts.find((a) => a.kind === "detached_payload");
  const canonical = artifacts.find((a) => a.kind === "canonical_payload");
  const publicKey = artifacts.find((a) => a.kind === "public_key");
  const detachedSig = artifacts.find((a) => a.kind === "detached_signature");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={signatureStatusTone(signature.status)}>{signature.status}</Badge>
          <Badge tone="neutral">{signature.algorithm}</Badge>
          <span className="font-mono text-xs text-[var(--tc-muted)]">{signature.publicId}</span>
        </div>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-[var(--tc-muted)]">Signed</dt>
          <dd>{new Date(signature.signedAt).toLocaleString()}</dd>
          <dt className="text-[var(--tc-muted)]">Expires</dt>
          <dd>
            {signature.expiresAt ? new Date(signature.expiresAt).toLocaleString() : "Never"}
          </dd>
          <dt className="text-[var(--tc-muted)]">Payload hash</dt>
          <dd className="break-all font-mono text-xs">{signature.payloadHash}</dd>
          <dt className="text-[var(--tc-muted)]">Integrity</dt>
          <dd className="break-all font-mono text-xs">{signature.integrityHash}</dd>
          <dt className="text-[var(--tc-muted)]">Document</dt>
          <dd className="font-mono text-xs">{signature.documentId ?? "—"}</dd>
          <dt className="text-[var(--tc-muted)]">Certificate</dt>
          <dd className="font-mono text-xs">{signature.certificateId ?? "—"}</dd>
        </dl>
      </div>

      {detachedPayload ? (
        <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold">Detached payload</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                downloadTextArtifact(
                  artifactFileName(signature.publicId, "detached_payload", detachedPayload.contentType),
                  detachedPayload.content,
                  detachedPayload.contentType,
                )
              }
            >
              Download
            </Button>
          </div>
          <pre className="max-h-56 overflow-auto rounded bg-[var(--tc-surface-2)] p-3 text-xs">
            {detachedPayload.content}
          </pre>
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
        <h3 className="mb-3 font-display text-sm font-semibold">Artifacts</h3>
        {artifacts.length === 0 ? (
          <FormHint>No artifacts available.</FormHint>
        ) : (
          <ul className="space-y-2">
            {[canonical, detachedSig, publicKey, ...artifacts.filter(
              (a) =>
                a !== canonical &&
                a !== detachedSig &&
                a !== publicKey &&
                a !== detachedPayload,
            )]
              .filter(Boolean)
              .map((artifact) => (
                <li
                  key={artifact!.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{artifact!.kind}</div>
                    <div className="text-xs text-[var(--tc-muted)]">{artifact!.contentType}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      downloadTextArtifact(
                        artifactFileName(
                          signature.publicId,
                          artifact!.kind,
                          artifact!.contentType,
                        ),
                        artifact!.content,
                        artifact!.contentType,
                      )
                    }
                  >
                    Download
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
