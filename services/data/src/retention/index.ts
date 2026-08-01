export type DataRetentionPolicy = {
  dataset: string;
  retentionDays: number;
  purgeMethod: "archive" | "delete";
};

export function defineDataRetention(
  dataset: string,
  retentionDays: number,
  purgeMethod: "archive" | "delete" = "archive",
): DataRetentionPolicy {
  return { dataset, retentionDays, purgeMethod };
}
