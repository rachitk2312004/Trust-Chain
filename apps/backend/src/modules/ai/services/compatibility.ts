/**
 * Maps Wave 9 v1 job kinds ↔ Phase 2 queue capabilities / task ledger.
 * Express must never import workers or engines.
 */
import { AiQueueNames } from "@trustchain/config";

export type Wave9JobKind = "ocr" | "extract" | "classify" | "search" | "fraud" | "embed";

const KIND_TO_QUEUE: Record<Wave9JobKind, keyof typeof AiQueueNames> = {
  ocr: "ocr",
  extract: "extraction",
  classify: "classification",
  search: "embedding",
  fraud: "fraud",
  embed: "embedding",
};

export function capabilityForKind(kind: Wave9JobKind): string {
  return AiQueueNames[KIND_TO_QUEUE[kind]];
}

export function mapLegacyToTask(input: {
  legacyJobPublicCode: string;
  taskPublicCode: string;
  kind: Wave9JobKind;
}): {
  legacyJobPublicCode: string;
  taskPublicCode: string;
  queueName: string;
  kind: Wave9JobKind;
} {
  return {
    legacyJobPublicCode: input.legacyJobPublicCode,
    taskPublicCode: input.taskPublicCode,
    queueName: capabilityForKind(input.kind),
    kind: input.kind,
  };
}
