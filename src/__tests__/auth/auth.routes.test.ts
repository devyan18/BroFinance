import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../createTestApp.ts';
import { createTestUser, authHeaders } from '../helpers/auth.helpers.ts';
import { UsuarioModel } from '../../modules/usuarios/usuario.model.ts';
import { hash } from 'bcrypt';
import { ResetTokenModel } from '../../modules/auth/resetToken.model.ts';

vi.mock('../../utils/email.service', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const app = createTestApp();
const BASE = '/api/v1/auth';

describe('POST /auth/local/sign-up', () => {
  it('creates a new user and returns 201 with tokens', async () => {
    const res = await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'brandnew',
      email: 'brandnew@example.com',
      password: 'pass12345',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('brandnew@example.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'first',
      email: 'dup@example.com',
      password: 'pass12345',
    });
    const res = await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'second',
      email: 'dup@example.com',
      password: 'pass12345',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post(`${BASE}/local/sign-up`).send({
      email: 'incomplete@example.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'badmail',
      email: 'not-an-email',
      password: 'pass12345',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'shortpass',
      email: 'short@example.com',
      password: '123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/local/sign-in', () => {
  it('signs in with valid credentials and returns tokens', async () => {
    await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'signinuser',
      email: 'signin@example.com',
      password: 'mypassword',
    });
    const res = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: 'signin@example.com',
      password: 'mypassword',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('signs in with username as identifier', async () => {
    await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'usernamelogin',
      email: 'usernamelogin@example.com',
      password: 'mypassword',
    });
    const res = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: 'usernamelogin',
      password: 'mypassword',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 for wrong password', async () => {
    await request(app).post(`${BASE}/local/sign-up`).send({
      username: 'wrongpassuser',
      email: 'wrongpass@example.com',
      password: 'correctpassword',
    });
    const res = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: 'wrongpass@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: 'nobody@example.com',
      password: 'doesnotmatter',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing identifier', async () => {
    const res = await request(app).post(`${BASE}/local/sign-in`).send({
      password: 'somepassword',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  it('returns a new access token', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 when no refresh token provided', async () => {
    const res = await request(app).post(`${BASE}/refresh`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a blacklisted refresh token', async () => {
    const user = await createTestUser();
    await request(app)
      .post(`${BASE}/sign-out`)
      .set(authHeaders(user));

    const res = await request(app)
      .post(`${BASE}/refresh`)
      .set('x-refresh-token', `Bearer ${user.refreshToken}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/sign-out', () => {
  it('signs out successfully', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/sign-out`)
      .set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth headers', async () => {
    const res = await request(app).post(`${BASE}/sign-out`);
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .get(`${BASE}/me`)
      .set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 401 without auth headers', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/profile/:id', () => {
  it('returns public profile of another user', async () => {
    const viewer = await createTestUser();
    const target = await createTestUser({ cbu: '1234567890123456789012' });

    const res = await request(app)
      .get(`/api/v1/auth/profile/${target._id}`)
      .set(authHeaders(viewer));
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(target.username);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    const { Types } = await import('mongoose');
    const viewer = await createTestUser();
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/auth/profile/${fakeId}`)
      .set(authHeaders(viewer));
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth headers', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`/api/v1/auth/profile/${user._id}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /auth/profile', () => {
  it('updates username', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .patch(`${BASE}/profile`)
      .set(authHeaders(user))
      .send({ username: 'updatedname' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('updatedname');
  });

  it('updates CBU', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .patch(`${BASE}/profile`)
      .set(authHeaders(user))
      .send({ cbu: '1234567890123456789012' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.cbu).toBe('1234567890123456789012');
  });

  it('updates visibility flags', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .patch(`${BASE}/profile`)
      .set(authHeaders(user))
      .send({ showCbu: false, showEmail: true });
    expect(res.status).toBe(200);
    expect(res.body.data.user.showCbu).toBe(false);
    expect(res.body.data.user.showEmail).toBe(true);
  });

  it('returns 400 for invalid CBU format', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .patch(`${BASE}/profile`)
      .set(authHeaders(user))
      .send({ cbu: 'notnumeric' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`${BASE}/profile`).send({ username: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /auth/set-password', () => {
  it('sets password for a Google user', async () => {
    const user = await createTestUser({ needsPasswordSetup: true });
    const res = await request(app)
      .patch(`${BASE}/set-password`)
      .set(authHeaders(user))
      .send({ username: 'newusername', password: 'newpass123', confirmPassword: 'newpass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.needsPasswordSetup).toBe(false);
  });

  it('returns 400 when passwords do not match', async () => {
    const user = await createTestUser({ needsPasswordSetup: true });
    const res = await request(app)
      .patch(`${BASE}/set-password`)
      .set(authHeaders(user))
      .send({ username: 'newusername', password: 'pass12345', confirmPassword: 'different' });
    expect(res.status).toBe(400);
  });

  it('returns 400 if password already set', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .patch(`${BASE}/set-password`)
      .set(authHeaders(user))
      .send({ username: 'newname', password: 'pass12345', confirmPassword: 'pass12345' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`${BASE}/set-password`)
      .send({ username: 'x', password: 'pass12345', confirmPassword: 'pass12345' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('changes password with valid old password', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(authHeaders(user))
      .send({ oldPassword: 'password123', newPassword: 'newpass456' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const signInRes = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: user.email,
      password: 'newpass456',
    });
    expect(signInRes.status).toBe(200);
  });

  it('returns 401 for wrong old password', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(authHeaders(user))
      .send({ oldPassword: 'wrongpassword', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(authHeaders(user))
      .send({ newPassword: 'newpass456' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .send({ oldPassword: 'old', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/forgot-password', () => {
  it('returns 200 for valid email (even if user does not exist)', async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: 'any@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app).post(`${BASE}/forgot-password`).send({});
    expect(res.status).toBe(400);
  });

  it('sends reset email when user exists', async () => {
    const user = await createTestUser();
    const { sendPasswordResetEmail } = await import('../../utils/email.service.ts');
    vi.mocked(sendPasswordResetEmail).mockClear();
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: user.email });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      user.username,
      expect.stringContaining('/reset-password?token='),
    );
  });
});

describe('POST /auth/reset-password', () => {
  it('resets password with valid token', async () => {
    const user = await createTestUser();
    const rawToken = 'testrawtoken123';
    const hashedToken = await hash(rawToken, 8);
    await ResetTokenModel.create({
      userId: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ userId: user._id, token: rawToken, newPassword: 'brandnewpass' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const signInRes = await request(app).post(`${BASE}/local/sign-in`).send({
      identifier: user.email,
      password: 'brandnewpass',
    });
    expect(signInRes.status).toBe(200);
  });

  it('returns 400 for invalid token', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ userId: user._id, token: 'invalidtoken', newPassword: 'newpass456' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ userId: '123', token: 'abc' });
    expect(res.status).toBe(400);
  });
});

describe('404 for unknown routes', () => {
  it('returns 404 for unknown endpoint', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
