export type RetentionMetadata = {
  resourceType: string;
  retentionDays: number;
  legalHold: boolean;
};

export function defineRetentionMetadata(
  resourceType: string,
  retentionDays: number,
  legalHold = false,
): RetentionMetadata {
  return { resourceType, retentionDays, legalHold };
}
