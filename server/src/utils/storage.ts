import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { AppError } from "../middleware/error-handler";

const PRESIGN_TTL_SECONDS = 5 * 60;

let client: S3Client | null = null;

const getBucket = () => {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new AppError(503, "Penyimpanan berkas belum dikonfigurasi", "STORAGE_NOT_CONFIGURED");
  }

  return env.S3_BUCKET;
};

const getClient = () => {
  const bucket = getBucket();

  client ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
    // Tanpa ini SDK menambahkan checksum CRC32 ke URL presigned, dan upload dari browser ke R2/MinIO gagal.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return { client, bucket };
};

/** Adapter penyimpanan S3-compatible. Dipanggil lewat objek ini supaya mudah di-mock di test. */
export const storage = {
  presignUpload: (key: string, mimeType: string) => {
    const { client, bucket } = getClient();
    return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType }), {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  },

  presignDownload: (key: string) => {
    const { client, bucket } = getClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  },

  /** Metadata objek, atau null bila objek belum ada. */
  headObject: async (key: string) => {
    const { client, bucket } = getClient();

    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return null;
      }

      throw error;
    }
  },
};
