import env from 'env-var';

export const envConfig = {
  PORT: env.get('PORT').default('4000').asPortNumber(),
  MONGODB_URI: env.get('MONGODB_URI').required().asString(),
  JWT_SECRET: env.get('JWT_SECRET').required().asString(),
};
