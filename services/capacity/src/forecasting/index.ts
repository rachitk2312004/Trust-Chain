export type ForecastPoint = {
  timestamp: string;
  projectedValue: number;
};

export function forecastLinear(history: number[], periods = 3): ForecastPoint[] {
  if (history.length === 0) {
    return [];
  }

  const last = history[history.length - 1]!;
  const prev = history.length > 1 ? history[history.length - 2]! : last;
  const delta = last - prev;

  return Array.from({ length: periods }, (_, index) => ({
    timestamp: new Date(Date.now() + (index + 1) * 86_400_000).toISOString(),
    projectedValue: last + delta * (index + 1),
  }));
}
