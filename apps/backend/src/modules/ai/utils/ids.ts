import { randomBytes } from "node:crypto";
import { AiIdPrefixes } from "@trustchain/config";

export type AiIdKind = keyof typeof AiIdPrefixes;

/** Public AI identifier: PREFIX-XXXXXXXX */
export function generateAiPublicCode(kind: AiIdKind): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${AiIdPrefixes[kind]}-${suffix}`;
}
