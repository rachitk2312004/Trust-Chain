export type ComputeUsage = {
  cpuPercent: number;
  memoryMb: number;
  instances: number;
};

export function computeUsage(
  cpuPercent: number,
  memoryMb: number,
  instances: number,
): ComputeUsage {
  return { cpuPercent, memoryMb, instances };
}
