import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import config from "../config";

let r2Client: S3Client | null = null;

const isR2Configured = (): boolean => {
    return Boolean(
        config.r2.enabled &&
            config.r2.endpoint &&
            config.r2.bucketName &&
            config.r2.accessKeyId &&
            config.r2.secretAccessKey &&
            config.r2.publicBaseUrl,
    );
};

const getR2Client = (): S3Client => {
    if (r2Client) {
        return r2Client;
    }

    r2Client = new S3Client({
        region: config.r2.region,
        endpoint: config.r2.endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    return r2Client;
};

const buildPublicObjectUrl = (objectKey: string): string => {
    const baseUrl = String(config.r2.publicBaseUrl || "").trim().replace(/\/+$/, "");
    return `${baseUrl}/${objectKey}`;
};

const uploadPublicObject = async (payload: {
    objectKey: string;
    body: Buffer;
    contentType: string;
    cacheControl?: string;
}): Promise<string> => {
    if (!isR2Configured()) {
        throw new Error("Cloudflare R2 is not configured.");
    }

    const client = getR2Client();

    await client.send(
        new PutObjectCommand({
            Bucket: config.r2.bucketName,
            Key: payload.objectKey,
            Body: payload.body,
            ContentType: payload.contentType,
            CacheControl: payload.cacheControl || "public, max-age=31536000, immutable",
        }),
    );

    return buildPublicObjectUrl(payload.objectKey);
};

export { buildPublicObjectUrl, isR2Configured, uploadPublicObject };