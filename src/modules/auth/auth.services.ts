/**
 * Authentication services
 * Contains business logic for authentication operations
 */

import { BlacklistModel } from './blacklistToken.model.ts';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { envConfig } from '../../settings/environments.ts';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ConflictError, InternalServerError, NotFoundError, BadRequestError } from '../../utils/errors.ts';
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
 * Sign in a user with email OR username and password
 */
export const signInService = async (identifier: string, password: string): Promise<AuthResponse> => {
  // Find by email or username
  const user = await UsuarioModel.findOne(
    { $or: [{ email: identifier.toLowerCase() }, { username: identifier }] },
    '+password',
  );

  if (!user) {
    throw new UnauthorizedError('Invalid email/username or password');
  }

  if (!user.password) {
    throw new UnauthorizedError('Esta cuenta usa Google. Completa el registro con una contraseña para poder iniciar sesión aquí.');
  }

  const { password: userPassword, ...userWithoutPassword } = user.toJSON();

  const isPasswordValid = await compare(password, userPassword || '');

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email/username or password');
  }

  const tokens = await generateAuthTokens(user._id.toString());

  return {
    user: userWithoutPassword as any as UserResponse,
    tokens,
  };
};

/**
 * Set password for a Google user completing their local auth setup
 */
export const setPasswordService = async (
  userId: string,
  username: string,
  password: string,
): Promise<UserResponse> => {
  const user = await UsuarioModel.findById(userId, '+password');
  if (!user) throw new NotFoundError('User not found');

  if (!user.needsPasswordSetup) {
    throw new BadRequestError('La contraseña ya fue configurada');
  }

  // Check username availability (excluding current user)
  const existingUsername = await UsuarioModel.findOne({ username, _id: { $ne: userId } });
  if (existingUsername) {
    throw new ConflictError('El nombre de usuario ya está en uso');
  }

  user.username = username;
  user.password = password;
  user.needsPasswordSetup = false;
  if (!user.provider.includes('local')) {
    user.provider.push('local');
  }

  await user.save();

  const { password: _, ...userWithoutPassword } = user.toJSON();
  return userWithoutPassword as any as UserResponse;
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

/**
 * Update user profile (username, cbu, avatarUrl, visibility)
 */
export const updateProfileService = async (
  userId: string,
  updates: { username?: string; cbu?: string; avatarUrl?: string; showCbu?: boolean; showEmail?: boolean },
): Promise<UserResponse> => {
  const user = await UsuarioModel.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (updates.username !== undefined) user.username = updates.username;
  if (updates.cbu !== undefined) user.cbu = updates.cbu === '' ? undefined : updates.cbu;
  if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl === '' ? undefined : updates.avatarUrl;
  if (updates.showCbu !== undefined) user.showCbu = updates.showCbu;
  if (updates.showEmail !== undefined) user.showEmail = updates.showEmail;
  await user.save();
  const { password: _, ...userWithoutPassword } = user.toJSON();
  return userWithoutPassword as any as UserResponse;
};

