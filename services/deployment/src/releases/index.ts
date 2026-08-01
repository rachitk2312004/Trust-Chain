import { generateCode } from "../../../shared/types.js";

export type ReleaseRecord = {
  code: string;
  version: string;
  createdAt: string;
  notes: string;
};

export function createRelease(version: string, notes = ""): ReleaseRecord {
  return {
    code: generateCode("RELEASE-"),
    version,
    createdAt: new Date().toISOString(),
    notes,
  };
}
