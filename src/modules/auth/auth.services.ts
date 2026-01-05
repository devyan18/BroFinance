import { BlacklistModel } from './blacklistToken.model.ts';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { envConfig } from '../../settings/environments.ts';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';

const timesOfExpiration = {
  accessToken: 60 * 15, // 15 minutes
  refreshToken: 60 * 60 * 24 * 30, // 30 days
};

type UserIdPayload = {
  userId: string;
};

const createToken = async (payload: UserIdPayload, expiresIn: number) => {
  return new Promise<string>((resolve, reject) => {
    jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn }, (err, token) => {
      if (err) reject(err);
      else resolve(token as string);
    });
  });
};

export const verifyToken = async (token: string): Promise<UserIdPayload> => {
  return new Promise<UserIdPayload>((resolve, reject) => {
    jwt.verify(token, envConfig.JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded as UserIdPayload);
    });
  });
};

const generateAuthTokens = async (userId: string) => {
  const accessToken = await createToken({ userId }, timesOfExpiration.accessToken);
  const refreshToken = await createToken({ userId }, timesOfExpiration.refreshToken);
  return { accessToken, refreshToken };
};

export const signInService = async (email: string, password: string) => {
  const user = await UsuarioModel.findOne({ email }, '+password');
  if (!user) throw new Error('User not found');

  const { password: userPassword, ...userWithoutPassword } = user.toJSON();

  const isPasswordValid = await compare(password, userPassword || '');
  if (!isPasswordValid) throw new Error('Invalid password');

  const tokens = await generateAuthTokens(user._id.toString());

  return { user: userWithoutPassword, tokens };
};

export const signUpService = async (username: string, email: string, password: string) => {
  const existingUser = await UsuarioModel.findOne({ email });
  if (existingUser) throw new Error('Email already in use');

  const newUser = new UsuarioModel({ username, email, password });
  await newUser.save();

  const { password: _, ...userWithoutPassword } = newUser.toJSON();
  const tokens = await generateAuthTokens(newUser._id.toString());

  return { user: userWithoutPassword, tokens };
};

export const signOutService = async (refreshToken: string) => {
  const { userId } = await verifyToken(refreshToken);
  const blacklistedToken = new BlacklistModel({
    token: refreshToken,
    user: userId,
  });
  await blacklistedToken.save();
};

export const refreshTokenService = async (refreshToken: string) => {
  let isBlacklisted;
  try {
    isBlacklisted = await BlacklistModel.findOne({ token: refreshToken });
  } catch (error) {
    throw new Error('Error while checking blacklisted tokens');
  }

  if (isBlacklisted) {
    throw new Error('Refresh token is blacklisted');
  }

  try {
    const { userId } = await verifyToken(refreshToken);
    return await createToken({ userId }, timesOfExpiration.accessToken);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

export const createAccessTokenService = async (refreshToken: string) => {
  const { userId } = await verifyToken(refreshToken);
  return await createToken({ userId }, timesOfExpiration.accessToken);
};

