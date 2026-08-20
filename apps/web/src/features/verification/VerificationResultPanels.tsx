import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";
import { confidenceFromReport, outcomeTone } from "../../lib/verifyErrors";
import type { PublicVerificationReport, VerificationReport } from "../../types/api";

export function OutcomeBadge({ outcome }: { outcome: string | null | undefined }) {
  return <Badge tone={outcomeTone(outcome)}>{outcome ?? "pending"}</Badge>;
}

export function ConfidenceIndicator({
  report,
}: {
  report: Pick<VerificationReport, "checks" | "verificationResult" | "failureReasons"> | null;
}) {
  const confidence = confidenceFromReport(report);
  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge tone={confidence.tone}>{confidence.label}</Badge>
      <span className="text-[var(--tc-muted)]">{confidence.score}%</span>
    </div>
  );
}

export function VerificationTimeline({
  report,
  status,
}: {
  report: VerificationReport | null;
  status?: string | null;
}) {
  const checks = report?.checks ?? [];
  return (
    <ol className="relative space-y-0 border-l border-[var(--tc-border)] pl-6">
      <li className="relative pb-6">
        <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-[var(--tc-accent)] bg-[var(--tc-surface)]" />
        <p className="font-medium">Request status</p>
        <p className="text-sm text-[var(--tc-muted)]">{status ?? report?.status ?? "—"}</p>
      </li>
      {checks.map((check) => (
        <li key={`${check.name}-${check.code ?? ""}`} className="relative pb-6">
          <span
            className={[
              "absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 bg-[var(--tc-surface)]",
              check.passed ? "border-emerald-600" : "border-[var(--tc-danger)]",
            ].join(" ")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{check.name}</p>
            <Badge tone={check.passed ? "success" : "danger"}>
              {check.passed ? "passed" : "failed"}
            </Badge>
          </div>
          {check.detail ? (
            <p className="mt-1 text-sm text-[var(--tc-muted)]">{check.detail}</p>
          ) : null}
          {check.code ? (
            <p className="mt-1 font-mono text-xs text-[var(--tc-muted)]">{check.code}</p>
          ) : null}
        </li>
      ))}
      {report ? (
        <li className="relative pb-2">
          <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-[var(--tc-accent)] bg-[var(--tc-surface)]" />
          <p className="font-medium">Outcome</p>
          <div className="mt-1">
            <OutcomeBadge outcome={report.verificationResult} />
          </div>
        </li>
      ) : null}
    </ol>
  );
}

export function VerificationMetadataViewer({
  report,
  publicReport,
}: {
  report?: VerificationReport | null;
  publicReport?: PublicVerificationReport | null;
}) {
  const source = report
    ? {
        verificationCode: report.verificationCode,
        documentId: report.documentId,
        versionNumber: report.versionNumber,
        contentHash: report.contentHash,
        blockchainStatus: report.blockchainStatus,
        revocationStatus: report.revocationStatus,
        networkName: report.networkName,
        transactionHash: report.transactionHash,
        blockNumber: report.blockNumber,
        proofOfIntegrity: report.proofOfIntegrity,
        proofTimestamp: report.proofTimestamp,
        verificationTimestamp: report.verificationTimestamp,
        failureReasons: report.failureReasons,
        cached: report.cached,
      }
    : publicReport
      ? {
          verificationCode: publicReport.verificationCode,
          publicVerifyCode: publicReport.publicVerifyCode,
          versionNumber: publicReport.versionNumber,
          contentHash: publicReport.contentHash,
          revocationStatus: publicReport.revocationStatus,
          networkName: publicReport.networkName,
          transactionHash: publicReport.transactionHash,
          blockNumber: publicReport.blockNumber,
          proofOfIntegrity: publicReport.proofOfIntegrity,
          proofTimestamp: publicReport.proofTimestamp,
          verificationTimestamp: publicReport.verificationTimestamp,
          reportChecksum: publicReport.reportChecksum,
          expiresAt: publicReport.expiresAt,
        }
      : null;

  if (!source) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>No report available.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <CardDescription>Verification report fields</CardDescription>
      </CardHeader>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 px-1 text-sm">
        {Object.entries(source).map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-[var(--tc-muted)]">{key}</dt>
            <dd className="break-all">
              {Array.isArray(value)
                ? value.length
                  ? value.join(", ")
                  : "—"
                : value === null || value === undefined || value === ""
                  ? "—"
                  : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
