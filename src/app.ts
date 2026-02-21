/**
 * Main application file
 * Configures Express server with middleware and routes
 */

import express from 'express';
import path from 'path';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import expressRateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { envConfig } from './settings/environments.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { comprasRouter } from './modules/compras/compras.routes.ts';
import { paymentsRouter } from './modules/payments/payments.routes.ts';
import { friendsRouter } from './modules/friends/friends.routes.ts';
import { connectDb } from './settings/connectDb.ts';
import { asyncHandler, errorHandler, notFoundHandler } from './middlewares/errorHandler.ts';
import { authenticate } from './middlewares/authenticate.ts';
import { getUserPublicController } from './modules/auth/auth.controllers.ts';

const app = express();

// Security middleware (allow cross-origin images for avatars)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }),
);

// Rate limiting - 500 requests per 15 minutes per IP
app.use(
  expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' },
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: envConfig.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
    credentials: true,
  }),
);

// Logging middleware
if (envConfig.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Get public user profile (Express 5 router param matching workaround)
app.get('/api/v1/auth/profile/:id', authenticate, asyncHandler(getUserPublicController));

// Serve uploaded avatars
app.use('/api/v1/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API v1 routes
app.use('/api/v1', authRouter);
app.use('/api/v1', comprasRouter);
app.use('/api/v1', paymentsRouter);
app.use('/api/v1', friendsRouter);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server
app.listen(envConfig.PORT, async () => {
  console.log(`🚀 Server running on port ${envConfig.PORT}`);
  console.log(`📝 Environment: ${envConfig.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${envConfig.PORT}/api/v1`);

  try {
    await connectDb(envConfig.MONGODB_URI);
    const { seedTiposCompra, migrateComprasEstado } = await import('./modules/compras/compras.seed.ts');
    await seedTiposCompra();
    await migrateComprasEstado();
    console.log('📦 Tipos de compra inicializados');
  } catch (error) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }
});

export default app;

