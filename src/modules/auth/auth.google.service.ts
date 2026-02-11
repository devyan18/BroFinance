/**
 * Google OAuth authentication service
 * Handles Google Sign-In token verification and user creation/login
 */

import { OAuth2Client } from 'google-auth-library';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { envConfig } from '../../settings/environments.ts';
import { UnauthorizedError, BadRequestError } from '../../utils/errors.ts';
import { AuthResponse } from '../../types/index.ts';
import { generateAuthTokens } from './auth.services.ts';

const client = new OAuth2Client(
  envConfig.GOOGLE_CLIENT_ID,
  envConfig.GOOGLE_CLIENT_SECRET,
  'postmessage',
);

/**
 * Google token payload interface
 */
interface GoogleTokenPayload {
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  sub?: string;
}

/**
 * Verify Google ID token and extract user information
 */
const verifyGoogleToken = async (token: string): Promise<GoogleTokenPayload> => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: envConfig.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedError('Invalid Google token');
    }

    return payload;
  } catch (error) {
    throw new UnauthorizedError('Failed to verify Google token');
  }
};

/**
 * Exchange Authorization Code for Tokens and get user info
 */
const getGoogleUserFromCode = async (code: string): Promise<GoogleTokenPayload> => {
  try {
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new UnauthorizedError('No ID token returned from Google');
    }

    return verifyGoogleToken(tokens.id_token);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Google verify code error:', error.message);
    }
    throw new UnauthorizedError('Failed to exchange Google code');
  }
};

/**
 * Authenticate user with Google OAuth
 * Creates new user if doesn't exist, or logs in existing user
 */
export const googleAuthService = async (
  tokenOrCode: string,
  isCode: boolean = false,
): Promise<AuthResponse> => {
  if (!tokenOrCode) {
    throw new BadRequestError('Google token/code is required');
  }

  // Verify the Google token or code
  let payload: GoogleTokenPayload;

  if (isCode) {
    payload = await getGoogleUserFromCode(tokenOrCode);
  } else {
    payload = await verifyGoogleToken(tokenOrCode);
  }

  if (!payload.email) {
    throw new UnauthorizedError('Email not provided by Google');
  }

  if (!payload.email_verified) {
    throw new UnauthorizedError('Google email not verified');
  }

  // Check if user already exists
  let user = await UsuarioModel.findOne({ email: payload.email });

  if (user) {
    // User exists - check if Google is already in providers
    if (!user.provider.includes('google')) {
      user.provider.push('google');
      await user.save();
    }

    // Update avatar if not set
    if (!user.avatarUrl && payload.picture) {
      user.avatarUrl = payload.picture;
      await user.save();
    }
  } else {
    // Create new user
    user = new UsuarioModel({
      username: payload.name || payload.email.split('@')[0],
      email: payload.email,
      avatarUrl: payload.picture,
      provider: ['google'],
      // No password for Google users
    });

    await user.save();
  }

  // Generate JWT tokens
  const tokens = await generateAuthTokens(user._id.toString());

  // Return user without password
  const userObject = user.toObject();
  const { password: _, ...userWithoutPassword } = userObject;

  return {
    user: userWithoutPassword as any,
    tokens,
  };
};

