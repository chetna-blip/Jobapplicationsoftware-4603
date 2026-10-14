import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function signedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

/** Download an object from storage into memory (used for resume parsing + uploads). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  const buf = await res.Body!.transformToByteArray();
  return buf;
}
