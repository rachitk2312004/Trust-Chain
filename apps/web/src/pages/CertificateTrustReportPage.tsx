import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Award, MessageSquare, QrCode, ShieldCheck } from "lucide-react";
import { Badge, Button, FormError, FormHint, TD, TH } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { Card, EmptyState, MetricCard, StatCard } from "../components/ui";
import { useCertificateTrustReport } from "../features/certificates";
import { useConversations, useCreateConversation, useMessageDirectory } from "../features/messages/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getCertificateErrorMessage } from "../lib/certificateErrors";
import { isPlanLockedError } from "../lib/billingErrors";
import { PlanGate, UpgradeCard } from "../features/billing/PlanGate";
import { useSessionStore } from "../lib/sessionStore";
import { messageApi } from "../services/messageApi";
import type { CertificateTrustReport } from "../types/api";

const TRUST_REVIEW_TITLE = "Trust review";

function outcomeTone(outcome: string): "danger" | "warning" | "success" | "neutral" {
  if (outcome === "tampered" || outcome === "invalid") return "danger";
  if (outcome === "revoked" || outcome === "expired") return "warning";
  if (outcome === "valid") return "success";
  return "neutral";
}

function formatReasons(reasons: unknown): string {
  if (!Array.isArray(reasons)) return "";
  return reasons.filter((item): item is string => typeof item === "string").join(", ");
}

function buildTrustReviewBriefing(data: CertificateTrustReport): string {
  const flagged = data.flaggedVerifications.slice(0, 8);
  const lookups = data.recentLookups.slice(0, 6);
  const flaggedLines = flagged.length
    ? flagged
        .map((row) => {
          const reasons = formatReasons(row.failureReasons);
          return `• ${row.outcome.toUpperCase()} — ${row.title} (${row.verificationCode})${
            reasons ? ` — ${reasons}` : ""
          }`;
        })
        .join("\n")
    : "• None right now";
  const lookupLines = lookups.length
    ? lookups
        .map(
          (row) =>
            `• ${row.publicId} — ${row.title} — ${row.outcome} (${row.publicLookup ? "public QR" : "staff"})`,
        )
        .join("\n")
    : "• None yet";

  return [
    "Trust review snapshot",
    `Generated ${new Date(data.generatedAt).toLocaleString()}`,
    "",
    `Verifications run: ${data.verification.total}`,
    `Document desk: ${data.verification.documentChecks}`,
    `Certificate lookups: ${data.verification.certificateLookups} (${data.verification.certificateLookupFailures} failed)`,
    `Flagged (tampered / invalid / revoked): ${data.verification.flagged}`,
    `Integrity mismatches: ${data.verification.fakeOrTampered}`,
    "",
    "Recent certificate checks:",
    lookupLines,
    "",
    "Flagged items to review:",
    flaggedLines,
  ].join("\n");
}

export function CertificateTrustReportPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const report = useCertificateTrustReport(organizationId);
  const directory = useMessageDirectory(organizationId);
  const conversations = useConversations(organizationId);
  const createConversation = useCreateConversation(organizationId ?? "");
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [asking, setAsking] = useState(false);

  async function askStaff() {
    const data = report.data;
    if (!organizationId || !data) return;
    const memberIds = (directory.data ?? []).map((member) => member.userId);
    if (!memberIds.length) {
      feedback.warning(
        "No other staff yet",
        "Add an employee or admin, then you can open a review thread from here.",
      );
      navigate("/messages");
      return;
    }

    setAsking(true);
    try {
      const existing = (conversations.data ?? []).find(
        (item) => item.type === "group" && item.title === TRUST_REVIEW_TITLE,
      );
      const conversation =
        existing ??
        (await createConversation.mutateAsync({
          type: "group",
          title: TRUST_REVIEW_TITLE,
          memberIds,
        }));
      await messageApi.sendMessage(conversation.id, buildTrustReviewBriefing(data));
      feedback.success("Review thread opened", "Staff can see the latest flagged checks in Messages.");
      navigate(`/messages?c=${conversation.id}`);
    } catch (error) {
      feedback.error(error, "Could not open a staff review thread");
    } finally {
      setAsking(false);
    }
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Trust reports" description="Live issuance and verification activity." />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  const data = report.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Trust reports"
        description="Live issuance plus document-desk and public/staff certificate checks. Integrity mismatches are listed for review."
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/certificates/analytics" className="text-[var(--tc-accent)] hover:underline">
              Full analytics
            </Link>
            <Link to="/verification" className="text-[var(--tc-accent)] hover:underline">
              Verification desk
            </Link>
            <Button
              variant="secondary"
              disabled={asking || !data}
              onClick={() => void askStaff()}
            >
              <MessageSquare className="h-4 w-4" />
              {asking ? "Opening…" : "Ask staff"}
            </Button>
          </div>
        }
      />

      {report.isError ? (
        isPlanLockedError(report.error) ? (
          <UpgradeCard feature="trust_reports" organizationId={organizationId} />
        ) : (
          <FormError>{getCertificateErrorMessage(report.error)}</FormError>
        )
      ) : null}

      {report.isLoading ? (
        <p className="text-sm text-tc-muted">Loading trust report…</p>
      ) : data ? (
        <PlanGate feature="trust_reports" organizationId={organizationId}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Integrity mismatches"
              value={data.verification.fakeOrTampered}
              hint="Hash or artifact failures"
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Flagged checks"
              value={data.verification.flagged}
              hint="Tampered, invalid, or revoked"
              icon={<ShieldCheck className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Certificates issued"
              value={data.issuance.issued}
              icon={<Award className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Verifications run"
              value={data.verification.total}
              hint={`${data.verification.documentChecks} document · ${data.verification.certificateLookups} certificate`}
              icon={<ShieldCheck className="h-5 w-5" />}
              tone="info"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MetricCard
              title="Verification outcomes"
              subtitle="Document desk plus public QR and staff certificate verifies"
            >
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(
                  [
                    ["valid", data.verification.valid],
                    ["tampered", data.verification.fakeOrTampered],
                    ["invalid", data.verification.invalid],
                    ["revoked", data.verification.revoked],
                    ["expired", data.verification.expired],
                    ["missing", data.verification.missing],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-[var(--tc-border)] px-3 py-2"
                  >
                    <span className="capitalize text-tc-muted">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </MetricCard>
            <MetricCard title="Where checks came from" subtitle="Certificate lookups were missing from this page before">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(
                  [
                    ["Document desk", data.verification.documentChecks],
                    ["Certificate lookups", data.verification.certificateLookups],
                    ["Lookup failures", data.verification.certificateLookupFailures],
                    ["Issued certificates", data.issuance.issued],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-[var(--tc-border)] px-3 py-2"
                  >
                    <span className="text-tc-muted">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </MetricCard>
          </div>

          <Card>
            <h3 className="mb-3 font-display text-base font-semibold">Recent certificate checks</h3>
            {data.recentLookups.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <TH>Outcome</TH>
                      <TH>Certificate</TH>
                      <TH>Source</TH>
                      <TH>Checked by</TH>
                      <TH>When</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLookups.map((row) => (
                      <tr key={row.id}>
                        <TD>
                          <Badge tone={outcomeTone(row.outcome)}>{row.outcome}</Badge>
                        </TD>
                        <TD>
                          <Link to={row.href} className="text-[var(--tc-accent)] hover:underline">
                            {row.title}
                          </Link>
                          <p className="text-xs text-tc-muted">{row.publicId}</p>
                        </TD>
                        <TD>
                          <span className="inline-flex items-center gap-1 text-tc-muted">
                            {row.publicLookup ? <QrCode className="h-3.5 w-3.5" /> : null}
                            {row.publicLookup ? "Public QR" : "Staff"}
                          </span>
                        </TD>
                        <TD>{row.requestedBy}</TD>
                        <TD>{new Date(row.verifiedAt).toLocaleString()}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No certificate lookups yet"
                description="Public QR scans and staff certificate verifies will appear here."
                icon={<QrCode className="h-6 w-6" />}
              />
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-display text-base font-semibold">Flagged verifications</h3>
            {data.flaggedVerifications.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <TH>Outcome</TH>
                      <TH>Item</TH>
                      <TH>Source</TH>
                      <TH>Checked by</TH>
                      <TH>When</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {data.flaggedVerifications.map((row) => (
                      <tr key={row.id}>
                        <TD>
                          <Badge tone={outcomeTone(row.outcome)}>{row.outcome}</Badge>
                        </TD>
                        <TD>
                          <Link to={row.href} className="text-[var(--tc-accent)] hover:underline">
                            {row.title || row.verificationCode}
                          </Link>
                          <p className="text-xs text-tc-muted">
                            {row.publicId ?? row.verificationCode}
                            {formatReasons(row.failureReasons)
                              ? ` · ${formatReasons(row.failureReasons)}`
                              : ""}
                          </p>
                        </TD>
                        <TD className="capitalize">{row.source}</TD>
                        <TD>{row.requestedBy}</TD>
                        <TD>{new Date(row.verifiedAt).toLocaleString()}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No failed checks yet"
                description="Tampered, invalid, and revoked document or certificate verifies will appear here."
                icon={<ShieldCheck className="h-6 w-6" />}
              />
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-display text-base font-semibold">Recent issues</h3>
            {data.recentIssues.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <TH>Certificate</TH>
                      <TH>Recipient</TH>
                      <TH>Issued</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentIssues.map((row) => (
                      <tr key={row.id}>
                        <TD>
                          <Link
                            to={`/certificates/${row.id}`}
                            className="text-[var(--tc-accent)] hover:underline"
                          >
                            {row.title}
                          </Link>
                          <p className="text-xs text-tc-muted">{row.publicId}</p>
                        </TD>
                        <TD>
                          {row.recipientName}
                          {row.recipientEmail ? (
                            <p className="text-xs text-tc-muted">{row.recipientEmail}</p>
                          ) : null}
                        </TD>
                        <TD>{row.issuedAt ? new Date(row.issuedAt).toLocaleString() : "—"}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-tc-muted">No issued certificates yet.</p>
            )}
          </Card>
        </PlanGate>
      ) : null}
    </AppShellLayout>
  );
}
