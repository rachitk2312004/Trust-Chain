export type ValidationResult = {
  passed: boolean;
  checks: { name: string; ok: boolean }[];
};

export function validateRecovery(checks: { name: string; ok: boolean }[]): ValidationResult {
  return {
    passed: checks.every((check) => check.ok),
    checks,
  };
}
