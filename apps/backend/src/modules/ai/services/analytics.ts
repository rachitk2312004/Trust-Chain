type Counters = {
  jobsCreated: number;
  jobsCompleted: number;
  jobsFailed: number;
  ocr: number;
  extract: number;
  classify: number;
  search: number;
  fraud: number;
  reviews: number;
  estimatedCostUsd: number;
  tokenUsage: number;
};

const counters: Counters = {
  jobsCreated: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  ocr: 0,
  extract: 0,
  classify: 0,
  search: 0,
  fraud: 0,
  reviews: 0,
  estimatedCostUsd: 0,
  tokenUsage: 0,
};

export function aiAnalyticsInc(key: keyof Counters, amount = 1): void {
  counters[key] += amount;
}

export function getAiAnalyticsSnapshot(): Counters {
  return { ...counters };
}
