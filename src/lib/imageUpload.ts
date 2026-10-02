import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Shared resize/compress + S3 upload pipeline — used by any feature that accepts
// an image (menu items now, reviews later). Keyed by a fresh uuid so the original
// filename (and anything it might leak) never reaches storage.
const MAX_WIDTH = 1024;
const JPEG_QUALITY = 80;

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadImage(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const bucket = process.env.AWS_S3_BUCKET!;
  const key = `${process.env.AWS_S3_FOLDER}/${randomUUID()}.jpg`;
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: resized, ContentType: "image/jpeg" })
  );
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
