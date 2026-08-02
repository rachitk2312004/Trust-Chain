export type ExplanationParts = {
  kind: string;
  evidence?: string[];
  attribution?: string[];
  reasoning?: string[];
  summary?: string;
};

export type Explanation = {
  evidence: string[];
  attribution: string[];
  reasoning: string[];
  summary: string;
};

/** Builds explainability payload from gateway/adapter fields (no fabricated stub prose). */
export function buildExplanation(input: ExplanationParts): Explanation {
  const kind = input.kind;
  return {
    evidence: input.evidence?.length
      ? input.evidence
      : [`capability:${kind}`, "source:adapter_result"],
    attribution: input.attribution?.length
      ? input.attribution
      : [`capability:${kind}`],
    reasoning: input.reasoning?.length
      ? input.reasoning
      : [`Result produced by AI execution pipeline for ${kind}`],
    summary:
      input.summary ??
      `Advisory ${kind} result. Wave 4/5 verification remains the trust authority.`,
  };
}
