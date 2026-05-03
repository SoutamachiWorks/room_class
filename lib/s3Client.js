import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from './fileValidation';

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
  const extension = fileName.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(`Format file .${extension} tidak diizinkan oleh sistem pangkalan.`);
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Ukuran file "${fileName}" ( ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB ) melebihi batas sistem 50MB.`);
  }

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
 * @param {string} originalName - The original name to show during download
 * @param {number} expiresIn - Expiry time in seconds (default 3600 = 1 hour)
 * @returns {Promise<string>} The presigned URL
 */
export async function generatePresignedUrl(fileKey, originalName, expiresIn = 3600) {
  if (!fileKey) return null;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    // Memaksa browser mendownload dengan nama asli, bukan nama unik di R2
    ResponseContentDisposition: originalName 
      ? `attachment; filename="${originalName.replace(/"/g, '')}"` 
      : 'attachment',
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (err) {
    console.error('Presigned URL Generation Error:', err);
    return null;
  }
}

/**
 * Batch delete multiple files from Cloudflare R2
 * @param {string[]} fileKeys - Array of file keys to delete
 */
export async function batchDeleteFromR2(fileKeys) {
  if (!fileKeys || fileKeys.length === 0) return;

  const objectsToDelete = fileKeys.map(key => ({ Key: key }));

  const command = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: objectsToDelete,
      Quiet: true, // Prevents returning a list of successfully deleted objects to save bandwidth
    },
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error(`Failed to batch delete files from R2:`, error);
    throw error;
  }
}

export default s3Client;
