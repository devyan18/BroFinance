import { UsuarioModel } from '../../modules/usuarios/usuario.model.ts';
import { generateAuthTokens } from '../../modules/auth/auth.services.ts';

export interface TestUser {
  _id: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

let userCounter = 0;

export async function createTestUser(overrides: Partial<{
  username: string;
  email: string;
  password: string;
  needsPasswordSetup: boolean;
  cbu: string;
  provider: string[];
}> = {}): Promise<TestUser> {
  userCounter++;
  const unique = `${Date.now()}_${userCounter}`;
  const user = await UsuarioModel.create({
    username: overrides.username ?? `testuser_${unique}`,
    email: overrides.email ?? `testuser_${unique}@example.com`,
    password: overrides.password ?? 'password123',
    needsPasswordSetup: overrides.needsPasswordSetup ?? false,
    ...(overrides.cbu ? { cbu: overrides.cbu } : {}),
    ...(overrides.provider ? { provider: overrides.provider } : {}),
  });

  const { accessToken, refreshToken } = await generateAuthTokens(user._id.toString());

  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    accessToken,
    refreshToken,
  };
}

export function authHeaders(user: TestUser) {
  return {
    Authorization: `Bearer ${user.accessToken}`,
    'x-refresh-token': `Bearer ${user.refreshToken}`,
  };
}
