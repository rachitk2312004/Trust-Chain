export type ProfileSample = {
  label: string;
  durationMs: number;
};

export function profileStub(label: string, durationMs = 1): ProfileSample {
  return { label, durationMs };
}
