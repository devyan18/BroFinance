/**
 * Common types and interfaces used across the application
 */

import { Request } from 'express';

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: ValidationError[];
}

/**
 * Validation error format
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT payload
 */
export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with user info
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    accessToken?: string;
  };
}

/**
 * Provider types for authentication
 */
export type Provider = 'local' | 'google' | 'github';

/**
 * User without sensitive data
 */
export interface UserResponse {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  provider: Provider[];
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auth response
 */
export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

