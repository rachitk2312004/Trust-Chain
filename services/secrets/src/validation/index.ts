export type SecretRef = {
  id: string;
  provider: string;
  path: string;
};

const REF_PATTERN = /^[a-zA-Z0-9/_-]+$/;

export function validateSecretRef(ref: SecretRef): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ref.id.trim()) errors.push("id is required");
  if (!ref.provider.trim()) errors.push("provider is required");
  if (!REF_PATTERN.test(ref.path)) errors.push("path contains invalid characters");
  return { valid: errors.length === 0, errors };
}

/** Never returns raw secret values — ref metadata only. */
export function describeSecretRef(ref: SecretRef): SecretRef {
  return { id: ref.id, provider: ref.provider, path: ref.path };
}
