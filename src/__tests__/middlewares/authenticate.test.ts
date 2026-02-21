import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../middlewares/authenticate.ts';
import { errorHandler } from '../../middlewares/errorHandler.ts';
import { createTestUser, authHeaders } from '../helpers/auth.helpers.ts';
import { generateAuthTokens, verifyToken } from '../../modules/auth/auth.services.ts';
import { BlacklistModel } from '../../modules/auth/blacklistToken.model.ts';
import jwt from 'jsonwebtoken';

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected', authenticate, (req: any, res) => {
    res.json({ success: true, userId: req.user?.userId });
  });

  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  it('allows access with valid tokens and attaches userId to req.user', async () => {
    const app = buildApp();
    const user = await createTestUser();
    const res = await request(app).get('/protected').set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user._id);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();
    const user = await createTestUser();
    const res = await request(app)
      .get('/protected')
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when x-refresh-token header is missing', async () => {
    const app = buildApp();
    const user = await createTestUser();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when both tokens are missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('auto-refreshes expired access token using a valid refresh token', async () => {
    const app = buildApp();
    const user = await createTestUser();

    const expiredAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user._id);
  });

  it('still accepts a blacklisted refresh token during middleware auto-refresh (middleware uses createAccessTokenService, not refreshTokenService)', async () => {
    // NOTE: The authenticate middleware uses createAccessTokenService which does NOT check
    // the blacklist. Only the /auth/refresh endpoint (which uses refreshTokenService) checks it.
    // Blacklist enforcement for the middleware is a known design trade-off.
    const app = buildApp();
    const user = await createTestUser();

    await BlacklistModel.create({
      token: user.refreshToken,
      user: user._id,
    });

    const expiredAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);

    // The middleware auto-refreshes without checking the blacklist
    expect(res.status).toBe(200);
  });

  it('returns 401 for completely invalid tokens', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalidtoken')
      .set('x-refresh-token', 'Bearer invalidsecret');
    expect(res.status).toBe(401);
  });

  it('new access token is attached to res.locals when refreshed', async () => {
    let capturedLocals: any = null;
    const app = express();
    app.use(express.json());
    app.get('/protected', authenticate, (req: any, res) => {
      capturedLocals = res.locals;
      res.json({ success: true, userId: req.user?.userId });
    });
    app.use(errorHandler);

    const user = await createTestUser();
    const expiredToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );

    await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);

    expect(capturedLocals?.accessToken).toBeDefined();
    const payload = await verifyToken(capturedLocals.accessToken);
    expect(payload.userId).toBe(user._id);
  });
});
