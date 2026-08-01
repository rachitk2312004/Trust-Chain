import { randomBytes } from "node:crypto";
import { OpsIdPrefixes } from "@trustchain/config";

export type OpsIdKind = keyof typeof OpsIdPrefixes;

export function generateOpsPublicCode(kind: OpsIdKind): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${OpsIdPrefixes[kind]}-${suffix}`;
}
