// src/types/express.d.ts
import type { Usuario } from '../src/modules/usuarios/usuario.model';

declare global {
	namespace Express {
		interface Request {
			/**
			 * Usuario autenticado proveniente de la base de datos local.
			 * Se adjunta por loadUserFromDB middleware.
			 */
			user?: Usuario;

			/**
			 * Clerk ID del usuario autenticado (del token verificado por Clerk).
			 */
			clerkId?: string;
		}
	}
}
