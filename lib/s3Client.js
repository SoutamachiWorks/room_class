import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'roomclass-storage';

/**
 * Upload a file to Cloudflare R2
 * @param {Buffer} fileBuffer - The buffer of the file
 * @param {string} fileName - Original file name (will be sanitized and made unique)
 * @param {string} mimeType - MIME type of the file
 * @param {string} folder - Folder prefix (e.g. 'materials', 'assignments')
 * @returns {Promise<{ fileKey: string, size: number, originalName: string, mimeType: string }>} Metadata of the uploaded file
 */
export async function uploadToR2(fileBuffer, fileName, mimeType, folder) {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueId = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
  const fileKey = `${folder ? folder + '/' : ''}${uniqueId}_${sanitizedName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return {
    fileKey,
    size: fileBuffer.length,
    originalName: fileName,
    mimeType
  };
}

/**
 * Delete a file from Cloudflare R2
 * @param {string} fileKey - The exact path key of the file in the bucket
 */
export async function deleteFromR2(fileKey) {
  if (!fileKey) return;
  
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error(`Failed to delete orphaned file ${fileKey} from R2:`, error);
  }
}

/**
 * Generate a time-limited Presigned URL for secure frontend streaming/download
 * @param {string} fileKey - The key of the file
 * @param {number} expiresIn - Expiry time in seconds (default 3600 = 1 hour)
 * @returns {Promise<string>} The presigned URL
 */
export async function generatePresignedUrl(fileKey, expiresIn = 3600) {
  if (!fileKey) return null;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  // URL valid for 1 hour by default
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export default s3Client;
