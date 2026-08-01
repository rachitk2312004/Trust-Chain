/** AES-GCM encryption for local cache / tokens. Key never leaves the extension. */

const STORAGE_KEY_MATERIAL = "tc_ext_key_material_v1";

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_MATERIAL);
  let raw: ArrayBuffer;
  if (typeof stored[STORAGE_KEY_MATERIAL] === "string") {
    raw = base64ToBytes(stored[STORAGE_KEY_MATERIAL]).buffer as ArrayBuffer;
  } else {
    raw = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer;
    await chrome.storage.local.set({
      [STORAGE_KEY_MATERIAL]: bytesToBase64(new Uint8Array(raw)),
    });
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(value: unknown): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptJson<T>(payload: string): Promise<T> {
  const [ivB64, dataB64] = payload.split(".");
  if (!ivB64 || !dataB64) throw new Error("EXT_DECRYPT_INVALID");
  const key = await getOrCreateKey();
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(dataB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

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
