import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, FormError, FormHint } from "@trustchain/ui";
import { Can } from "../../components/Can";
import { PlanGate } from "../billing/PlanGate";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useFeedback } from "../../hooks/useFeedback";
import { useCertificateChain, usePublishCertificate } from "./hooks";

export function CertificatePublishPanel({
  organizationId,
  certificateId,
  status,
}: {
  organizationId: string;
  certificateId: string;
  status: string;
}) {
  const feedback = useFeedback();
  const chain = useCertificateChain(organizationId, certificateId);
  const publish = usePublishCertificate(organizationId);
  const data = chain.data;
  const anchored = data?.chain.status === "anchored";
  const canPublish = status === "issued" || status === "draft";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish</CardTitle>
        <CardDescription>
          Store the certificate PDF, register a verification QR, and optionally anchor the hash
          on-chain.
        </CardDescription>
      </CardHeader>
      <dl className="mb-3 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-[var(--tc-muted)]">QR</dt>
        <dd className="font-mono text-xs">{data?.qrPublicCode ?? "—"}</dd>
        <dt className="text-[var(--tc-muted)]">Document</dt>
        <dd className="font-mono text-xs">{data?.documentId ?? "—"}</dd>
        <dt className="text-[var(--tc-muted)]">Chain</dt>
        <dd>
          {chain.isLoading ? (
            "Checking…"
          ) : !data?.chain.enabled ? (
            <Badge>disabled</Badge>
          ) : anchored ? (
            <Badge tone="success">anchored</Badge>
          ) : data?.chain.registered ? (
            <Badge tone="warning">{data.chain.status ?? "not anchored"}</Badge>
          ) : (
            <Badge>org not registered</Badge>
          )}
        </dd>
        {data?.chain.txHash ? (
          <>
            <dt className="text-[var(--tc-muted)]">Tx</dt>
            <dd className="break-all font-mono text-xs">
              {data.chain.explorerUrl ? (
                <a
                  href={data.chain.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--tc-accent)] hover:underline"
                >
                  {data.chain.txHash}
                </a>
              ) : (
                data.chain.txHash
              )}
            </dd>
          </>
        ) : null}
      </dl>
      {data?.chain.reason ? (
        <FormHint>
          {data.chain.skipped ? "Chain publish skipped: " : ""}
          {data.chain.reason}
        </FormHint>
      ) : null}
      <Can capability="certificates.issue" organizationId={organizationId}>
        {canPublish ? (
          <PlanGate feature="chain_publish" organizationId={organizationId}>
          <Button
            size="sm"
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate(
                { certificateId, publishToChain: true },
                {
                  onSuccess: (result) => {
                    if (result.chain.status === "anchored") {
                      feedback.success("Certificate published and anchored");
                    } else if (result.chain.reason) {
                      feedback.warning(
                        "Certificate published",
                        `On-chain step skipped: ${result.chain.reason}`,
                      );
                    } else {
                      feedback.success("Certificate published");
                    }
                  },
                  onError: (err) => feedback.error(err, "Publish failed"),
                },
              )
            }
          >
            {publish.isPending ? "Publishing…" : anchored ? "Re-publish" : "Publish to blockchain"}
          </Button>
          </PlanGate>
        ) : null}
      </Can>
      <FormError>
        {chain.error
          ? getCertificateErrorMessage(chain.error)
          : publish.error
            ? getCertificateErrorMessage(publish.error)
            : null}
      </FormError>
    </Card>
  );
}
