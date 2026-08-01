export type NetworkUsage = {
  ingressMbps: number;
  egressMbps: number;
  connections: number;
};

export function networkUsage(
  ingressMbps: number,
  egressMbps: number,
  connections: number,
): NetworkUsage {
  return { ingressMbps, egressMbps, connections };
}
