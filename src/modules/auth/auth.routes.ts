/**
 * Authentication routes
 * Defines API endpoints for authentication
 */

import { Router } from 'express';
import {
  signInController,
  signUpController,
  signOutController,
  getMeController,
  updateProfileController,
  uploadAvatarController,
  refreshTokenController,
  googleAuthController,
  setPasswordController,
} from './auth.controllers.ts';
import { validateData } from '../middlewares/validateRoute.ts';
import {
  signInLocalSchema,
  signUpLocalSchema,
  googleAuthSchema,
  updateProfileSchema,
  setPasswordSchema,
} from './auth.route.validations.ts';
import { asyncHandler } from '../../middlewares/errorHandler.ts';
import { authenticate } from '../../middlewares/authenticate.ts';
import { uploadAvatar } from '../../middlewares/uploadAvatar.ts';

const authRouter = Router();

/**
 * @route   POST /api/v1/auth/google/callback
 * @desc    Sign in or sign up with Google
 * @access  Public
 */
authRouter.post(
  '/auth/google/callback',
  validateData(googleAuthSchema),
  asyncHandler(googleAuthController),
);

/**
 * @route   POST /api/v1/auth/local/sign-up
 * @desc    Register a new user with local authentication
 * @access  Public
 */
authRouter.post(
  '/auth/local/sign-up',
  validateData(signUpLocalSchema),
  asyncHandler(signUpController),
);

/**
 * @route   POST /api/v1/auth/local/sign-in
 * @desc    Sign in with email and password
 * @access  Public
 */
authRouter.post(
  '/auth/local/sign-in',
  validateData(signInLocalSchema),
  asyncHandler(signInController),
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
authRouter.post('/auth/refresh', asyncHandler(refreshTokenController));

/**
 * @route   POST /api/v1/auth/sign-out
 * @desc    Sign out and blacklist refresh token
 * @access  Private
 */
authRouter.post('/auth/sign-out', authenticate, asyncHandler(signOutController));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
authRouter.get('/auth/me', authenticate, asyncHandler(getMeController));

/**
 * @route   PATCH /api/v1/auth/profile
 * @desc    Update profile (username, cbu)
 * @access  Private
 */
authRouter.patch(
  '/auth/profile',
  authenticate,
  validateData(updateProfileSchema),
  asyncHandler(updateProfileController),
);

/**
 * @route   PATCH /api/v1/auth/set-password
 * @desc    Set username + password for Google-registered users
 * @access  Private
 */
authRouter.patch(
  '/auth/set-password',
  authenticate,
  validateData(setPasswordSchema),
  asyncHandler(setPasswordController),
);

/**
 * @route   POST /api/v1/auth/avatar
 * @desc    Upload avatar image
 * @access  Private
 */
authRouter.post(
  '/auth/avatar',
  authenticate,
  (req, res, next) => {
    uploadAvatar(req, res, (err: unknown) => (err ? next(err) : next()));
  },
  asyncHandler(uploadAvatarController),
);

export { authRouter };

