/**
 * Authentication middleware
 * Validates JWT tokens and attaches user info to request
 */

import { Response, NextFunction } from 'express';
import { verifyToken, createAccessTokenService } from '../modules/auth/auth.services.ts';
import { UnauthorizedError } from '../utils/errors.ts';
import { AuthenticatedRequest } from '../types/index.ts';

/**
 * Middleware to validate access and refresh tokens
 * Automatically refreshes access token if expired
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract tokens from headers
    const authHeader = req.headers['authorization'];
    const refreshHeader = req.headers['x-refresh-token'];

    let accessToken = authHeader ? String(authHeader).split(' ')[1] : null;
    const refreshToken = refreshHeader ? String(refreshHeader).split(' ')[1] : null;

    // Both tokens are required
    if (!accessToken || !refreshToken) {
      throw new UnauthorizedError('Access token and refresh token are required');
    }

    // Try to verify access token
    let userId: string | null = null;

    try {
      const payload = await verifyToken(accessToken);
      userId = payload.userId;
    } catch (error) {
      // Access token is invalid or expired, try to refresh it
      try {
        accessToken = await createAccessTokenService(refreshToken);
        const payload = await verifyToken(accessToken);
        userId = payload.userId;

        // Attach new access token to response locals for client to update
        res.locals.accessToken = accessToken;
      } catch (refreshError) {
        throw new UnauthorizedError('Invalid or expired tokens');
      }
    }

    if (!userId) {
      throw new UnauthorizedError('Invalid token payload');
    }

    // Attach user info to request
    req.user = {
      userId,
      accessToken,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is valid, but doesn't fail if not
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader ? String(authHeader).split(' ')[1] : null;

    if (accessToken) {
      try {
        const payload = await verifyToken(accessToken);
        req.user = {
          userId: payload.userId,
          accessToken,
        };
      } catch (error) {
        // Token is invalid, but we don't fail - just continue without user
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

