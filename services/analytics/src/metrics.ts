export type MetricInput = {
  name: string;
  values: number[];
};

export type MetricSummary = {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
};

export function summarizeMetrics(input: MetricInput[]): MetricSummary[] {
  return input.map(({ name, values }) => {
    const count = values.length;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
      name,
      count,
      sum,
      avg: count > 0 ? sum / count : 0,
      min: count > 0 ? Math.min(...values) : 0,
      max: count > 0 ? Math.max(...values) : 0,
    };
  });
}
