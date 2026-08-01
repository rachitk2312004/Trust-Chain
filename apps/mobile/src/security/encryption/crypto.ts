/** Lightweight AES-GCM helpers for encrypted cache payloads (Web Crypto). */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function importAesKey(rawBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(rawBase64);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function createRawKeyBase64(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(raw);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptJson<T>(key: CryptoKey, payload: string): Promise<T> {
  const [ivB64, dataB64] = payload.split(".");
  if (!ivB64 || !dataB64) throw new Error("MOBILE_DECRYPT_INVALID");
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(dataB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
