/**
 * Authentication controllers
 * Handles HTTP requests and responses for authentication endpoints
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { getSettings, updateSettings } from '../usuarios/user-settings.service.ts';
import { signInService, signOutService, signUpService, updateProfileService, setPasswordService, changePasswordService, forgotPasswordService, resetPasswordService } from './auth.services.ts';
import { googleAuthService } from './auth.google.service.ts';
import { sendSuccess, sendError } from '../../utils/response.ts';
import { AuthenticatedRequest } from '../../types/index.ts';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../utils/errors.ts';
import { uploadAvatarToCloudinary } from '../../utils/cloudinary.ts';

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

  const settings = await getSettings(userId);
  const userJson = user.toJSON() as Record<string, unknown>;
  Object.assign(userJson, settings);
  sendSuccess(res, { user: userJson });
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

  const { username, cbu, avatarUrl, showCbu, showEmail, notifyNewChargesEmail, notifyNewChargesPush } = req.body;
  const user = await updateProfileService(userId, { username, cbu, avatarUrl, showCbu, showEmail });
  const settingsUpdates: { notifyNewChargesEmail?: boolean; notifyNewChargesPush?: boolean } = {};
  if (notifyNewChargesEmail !== undefined) settingsUpdates.notifyNewChargesEmail = notifyNewChargesEmail;
  if (notifyNewChargesPush !== undefined) settingsUpdates.notifyNewChargesPush = notifyNewChargesPush;
  const settings = Object.keys(settingsUpdates).length > 0 ? await updateSettings(userId, settingsUpdates) : await getSettings(userId);
  const userJson = user as Record<string, unknown>;
  Object.assign(userJson, settings);
  sendSuccess(res, { user: userJson }, 'Perfil actualizado correctamente');
};

/**
 * Upload avatar image
 * @route POST /api/v1/auth/avatar
 */
export const uploadAvatarController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');

  const file = req.file;
  if (!file) throw new BadRequestError('No se envió ninguna imagen');

  const avatarUrl = await uploadAvatarToCloudinary(file.buffer, userId);
  const user = await updateProfileService(userId, { avatarUrl });
  sendSuccess(res, { user, avatarUrl }, 'Avatar actualizado');
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
 * Register or update Expo push token
 * @route POST /api/v1/auth/push-token
 */
export const savePushTokenController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('User not authenticated');
  const { pushToken } = req.body;
  if (!pushToken) throw new BadRequestError('pushToken es requerido');
  await UsuarioModel.findByIdAndUpdate(req.user.userId, { pushToken });
  sendSuccess(res, null, 'Push token guardado');
};

/**
 * Change password with current password
 * @route POST /api/v1/auth/change-password
 */
export const changePasswordController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('User not authenticated');
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) throw new BadRequestError('oldPassword y newPassword son requeridos');
  if (newPassword.length < 6) throw new BadRequestError('La nueva contraseña debe tener al menos 6 caracteres');
  await changePasswordService(req.user.userId, oldPassword, newPassword);
  sendSuccess(res, null, 'Contraseña actualizada correctamente');
};

/**
 * Request password reset email
 * @route POST /api/v1/auth/forgot-password
 */
export const forgotPasswordController = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email) throw new BadRequestError('El email es requerido');
  await forgotPasswordService(email);
  // Siempre devolver éxito para evitar enumeración de emails
  sendSuccess(res, null, 'Si el email existe, recibirás un enlace para restablecer tu contraseña');
};

/**
 * Reset password using token from email
 * @route POST /api/v1/auth/reset-password
 */
export const resetPasswordController = async (req: Request, res: Response): Promise<void> => {
  const { userId, token, newPassword } = req.body;
  if (!userId || !token || !newPassword) throw new BadRequestError('userId, token y newPassword son requeridos');
  if (newPassword.length < 6) throw new BadRequestError('La contraseña debe tener al menos 6 caracteres');
  await resetPasswordService(userId, token, newPassword);
  sendSuccess(res, null, 'Contraseña restablecida correctamente');
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

