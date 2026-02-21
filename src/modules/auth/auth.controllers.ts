/**
 * Authentication controllers
 * Handles HTTP requests and responses for authentication endpoints
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { signInService, signOutService, signUpService, updateProfileService, setPasswordService } from './auth.services.ts';
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
  const { identifier, password } = req.body;

  const result = await signInService(identifier, password);

  sendSuccess(res, result, 'Signed in successfully');
};

/**
 * Complete Google user setup: set username + password
 * @route PATCH /api/v1/auth/set-password
 */
export const setPasswordController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  const { username, password } = req.body;
  const user = await setPasswordService(userId, username, password);

  sendSuccess(res, { user }, 'Contraseña configurada correctamente');
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

  const user = await UsuarioModel.findById(userId).select('-password');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  sendSuccess(res, { user: user.toJSON() });
};

/**
 * Update current user profile (username, cbu)
 * @route PATCH /api/v1/auth/profile
 */
export const updateProfileController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { username, cbu, avatarUrl, showCbu, showEmail } = req.body;
  const user = await updateProfileService(userId, { username, cbu, avatarUrl, showCbu, showEmail });
  sendSuccess(res, { user }, 'Perfil actualizado correctamente');
};

/**
 * Upload avatar image
 * @route POST /api/v1/auth/avatar
 */
export const uploadAvatarController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const file = req.file;
  if (!file) {
    throw new BadRequestError('No se envió ninguna imagen');
  }

  const relativePath = `avatars/${file.filename}`;
  const user = await updateProfileService(userId, { avatarUrl: relativePath });
  sendSuccess(res, { user, avatarUrl: relativePath }, 'Avatar actualizado');
};

/**
 * Get public profile of another user (for viewing transactions)
 * @route GET /api/v1/auth/profile/:id
 */
export const getUserPublicController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const myUserId = req.user?.userId;
  if (!myUserId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const user = await UsuarioModel.findById(id).select('-password');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const u = user.toObject();
  const showCbu = (u as any).showCbu !== false;
  const showEmail = (u as any).showEmail === true;

  sendSuccess(res, {
    user: {
      _id: u._id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      cbu: showCbu ? u.cbu : undefined,
      email: showEmail ? u.email : undefined,
    },
  });
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

