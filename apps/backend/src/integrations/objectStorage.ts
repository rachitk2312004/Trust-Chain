import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ObjectStorageProvider } from "@trustchain/config";

/**
 * Cloudflare R2 object storage.
 * Stores uploaded files only (PDFs, images, certificates, QR assets, import CSVs).
 * PostgreSQL remains the metadata source of truth.
 */
function getBucket(): string {
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

function getClient(): S3Client {
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
