/**
 * Multer configuration for avatar uploads
 */

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { BadRequestError } from '../utils/errors.ts';
import type { AuthenticatedRequest } from '../types/index.ts';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (e: Error | null, dest: string) => void) =>
    cb(null, UPLOADS_DIR),
  filename: (req: Express.Request, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return cb(new Error('User not authenticated'), '');
    const ext = path.extname(file.originalname) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext.toLowerCase()) ? ext : '.jpg';
    const filename = `${userId}-${Date.now()}${safeExt}`;
    cb(null, filename);
  },
});

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new BadRequestError('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)') as unknown as Error);
      return;
    }
    cb(null, true);
  },
}).single('avatar');
