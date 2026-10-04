import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import https from "node:https";
import { accessSync, constants, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Transform, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ObjectStorageProvider } from "@trustchain/config";

// Backblaze B2 rejects AWS SDK v3 flexible checksums on many operations.
process.env.AWS_REQUEST_CHECKSUM_CALCULATION ??= "WHEN_REQUIRED";
process.env.AWS_RESPONSE_CHECKSUM_VALIDATION ??= "WHEN_REQUIRED";

function envFirst(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function storageEndpoint(): string | undefined {
  const raw = envFirst("B2_ENDPOINT", "R2_ENDPOINT");
  if (!raw) return undefined;
  // AWS SDK requires a full URL; bare hosts (common in .env copies) throw Invalid URL.
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function storageAccessKeyId(): string | undefined {
  return envFirst("B2_KEY_ID", "B2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID");
}

function storageSecretAccessKey(): string | undefined {
  return envFirst("B2_APPLICATION_KEY", "B2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY");
}

function storageBucketName(): string | undefined {
  return envFirst("B2_BUCKET", "R2_BUCKET");
}

function storageRegion(): string {
  return envFirst("B2_REGION", "R2_REGION") ?? "us-west-004";
}

/**
 * Object storage for uploaded files (PDFs, images, certificates, QR assets).
 * Uses Backblaze B2 (S3 API) when credentials are set; otherwise a local filesystem
 * so issue/verify works in development without a bucket.
 * PostgreSQL remains the metadata source of truth.
 */
export function isRemoteObjectStorageConfigured(): boolean {
  return Boolean(
    storageEndpoint() && storageAccessKeyId() && storageSecretAccessKey() && storageBucketName(),
  );
}

export function getObjectStorageMode(): "b2" | "local" {
  return isRemoteObjectStorageConfigured() ? "b2" : "local";
}

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function localStorageRoot(): string {
  const configured = process.env.OBJECT_STORAGE_DIR?.trim();
  if (configured && canWriteDir(configured)) return configured;
  const cwdRoot = join(process.cwd(), ".data", "object-storage");
  if (canWriteDir(cwdRoot)) return cwdRoot;
  // Serverless hosts (e.g. Vercel) often only allow writes under /tmp.
  return join(tmpdir(), "trustchain-object-storage");
}

function localObjectPath(objectKey: string): string {
  const safe = objectKey.replace(/^\/+/, "").replace(/\.\./g, "_");
  return join(localStorageRoot(), safe);
}

export function getBucket(): string {
  if (!isRemoteObjectStorageConfigured()) {
    return storageBucketName() || "local";
  }
  const bucket = storageBucketName();
  if (!bucket) {
    throw new Error("B2_BUCKET is required");
  }
  return bucket;
}

function createClient(): S3Client {
  const endpoint = storageEndpoint();
  const accessKeyId = storageAccessKeyId();
  const secretAccessKey = storageSecretAccessKey();
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("B2_ENDPOINT, B2_KEY_ID, and B2_APPLICATION_KEY are required");
  }

  // Force IPv4: several ISP/VPC paths advertise B2 AAAA records that never
  // connect, so the default SDK handler hangs ~20s and PDF uploads never land.
  const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

  return new S3Client({
    region: storageRegion(),
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    // Required for Backblaze B2 compatibility with AWS SDK JS v3.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: new NodeHttpHandler({
      httpsAgent,
      connectionTimeout: 10_000,
      requestTimeout: 60_000,
    }),
  });
}

let client: S3Client | undefined;

export function getClient(): S3Client {
  if (!client) {
    client = createClient();
  }
  return client;
}

function isNotFoundError(error: unknown): boolean {
  const name = (error as { name?: string }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === "NotFound" ||
    name === "NoSuchKey" ||
    name === "NoSuchBucket" ||
    status === 404 ||
    /not\s*found|no such key|nosuchkey/i.test(message)
  );
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
  if (!isRemoteObjectStorageConfigured()) {
    try {
      const stat = statSync(localObjectPath(objectKey));
      return { exists: true, contentLength: stat.size };
    } catch {
      return { exists: false };
    }
  }
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
    if (isNotFoundError(error)) {
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
  if (!isRemoteObjectStorageConfigured()) {
    try {
      const body = readFileSync(localObjectPath(objectKey));
      return { exists: true, body, contentLength: body.length };
    } catch {
      return { exists: false };
    }
  }
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
    if (isNotFoundError(error)) {
      return { exists: false };
    }
    // Some B2/SDK checksum mismatches surface as 400/403 — confirm with Head first.
    try {
      const head = await headObject(objectKey);
      if (!head.exists) return { exists: false };
    } catch {
      // fall through
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
  if (!isRemoteObjectStorageConfigured()) {
    const filePath = localObjectPath(input.objectKey);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, input.body);
    return {
      objectKey: input.objectKey,
      provider: ObjectStorageProvider,
      bucket: getBucket(),
    };
  }
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `B2 PutObject failed for ${input.objectKey} (bucket=${getBucket()}): ${message}`,
    );
  }

  // Read-after-write check — catches silent B2/auth mismatches early.
  const written = await getObjectBuffer(input.objectKey);
  if (!written.exists || !written.body?.length) {
    throw new Error(
      `B2 PutObject succeeded but object is not readable: ${input.objectKey} (bucket=${getBucket()}). Check B2_KEY_ID/B2_APPLICATION_KEY permissions and B2_BUCKET.`,
    );
  }

  return {
    objectKey: input.objectKey,
    provider: ObjectStorageProvider,
    bucket: getBucket(),
  };
}

/** Stream stored object through SHA-256 with constant memory footprint. */
export async function streamSha256Object(objectKey: string): Promise<{
  hash: string;
  bytesRead: number;
}> {
  if (!isRemoteObjectStorageConfigured()) {
    const body = readFileSync(localObjectPath(objectKey));
    return {
      hash: createHash("sha256").update(body).digest("hex"),
      bytesRead: body.length,
    };
  }
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
