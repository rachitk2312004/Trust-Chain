export type MigrationChecklist = {
  id: string;
  steps: string[];
  completed: boolean[];
};

export function createMigrationChecklist(): MigrationChecklist {
  return {
    id: `MIGRATION-${Date.now()}`,
    steps: [
      "Review migration script",
      "Backup database",
      "Apply migration in staging",
      "Validate schema changes",
      "Schedule production window",
    ],
    completed: [false, false, false, false, false],
  };
}

export function markMigrationStep(
  checklist: MigrationChecklist,
  index: number,
): MigrationChecklist {
  const completed = [...checklist.completed];
  if (index >= 0 && index < completed.length) {
    completed[index] = true;
  }
  return { ...checklist, completed };
}
