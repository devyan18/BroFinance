/**
 * Global error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.ts';
import { sendError } from '../utils/response.ts';

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // Log error for debugging
  console.error('Error:', err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.issues.map(issue => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));

    sendError(res, 'Validation failed', 400, errors);
    return;
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Handle Mongoose duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    sendError(res, `${field} already exists`, 409);
    return;
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    sendError(res, 'Validation failed', 400);
    return;
  }

  // Handle Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, 'Invalid ID format', 400);
    return;
  }

  // Handle Multer errors (file upload)
  if (err.name === 'MulterError') {
    const msg =
      (err as any).code === 'LIMIT_FILE_SIZE'
        ? 'La imagen no puede superar 2MB'
        : (err as any).code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Campo de archivo no válido (use "avatar")'
          : 'Error al subir la imagen';
    sendError(res, msg, 400);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401);
    return;
  }

  // Default to 500 server error
  sendError(res, 'Internal Server Error', 500);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
};

