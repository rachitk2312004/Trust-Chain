/**
 * In-process certificate platform metrics (render/download/verify latency).
 * Durable analytics come from Certificate / CertificateEvent / BulkJob tables.
 */

export type CertificateProcessMetricsSnapshot = {
  downloads: number;
  renders: number;
  renderFailures: number;
  verifications: number;
  averageRenderTimeMs: number | null;
  averageVerificationTimeMs: number | null;
  downloadByFormat: Record<string, number>;
};

const LATENCY_RING_SIZE = 200;

export function averageLatency(samples: number[]): number | null {
  if (!samples.length) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

export class CertificateProcessMetrics {
  private downloads = 0;
  private renders = 0;
  private renderFailures = 0;
  private verifications = 0;
  private renderLatency: number[] = [];
  private verifyLatency: number[] = [];
  private downloadByFormat: Record<string, number> = {};

  recordDownload(format: string, latencyMs?: number): void {
    this.downloads += 1;
    const key = format.toLowerCase();
    this.downloadByFormat[key] = (this.downloadByFormat[key] ?? 0) + 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.renderLatency.push(latencyMs);
      if (this.renderLatency.length > LATENCY_RING_SIZE) this.renderLatency.shift();
      this.renders += 1;
    }
  }

  recordRender(latencyMs: number, ok = true): void {
    if (ok) {
      this.renders += 1;
      if (Number.isFinite(latencyMs) && latencyMs >= 0) {
        this.renderLatency.push(latencyMs);
        if (this.renderLatency.length > LATENCY_RING_SIZE) this.renderLatency.shift();
      }
    } else {
      this.renderFailures += 1;
    }
  }

  recordVerification(latencyMs?: number): void {
    this.verifications += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.verifyLatency.push(latencyMs);
      if (this.verifyLatency.length > LATENCY_RING_SIZE) this.verifyLatency.shift();
    }
  }

  snapshot(): CertificateProcessMetricsSnapshot {
    return {
      downloads: this.downloads,
      renders: this.renders,
      renderFailures: this.renderFailures,
      verifications: this.verifications,
      averageRenderTimeMs: averageLatency(this.renderLatency),
      averageVerificationTimeMs: averageLatency(this.verifyLatency),
      downloadByFormat: { ...this.downloadByFormat },
    };
  }

  reset(): void {
    this.downloads = 0;
    this.renders = 0;
    this.renderFailures = 0;
    this.verifications = 0;
    this.renderLatency = [];
    this.verifyLatency = [];
    this.downloadByFormat = {};
  }
}

export const certificateProcessMetrics = new CertificateProcessMetrics();
