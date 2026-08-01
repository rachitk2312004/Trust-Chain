export type SnapshotMetadata = {
  id: string;
  resourceId: string;
  pointInTime: string;
};

export function createSnapshot(resourceId: string): SnapshotMetadata {
  return {
    id: `SNAPSHOT-${Date.now()}`,
    resourceId,
    pointInTime: new Date().toISOString(),
  };
}
