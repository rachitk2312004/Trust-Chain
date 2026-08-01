export type RollbackPlan = {
  targetRelease: string;
  steps: string[];
  approvalRequired: true;
};

export function createRollbackPlan(targetRelease: string): RollbackPlan {
  return {
    targetRelease,
    approvalRequired: true,
    steps: [
      "Verify rollback target release artifacts",
      "Obtain deployment approval",
      "Scale down current deployment",
      "Deploy previous release",
      "Run post-rollback health checks",
    ],
  };
}
