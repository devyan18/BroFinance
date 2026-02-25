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
  CLOUDINARY_CLOUD_NAME: env.get('CLOUDINARY_CLOUD_NAME').asString(),
  CLOUDINARY_API_KEY: env.get('CLOUDINARY_API_KEY').asString(),
  CLOUDINARY_API_SECRET: env.get('CLOUDINARY_API_SECRET').asString(),
  // Email (nodemailer) - optional; required for forgot-password flow
  EMAIL_HOST: env.get('EMAIL_HOST').default('').asString(),
  EMAIL_PORT: env.get('EMAIL_PORT').default('587').asPortNumber(),
  EMAIL_USER: env.get('EMAIL_USER').default('').asString(),
  EMAIL_PASS: env.get('EMAIL_PASS').default('').asString(),
  EMAIL_FROM: env.get('EMAIL_FROM').default('').asString(),
  // Frontend URL used in reset-password links — falls back to CORS_ORIGIN if empty
  FRONTEND_URL: env.get('FRONTEND_URL').default('').asString(),
};

