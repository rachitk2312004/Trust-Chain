import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import {
  RevokeSignatureDialog,
  SignaturePreview,
  useSignature,
  useVerifySignature,
} from "../features/signatures";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  signatureStatusTone,
  signatureVerificationReasonLabel,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { SignatureVerificationResult } from "../types/api";

export function SignatureDetailPage() {
  const navigate = useNavigate();
  const { signatureId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const detail = useSignature(organizationId, signatureId);
  const verify = useVerifySignature(organizationId ?? "");
  const feedback = useFeedback();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [verification, setVerification] = useState<SignatureVerificationResult | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (detail.isError) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature" />
        <FormError>{getSignatureErrorMessage(detail.error)}</FormError>
      </AppShellLayout>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature" />
        <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
      </AppShellLayout>
    );
  }

  const { signature, artifacts } = detail.data;
  const canRevoke = signature.status === "active" || signature.status === "pending";

  return (
    <AppShellLayout>
      <PageHeader
        title={signature.publicId}
        description={`${signature.algorithm} · ${
          typeof signature.metadata?.workflow === "string"
            ? signature.metadata.workflow
            : "generic"
        } workflow`}
        actions={
          <Link to="/signatures" className="text-sm text-[var(--tc-accent)] hover:underline">
            All signatures
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={signatureStatusTone(signature.status)}>{signature.status}</Badge>
        <Can capability="signatures.verify" organizationId={organizationId}>
          <Button
            size="sm"
            variant="secondary"
            disabled={verify.isPending}
            onClick={() =>
              verify.mutate(signatureId, {
                onSuccess: (result) => {
                  setVerification(result.verification);
                  if (result.verification.valid) {
                    feedback.success("Signature verified");
                  } else {
                    feedback.error(
                      new Error(result.verification.reasons.join(", ") || "Verification failed"),
                      "Verification failed",
                    );
                  }
                },
                onError: (err) => feedback.error(err, "Verification failed"),
              })
            }
          >
            {verify.isPending ? "Verifying…" : "Verify"}
          </Button>
        </Can>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/signatures/history?signatureId=${signatureId}`)}
        >
          History
        </Button>
        <Can capability="signatures.manage" organizationId={organizationId}>
          {canRevoke ? (
            <Button size="sm" variant="danger" onClick={() => setRevokeOpen(true)}>
              Revoke
            </Button>
          ) : null}
        </Can>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preview & artifacts</CardTitle>
            <CardDescription>Downloadable signature materials</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <SignaturePreview signature={signature} artifacts={artifacts} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification panel</CardTitle>
              <CardDescription>Cryptographic and lifecycle checks</CardDescription>
            </CardHeader>
            <div className="space-y-3 px-4 pb-4 text-sm">
              {verification ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge tone={verification.valid ? "success" : "danger"}>
                      {verification.valid ? "valid" : "invalid"}
                    </Badge>
                    <Badge tone={signatureStatusTone(verification.status)}>
                      {verification.status}
                    </Badge>
                  </div>
                  <ul className="space-y-1">
                    {Object.entries(verification.checks).map(([key, value]) => (
                      <li key={key} className="flex justify-between gap-2">
                        <span className="text-[var(--tc-muted)]">{key}</span>
                        <span>{value === null ? "—" : value ? "pass" : "fail"}</span>
                      </li>
                    ))}
                  </ul>
                  {verification.reasons.length ? (
                    <div>
                      <p className="mb-1 text-[var(--tc-muted)]">Reasons</p>
                      <ul className="list-disc pl-5">
                        {verification.reasons.map((reason) => (
                          <li key={reason}>{signatureVerificationReasonLabel(reason)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <FormHint>No failure reasons.</FormHint>
                  )}
                </>
              ) : (
                <FormHint>Run verify to populate cryptographic and policy checks.</FormHint>
              )}
              {verify.error ? (
                <FormError>{getSignatureErrorMessage(verify.error)}</FormError>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <pre className="mx-4 mb-4 max-h-64 overflow-auto rounded bg-[var(--tc-surface-2)] p-3 text-xs">
              {JSON.stringify(signature.metadata ?? {}, null, 2)}
            </pre>
          </Card>
        </div>
      </div>

      <RevokeSignatureDialog
        organizationId={organizationId}
        signatureId={signatureId}
        publicId={signature.publicId}
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onRevoked={() => {
          feedback.success("Signature revoked");
          void detail.refetch();
        }}
      />
    </AppShellLayout>
  );
}
