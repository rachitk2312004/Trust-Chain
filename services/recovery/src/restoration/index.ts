export type RestorationPlan = {
  backupId: string;
  steps: string[];
  destructive: false;
  approvalRequired: true;
};

export function buildRestorationPlan(backupId: string): RestorationPlan {
  return {
    backupId,
    destructive: false,
    approvalRequired: true,
    steps: [
      "Validate backup integrity",
      "Obtain restoration approval",
      "Restore to isolated environment first",
      "Run validation checks",
      "Promote to production manually",
    ],
  };
}
