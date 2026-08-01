export type LineageStep = {
  step: number;
  system: string;
  action: string;
  timestamp: string;
};

export function appendLineageStep(
  steps: LineageStep[],
  system: string,
  action: string,
): LineageStep[] {
  return [
    ...steps,
    {
      step: steps.length + 1,
      system,
      action,
      timestamp: new Date().toISOString(),
    },
  ];
}
