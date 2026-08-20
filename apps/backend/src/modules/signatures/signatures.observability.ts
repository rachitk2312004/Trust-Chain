/**
 * In-process signature platform metrics (verify/approve/download latency).
 * Durable analytics come from Signature / SignatureEvent / SignatureWorkflow tables.
 */

export type SignatureProcessMetricsSnapshot = {
  verifications: number;
  verificationFailures: number;
  approvals: number;
  downloads: number;
  averageVerificationTimeMs: number | null;
  averageApprovalTimeMs: number | null;
  downloadByKind: Record<string, number>;
};

const LATENCY_RING_SIZE = 200;

export function averageLatency(samples: number[]): number | null {
  if (!samples.length) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

export class SignatureProcessMetrics {
  private verifications = 0;
  private verificationFailures = 0;
  private approvals = 0;
  private downloads = 0;
  private verifyLatency: number[] = [];
  private approvalLatency: number[] = [];
  private downloadByKind: Record<string, number> = {};

  recordVerification(latencyMs?: number, ok = true): void {
    this.verifications += 1;
    if (!ok) this.verificationFailures += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.verifyLatency.push(latencyMs);
      if (this.verifyLatency.length > LATENCY_RING_SIZE) this.verifyLatency.shift();
    }
  }

  recordApproval(latencyMs?: number): void {
    this.approvals += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.approvalLatency.push(latencyMs);
      if (this.approvalLatency.length > LATENCY_RING_SIZE) this.approvalLatency.shift();
    }
  }

  recordDownload(kind: string): void {
    this.downloads += 1;
    const key = kind.toLowerCase();
    this.downloadByKind[key] = (this.downloadByKind[key] ?? 0) + 1;
  }

  snapshot(): SignatureProcessMetricsSnapshot {
    return {
      verifications: this.verifications,
      verificationFailures: this.verificationFailures,
      approvals: this.approvals,
      downloads: this.downloads,
      averageVerificationTimeMs: averageLatency(this.verifyLatency),
      averageApprovalTimeMs: averageLatency(this.approvalLatency),
      downloadByKind: { ...this.downloadByKind },
    };
  }

  reset(): void {
    this.verifications = 0;
    this.verificationFailures = 0;
    this.approvals = 0;
    this.downloads = 0;
    this.verifyLatency = [];
    this.approvalLatency = [];
    this.downloadByKind = {};
  }
}

export const signatureProcessMetrics = new SignatureProcessMetrics();
