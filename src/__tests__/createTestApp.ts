import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authRouter } from '../modules/auth/auth.routes.ts';
import { comprasRouter } from '../modules/compras/compras.routes.ts';
import { paymentsRouter } from '../modules/payments/payments.routes.ts';
import { friendsRouter } from '../modules/friends/friends.routes.ts';
import { asyncHandler, errorHandler, notFoundHandler } from '../middlewares/errorHandler.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { getUserPublicController } from '../modules/auth/auth.controllers.ts';

export function createTestApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
      credentials: true,
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/auth/profile/:id', authenticate, asyncHandler(getUserPublicController));
  app.use('/api/v1/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use('/api/v1', authRouter);
  app.use('/api/v1', comprasRouter);
  app.use('/api/v1', paymentsRouter);
  app.use('/api/v1', friendsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
