export type StorageUsage = {
  usedBytes: number;
  quotaBytes: number;
  utilization: number;
};

export function computeStorageUsage(usedBytes: number, quotaBytes: number): StorageUsage {
  return {
    usedBytes,
    quotaBytes,
    utilization: quotaBytes > 0 ? usedBytes / quotaBytes : 0,
  };
}
