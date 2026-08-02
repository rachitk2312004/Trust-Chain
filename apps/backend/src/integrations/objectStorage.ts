import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Readable, Transform, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ObjectStorageProvider } from "@trustchain/config";

/**
 * Cloudflare R2 object storage.
 * Stores uploaded files only (PDFs, images, certificates, QR assets, import CSVs).
 * PostgreSQL remains the metadata source of truth.
 */
export function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is required");
  }
  return bucket;
}

function createClient(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required");
  }

  return new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

let client: S3Client | undefined;

export function getClient(): S3Client {
  if (!client) {
    client = createClient();
  }
  return client;
}

export async function createUploadUrl(input: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{
  uploadUrl: string;
  objectKey: string;
  provider: typeof ObjectStorageProvider;
  bucket: string;
  expiresInSeconds: number;
}> {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: input.objectKey,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: expiresInSeconds,
  });
  return {
    uploadUrl,
    objectKey: input.objectKey,
    provider: ObjectStorageProvider,
    bucket: getBucket(),
    expiresInSeconds,
  };
}

export async function createDownloadUrl(input: {
  objectKey: string;
  expiresInSeconds?: number;
  fileName?: string;
}): Promise<{
  downloadUrl: string;
  objectKey: string;
  provider: typeof ObjectStorageProvider;
  bucket: string;
  expiresInSeconds: number;
}> {
  const expiresInSeconds = input.expiresInSeconds ?? 900;
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: input.objectKey,
    ResponseContentDisposition: input.fileName
      ? `attachment; filename="${input.fileName.replace(/"/g, "")}"`
      : undefined,
  });
  const downloadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: expiresInSeconds,
  });
  return {
    downloadUrl,
    objectKey: input.objectKey,
    provider: ObjectStorageProvider,
    bucket: getBucket(),
    expiresInSeconds,
  };
}

export async function headObject(objectKey: string): Promise<{
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  etag?: string;
}> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: objectKey,
      }),
    );
    return {
      exists: true,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag,
    };
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
      return { exists: false };
    }
    throw error;
  }
}

export async function getObjectBuffer(objectKey: string): Promise<{
  exists: boolean;
  body?: Buffer;
  contentType?: string;
  contentLength?: number;
}> {
  try {
    const result = await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: objectKey,
      }),
    );
    if (!result.Body) {
      return { exists: false };
    }
    const bytes = await result.Body.transformToByteArray();
    return {
      exists: true,
      body: Buffer.from(bytes),
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (name === "NotFound" || name === "NoSuchKey" || name === "NoSuchBucket" || status === 404) {
      return { exists: false };
    }
    throw error;
  }
}

export async function putObjectBuffer(input: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<{
  objectKey: string;
  provider: typeof ObjectStorageProvider;
  bucket: string;
}> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return {
    objectKey: input.objectKey,
    provider: ObjectStorageProvider,
    bucket: getBucket(),
  };
}

/** Stream R2 object through SHA-256 with constant memory footprint. */
export async function streamSha256Object(objectKey: string): Promise<{
  hash: string;
  bytesRead: number;
}> {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }),
  );
  if (!result.Body) {
    throw new Error(`Object body missing for ${objectKey}`);
  }

  const hash = createHash("sha256");
  let bytesRead = 0;
  const body = result.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buf);
    bytesRead += buf.length;
  }
  return { hash: hash.digest("hex"), bytesRead };
}

/**
 * Stream-encrypt source → dest with AES-256-GCM (chunked; constant memory).
 * Returns IV and auth tag for DocumentVersion metadata.
 */
export async function streamEncryptObjectToKey(input: {
  sourceKey: string;
  destKey: string;
  contentType: string;
  dek: Buffer;
}): Promise<{ iv: string; authTag: string; bytesRead: number }> {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: input.sourceKey,
    }),
  );
  if (!result.Body) {
    throw new Error(`Object body missing for ${input.sourceKey}`);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", input.dek, iv);
  let bytesRead = 0;

  const encryptTransform = new Transform({
    transform(chunk, _enc, cb) {
      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytesRead += buf.length;
        cb(null, cipher.update(buf));
      } catch (error) {
        cb(error as Error);
      }
    },
    flush(cb) {
      try {
        const final = cipher.final();
        cb(null, final.length ? final : undefined);
      } catch (error) {
        cb(error as Error);
      }
    },
  });

  const source = Readable.from(result.Body as AsyncIterable<Uint8Array>);
  const pass = new PassThrough();
  const uploadPromise = getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.destKey,
      Body: pass,
      ContentType: input.contentType,
    }),
  );

  await pipeline(source, encryptTransform, pass);
  await uploadPromise;

  return {
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    bytesRead,
  };
}

/** Stream-decrypt ciphertext object, invoking onChunk for each plaintext chunk. */
export async function streamDecryptObject(input: {
  objectKey: string;
  dek: Buffer;
  iv: string;
  authTag: string;
  onChunk: (chunk: Buffer) => void;
}): Promise<{ bytesRead: number }> {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: input.objectKey,
    }),
  );
  if (!result.Body) {
    throw new Error(`Object body missing for ${input.objectKey}`);
  }

  const decipher = createDecipheriv("aes-256-gcm", input.dek, Buffer.from(input.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64url"));

  let bytesRead = 0;
  const body = result.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytesRead += buf.length;
    const plain = decipher.update(buf);
    if (plain.length) input.onChunk(plain);
  }
  const final = decipher.final();
  if (final.length) input.onChunk(final);
  return { bytesRead };
}
