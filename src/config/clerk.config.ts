// src/config/clerk.config.ts
import { createClerkClient } from '@clerk/backend';
import { envConfig } from '../settings/environments';

/**
 * Cliente de Clerk configurado usando createClerkClient del paquete @clerk/backend.
 * Este cliente se utiliza para operaciones como obtener información de usuarios,
 * actualizar perfiles, y otras operaciones administrativas.
 */
export const clerkClient = createClerkClient({
	publishableKey: envConfig.CLERK_PUBLISHABLE_KEY,
	secretKey: envConfig.CLERK_SECRET_KEY,
	apiUrl: 'https://api.clerk.com',
});

/**
 * Tipos derivados del SDK de Clerk para uso en TypeScript.
 * ClerkUser representa la estructura completa de un usuario en Clerk.
 */
export type ClerkUser = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

/**
 * Tipo para el payload del token decodificado.
 * Contiene la información del usuario extraída del JWT.
 */
export type ClerkAuthState = {
	userId: string | null;
	sessionId: string | null;
	claims: Record<string, unknown> | null;
};
