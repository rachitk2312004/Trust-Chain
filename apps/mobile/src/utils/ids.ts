import { MobileIdPrefixes } from "@trustchain/config";
import type { MobileIdKind } from "../types/mobile.types";

function randomSuffix(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function generateMobileId(kind: MobileIdKind): string {
  return `${MobileIdPrefixes[kind]}-${randomSuffix()}`;
}

export function isMobileId(value: string, kind?: MobileIdKind): boolean {
  if (kind) {
    return new RegExp(`^${MobileIdPrefixes[kind]}-[0-9A-F]{8}$`, "i").test(value);
  }
  return /^(MOBILE-SESSION|MOBILE-CACHE|MOBILE-EVENT|MOBILE-DEVICE)-[0-9A-F]{8}$/i.test(value);
}
