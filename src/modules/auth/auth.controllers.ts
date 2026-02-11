/**
 * Authentication controllers
 * Handles HTTP requests and responses for authentication endpoints
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { signInService, signOutService, signUpService } from './auth.services.ts';
import { googleAuthService } from './auth.google.service.ts';
import { sendSuccess, sendError } from '../../utils/response.ts';
import { AuthenticatedRequest } from '../../types/index.ts';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../utils/errors.ts';

/**
 * Sign in or sign up with Google
 * @route POST /api/v1/auth/google/callback
 */
export const googleAuthController = async (req: Request, res: Response): Promise<void> => {
  const { token, credential, idToken, code } = req.body;
  const googleToken = token || credential || idToken;

  if (code) {
    const result = await googleAuthService(code, true); // Use Authorization Code flow
    sendSuccess(res, result, 'Authenticated with Google successfully');
    return;
  }

  if (googleToken) {
    const result = await googleAuthService(googleToken, false); // Use ID Token flow
    sendSuccess(res, result, 'Authenticated with Google successfully');
    return;
  }

  throw new BadRequestError('Google token/code is missing');
};

/**
 * Sign up a new user with local authentication
 * @route POST /api/v1/auth/local/sign-up
 */
export const signUpController = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  const result = await signUpService(username, email, password);

  sendSuccess(res, result, 'User registered successfully', StatusCodes.CREATED);
};

/**
 * Sign in an existing user with local authentication
 * @route POST /api/v1/auth/local/sign-in
 */
export const signInController = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const result = await signInService(email, password);

  sendSuccess(res, result, 'Signed in successfully');
};

/**
 * Sign out the current user
 * @route POST /api/v1/auth/sign-out
 */
export const signOutController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const refreshToken = req.headers['x-refresh-token'];

  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token is required');
  }

  const token = String(refreshToken).split(' ')[1];
  await signOutService(token);

  sendSuccess(res, null, 'Signed out successfully');
};

/**
 * Get current authenticated user
 * @route GET /api/v1/auth/me
 */
export const getMeController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const user = await UsuarioModel.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  sendSuccess(res, { user });
};

/**
 * Refresh access token
 * @route POST /api/v1/auth/refresh
 */
export const refreshTokenController = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.headers['x-refresh-token'];

  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token is required');
  }

  const token = String(refreshToken).split(' ')[1];
  const { refreshTokenService } = await import('./auth.services.ts');
  const newAccessToken = await refreshTokenService(token);

  sendSuccess(res, { accessToken: newAccessToken }, 'Token refreshed successfully');
};

