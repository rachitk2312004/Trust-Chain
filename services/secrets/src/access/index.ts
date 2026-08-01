export type AccessCheck = {
  secretRef: string;
  principal: string;
  allowed: boolean;
  reason: string;
};

export function checkSecretAccess(
  secretRef: string,
  principal: string,
  allowedPrincipals: string[],
): AccessCheck {
  const allowed = allowedPrincipals.includes(principal);
  return {
    secretRef,
    principal,
    allowed,
    reason: allowed ? "principal authorized" : "principal not in allow list",
  };
}
