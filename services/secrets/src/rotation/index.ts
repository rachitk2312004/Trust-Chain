export type RotationSchedule = {
  secretRef: string;
  intervalDays: number;
  nextRotationAt: string;
};

export function scheduleRotation(secretRef: string, intervalDays: number): RotationSchedule {
  const next = new Date();
  next.setDate(next.getDate() + intervalDays);
  return {
    secretRef,
    intervalDays,
    nextRotationAt: next.toISOString(),
  };
}
