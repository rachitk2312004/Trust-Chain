/**
 * At-rest encryption hook for document objects.
 * Default implementation is passthrough (R2 stores ciphertext as-uploaded).
 * Replace with envelope encryption later without changing callers.
 */
export type EncryptDocumentInput = {
  objectKey: string;
  mimeType: string;
  contentHash: string;
};

export type EncryptDocumentResult = {
  objectKey: string;
  encrypted: boolean;
};

export async function encryptDocumentObject(
  input: EncryptDocumentInput,
): Promise<EncryptDocumentResult> {
  return { objectKey: input.objectKey, encrypted: false };
}
