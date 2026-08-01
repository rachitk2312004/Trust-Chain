export type AnomalyResult = {
  isAnomaly: boolean;
  index: number | null;
  value: number | null;
  suggestion: string | null;
};

export function detectAnomaly(series: number[], threshold: number): AnomalyResult {
  if (series.length === 0) {
    return { isAnomaly: false, index: null, value: null, suggestion: null };
  }

  const avg = series.reduce((acc, value) => acc + value, 0) / series.length;

  for (let index = 0; index < series.length; index += 1) {
    const value = series[index]!;
    if (Math.abs(value - avg) > threshold) {
      return {
        isAnomaly: true,
        index,
        value,
        suggestion: `Alert suggestion: review spike at index ${index} (value ${value}, avg ${avg.toFixed(2)}, threshold ${threshold})`,
      };
    }
  }

  return { isAnomaly: false, index: null, value: null, suggestion: null };
}
