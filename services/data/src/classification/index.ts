export type ClassificationLabel = "public" | "internal" | "confidential" | "restricted";

export type ClassifiedResource = {
  resourceId: string;
  label: ClassificationLabel;
  reason: string;
};

export function classifyResource(
  resourceId: string,
  label: ClassificationLabel,
  reason: string,
): ClassifiedResource {
  return { resourceId, label, reason };
}
