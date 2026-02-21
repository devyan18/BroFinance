/**
 * Cloudinary upload utility for avatar images.
 * Uploading replaces the previous avatar for the same user (same public_id + overwrite).
 */

import { v2 as cloudinary } from 'cloudinary';
import { envConfig } from '../settings/environments.ts';
import { AppError } from './errors.ts';

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = envConfig;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError(
      'Cloudinary no está configurado. Definí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
      500,
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  configured = true;
}

/**
 * Uploads an avatar buffer to Cloudinary.
 * Uses the userId as public_id so each user has exactly one avatar (auto-replaced on update).
 * Returns the secure HTTPS URL.
 */
export async function uploadAvatarToCloudinary(buffer: Buffer, userId: string): Promise<string> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'avatars',
        public_id: `user_${userId}`,
        overwrite: true,
        invalidate: true,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });
}
