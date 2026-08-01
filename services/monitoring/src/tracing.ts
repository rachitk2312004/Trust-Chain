export type Span = {
  traceId: string;
  spanId: string;
  name: string;
  startedAt: string;
  durationMs?: number;
};

let traceCounter = 0;

export function startSpan(name: string): Span {
  traceCounter += 1;
  return {
    traceId: `trace-${traceCounter}`,
    spanId: `span-${traceCounter}`,
    name,
    startedAt: new Date().toISOString(),
  };
}

export function endSpan(span: Span, durationMs: number): Span {
  return { ...span, durationMs };
}
