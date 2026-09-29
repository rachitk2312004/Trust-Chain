import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, FormError, FormHint } from "@trustchain/ui";
import { Can } from "../../components/Can";
import { PlanLockedHint, hasBillingFeature } from "../billing/PlanGate";
import { useBillingEntitlements } from "../billing/hooks";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import {
  useAnchorDocument,
  useDocumentChainStatus,
  useOrganizationChainStatus,
  useRegisterOrganizationOnChain,
  useRevokeDocumentOnChain,
  useUpdateDocument,
} from "./hooks";

export function DocumentChainPanel({
  organizationId,
  documentId,
  documentStatus,
  hasVersion,
}: {
  organizationId: string;
  documentId: string;
  documentStatus: string;
  hasVersion: boolean;
}) {
  const feedback = useFeedback();
  const billing = useBillingEntitlements(organizationId);
  const orgChain = useOrganizationChainStatus(organizationId);
  const docChain = useDocumentChainStatus(organizationId, documentId);
  const register = useRegisterOrganizationOnChain(organizationId);
  const publish = useUpdateDocument(organizationId, documentId);
  const anchor = useAnchorDocument(organizationId, documentId);
  const revoke = useRevokeDocumentOnChain(organizationId, documentId);

  const latest = docChain.data?.anchors[0];
  const registered = orgChain.data?.registration?.status === "registered";
  const anchored = latest?.status === "anchored";
  const planIncludesChain = hasBillingFeature(billing.data?.organization, "chain_publish");
  const canPublish = documentStatus !== "active" && hasVersion;
  const canAnchor =
    planIncludesChain && documentStatus === "active" && hasVersion && registered && !anchored;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Publish</CardTitle>
        <CardDescription>
          Activate the document for verification, then anchor its content hash on-chain.
        </CardDescription>
      </CardHeader>
      <dl className="mb-4 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-[var(--tc-muted)]">Document</dt>
        <dd>
          <Badge tone={documentStatus === "active" ? "success" : "info"}>{documentStatus}</Badge>
        </dd>
        <dt className="text-[var(--tc-muted)]">Organization</dt>
        <dd>
          {orgChain.isLoading ? (
            "Checking chain…"
          ) : registered ? (
            <Badge tone="success">registered</Badge>
          ) : (
            <Badge>not registered</Badge>
          )}
        </dd>
        <dt className="text-[var(--tc-muted)]">Anchor</dt>
        <dd>
          {latest ? (
            <span className="break-all">
              <Badge tone={anchored ? "success" : latest.status === "revoked" ? "danger" : "warning"}>
                {latest.status}
              </Badge>
              <span className="ml-2 font-mono text-xs text-[var(--tc-muted)]">{latest.contentHash}</span>
            </span>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      {!hasVersion ? (
        <FormHint>Upload a file before publishing or anchoring.</FormHint>
      ) : null}
      {!billing.isLoading && !planIncludesChain ? (
        <div className="mb-3">
          <PlanLockedHint feature="chain_publish" />
        </div>
      ) : null}
      <Can capability="documents.upload" organizationId={organizationId}>
        <div className="flex flex-wrap gap-2">
          {canPublish ? (
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate(
                  { status: "active" },
                  {
                    onSuccess: () => feedback.success("Document published"),
                    onError: (err) => feedback.error(err, "Publish failed"),
                  },
                )
              }
            >
              {publish.isPending ? "Publishing…" : "Publish document"}
            </Button>
          ) : null}
          {planIncludesChain ? (
            <>
              <Can capability="org.update" organizationId={organizationId}>
                {!registered ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={register.isPending}
                    onClick={() =>
                      register.mutate(undefined, {
                        onSuccess: () => feedback.success("Organization registered on-chain"),
                        onError: (err) => feedback.error(err, "Chain registration failed"),
                      })
                    }
                  >
                    {register.isPending ? "Registering…" : "Register org on-chain"}
                  </Button>
                ) : null}
              </Can>
              {canAnchor ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={anchor.isPending}
                  onClick={() =>
                    anchor.mutate(undefined, {
                      onSuccess: (data) =>
                        feedback.success(
                          data.transaction.txHash
                            ? `Anchored ${data.transaction.txHash.slice(0, 12)}…`
                            : "Document anchored",
                        ),
                      onError: (err) => feedback.error(err, "Anchor failed"),
                    })
                  }
                >
                  {anchor.isPending ? "Anchoring…" : "Anchor on blockchain"}
                </Button>
              ) : null}
              {anchored ? (
                <Can capability="documents.manage" organizationId={organizationId}>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate(undefined, {
                        onSuccess: () => feedback.success("On-chain revocation submitted"),
                        onError: (err) => feedback.error(err, "On-chain revoke failed"),
                      })
                    }
                  >
                    {revoke.isPending ? "Revoking…" : "Revoke on-chain"}
                  </Button>
                </Can>
              ) : null}
            </>
          ) : null}
        </div>
      </Can>
      <FormError>
        {orgChain.error
          ? getApiErrorMessage(orgChain.error)
          : docChain.error
            ? getApiErrorMessage(docChain.error)
            : publish.error
              ? getApiErrorMessage(publish.error)
              : null}
      </FormError>
    </Card>
  );
}
