/**
 * Multer configuration for avatar uploads.
 * Uses memory storage — the file buffer is passed directly to Cloudinary.
 */

import multer, { FileFilterCallback } from 'multer';
import { BadRequestError } from '../utils/errors.ts';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new BadRequestError('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)') as unknown as Error);
      return;
    }
    cb(null, true);
  },
}).single('avatar');
