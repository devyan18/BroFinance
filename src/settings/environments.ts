/**
 * Environment configuration
 * Validates and exports environment variables
 */

import env from 'env-var';

export const envConfig = {
  NODE_ENV: env.get('NODE_ENV').default('development').asString(),
  PORT: env.get('PORT').default('4000').asPortNumber(),
  MONGODB_URI: env.get('MONGODB_URI').required().asString(),
  JWT_SECRET: env.get('JWT_SECRET').required().asString(),
  CORS_ORIGIN: env.get('CORS_ORIGIN').default('http://localhost:5173').asString(),
  GOOGLE_CLIENT_ID: env.get('GOOGLE_CLIENT_ID').asString(),
  GOOGLE_CLIENT_SECRET: env.get('GOOGLE_CLIENT_SECRET').asString(),
};

