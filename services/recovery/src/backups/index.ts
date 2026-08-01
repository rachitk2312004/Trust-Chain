export type BackupMetadata = {
  id: string;
  source: string;
  sizeBytes: number;
  createdAt: string;
  encrypted: boolean;
};

export function recordBackup(source: string, sizeBytes: number): BackupMetadata {
  return {
    id: `BACKUP-${Date.now()}`,
    source,
    sizeBytes,
    createdAt: new Date().toISOString(),
    encrypted: true,
  };
}
