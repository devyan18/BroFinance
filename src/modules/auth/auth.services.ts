/**
 * Authentication services
 * Contains business logic for authentication operations
 */

import { BlacklistModel } from './blacklistToken.model.ts';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { envConfig } from '../../settings/environments.ts';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ConflictError, InternalServerError } from '../../utils/errors.ts';
import { JwtPayload, AuthTokens, AuthResponse, UserResponse } from '../../types/index.ts';

const timesOfExpiration = {
  accessToken: 60 * 15, // 15 minutes
  refreshToken: 60 * 60 * 24 * 30, // 30 days
};

/**
 * Create a JWT token with the given payload
 */
const createToken = async (payload: JwtPayload, expiresIn: number): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn }, (err, token) => {
      if (err) reject(new InternalServerError('Failed to create token'));
      else resolve(token as string);
    });
  });
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = async (token: string): Promise<JwtPayload> => {
  return new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(token, envConfig.JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          reject(new UnauthorizedError('Token has expired'));
        } else {
          reject(new UnauthorizedError('Invalid token'));
        }
      } else {
        resolve(decoded as JwtPayload);
      }
    });
  });
};

/**
 * Generate both access and refresh tokens for a user
 */
export const generateAuthTokens = async (userId: string): Promise<AuthTokens> => {
  const accessToken = await createToken({ userId }, timesOfExpiration.accessToken);
  const refreshToken = await createToken({ userId }, timesOfExpiration.refreshToken);
  return { accessToken, refreshToken };
};

/**
 * Sign in a user with email and password
 */
export const signInService = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await UsuarioModel.findOne({ email }, '+password');

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const { password: userPassword, ...userWithoutPassword } = user.toJSON();

  const isPasswordValid = await compare(password, userPassword || '');

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = await generateAuthTokens(user._id.toString());

  return {
    user: userWithoutPassword as any as UserResponse,
    tokens,
  };
};

/**
 * Register a new user with username, email and password
 */
export const signUpService = async (
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const existingUser = await UsuarioModel.findOne({ email });

  if (existingUser) {
    throw new ConflictError('Email already in use');
  }

  const newUser = new UsuarioModel({ username, email, password });
  await newUser.save();

  const { password: _, ...userWithoutPassword } = newUser.toJSON();
  const tokens = await generateAuthTokens(newUser._id.toString());

  return {
    user: userWithoutPassword as any as UserResponse,
    tokens,
  };
};

/**
 * Sign out a user by blacklisting their refresh token
 */
export const signOutService = async (refreshToken: string): Promise<void> => {
  const { userId } = await verifyToken(refreshToken);

  const blacklistedToken = new BlacklistModel({
    token: refreshToken,
    user: userId,
  });

  await blacklistedToken.save();
};

/**
 * Refresh an access token using a valid refresh token
 */
export const refreshTokenService = async (refreshToken: string): Promise<string> => {
  // Check if token is blacklisted
  const isBlacklisted = await BlacklistModel.findOne({ token: refreshToken });

  if (isBlacklisted) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  // Verify and decode the refresh token
  const { userId } = await verifyToken(refreshToken);

  // Create new access token
  return await createToken({ userId }, timesOfExpiration.accessToken);
};

/**
 * Create a new access token from a refresh token
 */
export const createAccessTokenService = async (refreshToken: string): Promise<string> => {
  const { userId } = await verifyToken(refreshToken);
  return await createToken({ userId }, timesOfExpiration.accessToken);
};

