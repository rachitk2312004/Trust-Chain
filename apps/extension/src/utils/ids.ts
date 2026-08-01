import { ExtensionIdPrefixes } from "@trustchain/config";

function randomSuffix(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function generateExtId(kind: keyof typeof ExtensionIdPrefixes = "session"): string {
  const prefix = ExtensionIdPrefixes[kind];
  return `${prefix}-${randomSuffix()}`;
}

export function isExtId(value: string, kind?: keyof typeof ExtensionIdPrefixes): boolean {
  if (kind) {
    return new RegExp(`^${ExtensionIdPrefixes[kind]}-[0-9A-F]{8}$`, "i").test(value);
  }
  return /^(EXT-SESSION|EXT-CACHE|EXT-EVENT)-[0-9A-F]{8}$/i.test(value);
}
