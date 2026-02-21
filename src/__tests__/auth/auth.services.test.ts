import { describe, it, expect, beforeEach } from 'vitest';
import {
  signUpService,
  signInService,
  signOutService,
  refreshTokenService,
  updateProfileService,
  setPasswordService,
  generateAuthTokens,
  verifyToken,
} from '../../modules/auth/auth.services.ts';
import { UsuarioModel } from '../../modules/usuarios/usuario.model.ts';
import { BlacklistModel } from '../../modules/auth/blacklistToken.model.ts';

function expectError(err: unknown, statusCode: number) {
  expect(err).toMatchObject({ statusCode });
}

describe('signUpService', () => {
  it('creates a new user and returns tokens', async () => {
    const result = await signUpService('newuser', 'newuser@example.com', 'password123');
    expect(result.user.username).toBe('newuser');
    expect(result.user.email).toBe('newuser@example.com');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect((result.user as any).password).toBeUndefined();
  });

  it('throws 409 if email already exists', async () => {
    await signUpService('user1', 'conflict@example.com', 'password123');
    const err = await signUpService('user2', 'conflict@example.com', 'password456').catch(e => e);
    expectError(err, 409);
  });

  it('stores a hashed password, not plaintext', async () => {
    await signUpService('hashtest', 'hash@example.com', 'mypassword');
    const user = await UsuarioModel.findOne({ email: 'hash@example.com' }).select('+password');
    expect(user?.password).not.toBe('mypassword');
    expect(user?.password).toMatch(/^\$2b\$/);
  });
});

describe('signInService', () => {
  beforeEach(async () => {
    await signUpService('loginuser', 'login@example.com', 'correctpass');
  });

  it('signs in with valid email and password', async () => {
    const result = await signInService('login@example.com', 'correctpass');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.user.email).toBe('login@example.com');
  });

  it('signs in with username instead of email', async () => {
    const result = await signInService('loginuser', 'correctpass');
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('throws 401 for wrong password', async () => {
    const err = await signInService('login@example.com', 'wrongpass').catch(e => e);
    expectError(err, 401);
  });

  it('throws 401 for non-existent user', async () => {
    const err = await signInService('nobody@example.com', 'doesnotmatter').catch(e => e);
    expectError(err, 401);
  });

  it('throws 401 with Google-related message for Google-only accounts', async () => {
    await UsuarioModel.create({
      username: 'googleuser',
      email: 'google@example.com',
      provider: ['google'],
      needsPasswordSetup: true,
    });
    const err = await signInService('google@example.com', 'anypassword').catch((e) => e);
    expectError(err, 401);
    expect(err.message).toContain('Google');
  });
});

describe('signOutService', () => {
  it('blacklists the refresh token', async () => {
    const { tokens } = await signUpService('signoutuser', 'signout@example.com', 'pass12345');
    await signOutService(tokens.refreshToken);
    const blacklisted = await BlacklistModel.findOne({ token: tokens.refreshToken });
    expect(blacklisted).not.toBeNull();
  });
});

describe('refreshTokenService', () => {
  it('returns a new access token for a valid refresh token', async () => {
    const { tokens } = await signUpService('refreshuser', 'refresh@example.com', 'pass12345');
    const newAccessToken = await refreshTokenService(tokens.refreshToken);
    expect(newAccessToken).toBeDefined();
    expect(typeof newAccessToken).toBe('string');
  });

  it('throws 401 for a blacklisted refresh token', async () => {
    const { tokens } = await signUpService('blacklisted', 'blacklisted@example.com', 'pass12345');
    await signOutService(tokens.refreshToken);
    const err = await refreshTokenService(tokens.refreshToken).catch(e => e);
    expectError(err, 401);
  });

  it('throws for an invalid token string', async () => {
    await expect(refreshTokenService('not-a-valid-token')).rejects.toBeDefined();
  });
});

describe('updateProfileService', () => {
  it('updates username', async () => {
    const user = await UsuarioModel.create({
      username: 'oldname',
      email: 'update@example.com',
      password: 'pass12345',
    });
    const updated = await updateProfileService(user._id.toString(), { username: 'newname' });
    expect(updated.username).toBe('newname');
  });

  it('updates cbu', async () => {
    const user = await UsuarioModel.create({
      username: 'cbuuser',
      email: 'cbu@example.com',
      password: 'pass12345',
    });
    const updated = await updateProfileService(user._id.toString(), { cbu: '1234567890123456789012' });
    expect((updated as any).cbu).toBe('1234567890123456789012');
  });

  it('updates visibility flags', async () => {
    const user = await UsuarioModel.create({
      username: 'visuser',
      email: 'vis@example.com',
      password: 'pass12345',
    });
    const updated = await updateProfileService(user._id.toString(), { showCbu: false, showEmail: true });
    expect((updated as any).showCbu).toBe(false);
    expect((updated as any).showEmail).toBe(true);
  });

  it('throws 404 for non-existent user', async () => {
    const { Types } = await import('mongoose');
    const fakeId = new Types.ObjectId().toString();
    const err = await updateProfileService(fakeId, { username: 'x' }).catch(e => e);
    expectError(err, 404);
  });
});

describe('setPasswordService', () => {
  it('sets username and password for Google user with needsPasswordSetup=true', async () => {
    const user = await UsuarioModel.create({
      username: 'googleonly',
      email: 'setup@example.com',
      provider: ['google'],
      needsPasswordSetup: true,
    });
    const updated = await setPasswordService(user._id.toString(), 'mynewusername', 'newpass123');
    expect(updated.username).toBe('mynewusername');
    expect((updated as any).needsPasswordSetup).toBe(false);
  });

  it('throws 400 if password is already set (needsPasswordSetup=false)', async () => {
    const user = await UsuarioModel.create({
      username: 'alreadyset',
      email: 'alreadyset@example.com',
      password: 'existing123',
      needsPasswordSetup: false,
    });
    const err = await setPasswordService(user._id.toString(), 'newname', 'newpass123').catch(e => e);
    expectError(err, 400);
  });

  it('throws 409 if username is taken by another user', async () => {
    await UsuarioModel.create({
      username: 'taken',
      email: 'taken@example.com',
      password: 'pass12345',
      needsPasswordSetup: false,
    });
    const googleUser = await UsuarioModel.create({
      username: 'googleuser2',
      email: 'googleuser2@example.com',
      provider: ['google'],
      needsPasswordSetup: true,
    });
    const err = await setPasswordService(googleUser._id.toString(), 'taken', 'newpass123').catch(e => e);
    expectError(err, 409);
  });

  it('throws 404 for non-existent user', async () => {
    const { Types } = await import('mongoose');
    const fakeId = new Types.ObjectId().toString();
    const err = await setPasswordService(fakeId, 'someuser', 'pass12345').catch(e => e);
    expectError(err, 404);
  });
});

describe('generateAuthTokens / verifyToken', () => {
  it('generates tokens that can be verified', async () => {
    const { accessToken, refreshToken } = await generateAuthTokens('507f1f77bcf86cd799439011');
    const accessPayload = await verifyToken(accessToken);
    const refreshPayload = await verifyToken(refreshToken);
    expect(accessPayload.userId).toBe('507f1f77bcf86cd799439011');
    expect(refreshPayload.userId).toBe('507f1f77bcf86cd799439011');
  });

  it('throws 401 for invalid token', async () => {
    const err = await verifyToken('invalid-token').catch(e => e);
    expectError(err, 401);
  });
});
