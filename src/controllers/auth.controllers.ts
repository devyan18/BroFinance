// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { clerkClient, ClerkUser } from '../config/clerk.config';
import { UsuarioModel } from '../modules/usuarios/usuario.model';

/**
 * Interfaz para datos del usuario a sincronizar
 */
interface SyncUserData {
	clerkId: string;
	email: string;
	username?: string;
	avatarUrl?: string;
}

/**
 * Controlador de autenticación y sincronización de usuarios.
 * Maneja la sincronización entre Clerk y la base de datos local.
 */
export class AuthController {
	/**
	 * Endpoint de sincronización de usuario.
	 * POST /api/auth/sync
	 *
	 * Este endpoint debe ser llamado por el frontend inmediatamente
	 * después de que el usuario inicie sesión con Clerk.
	 *
	 * El middleware clerkMiddleware ya verificó el token y populó req.auth.
	 *
	 * Response:
	 * - 200: Usuario sincronizado exitosamente
	 * - 401: No autorizado (token inválido)
	 * - 500: Error del servidor
	 */
	static async syncUser(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.auth;

			if (!userId) {
				res.status(401).json({
					success: false,
					error: 'Usuario no autenticado',
					code: 'NOT_AUTHENTICATED',
				});
				return;
			}

			// Obtener datos actualizados de Clerk
			const clerkUser: ClerkUser = await clerkClient.users.getUser(userId);

			// Extraer información relevante del usuario de Clerk
			const syncData: SyncUserData = {
				clerkId: userId,
				email: clerkUser.emailAddresses[0]?.emailAddress || '',
				username: clerkUser.username || clerkUser.firstName || undefined,
				avatarUrl: clerkUser.imageUrl || undefined,
			};

			// Realizar upsert preservando el balance existente
			const usuario = await UsuarioModel.findOneAndUpdate(
				{ clerkId: userId },
				{
					$set: {
						email: syncData.email,
						username: syncData.username,
						avatarUrl: syncData.avatarUrl,
					},
					$addToSet: {
						provider: 'local',
					},
				},
				{
					upsert: true,
					new: true,
					setDefaultsOnInsert: true,
				},
			);

			res.status(200).json({
				success: true,
				data: {
					id: usuario._id,
					clerkId: usuario.clerkId,
					username: usuario.username,
					email: usuario.email,
					avatarUrl: usuario.avatarUrl,
					balance: usuario.balance,
					providers: usuario.provider,
				},
				message: 'Usuario sincronizado correctamente',
			});
		} catch (error) {
			console.error('Error en syncUser:', error);
			res.status(500).json({
				success: false,
				error: 'Error al sincronizar usuario',
				code: 'SYNC_ERROR',
			});
		}
	}

	/**
	 * Endpoint para obtener el perfil del usuario actual.
	 * GET /api/auth/me
	 *
	 * Requiere autenticación (clerkMiddleware populó req.auth).
	 * Requiere que el usuario esté sincronizado en BD.
	 *
	 * Response:
	 * - 200: Datos del usuario
	 * - 401: No autorizado
	 * - 404: Usuario no sincronizado
	 */
	static async getMe(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.auth;
			const authReq = req as AuthenticatedRequest;

			if (!userId) {
				res.status(401).json({
					success: false,
					error: 'Usuario no autenticado',
					code: 'NOT_AUTHENTICATED',
				});
				return;
			}

			if (!authReq.user) {
				res.status(404).json({
					success: false,
					error: 'Usuario no encontrado en la base de datos',
					code: 'USER_NOT_FOUND',
					clerkId: userId,
					message: 'Por favor, ejecuta la sincronización primero',
				});
				return;
			}

			const usuario = authReq.user;

			res.status(200).json({
				success: true,
				data: {
					id: usuario._id,
					clerkId: usuario.clerkId,
					username: usuario.username,
					email: usuario.email,
					avatarUrl: usuario.avatarUrl,
					balance: usuario.balance,
					providers: usuario.provider,
					createdAt: usuario.createdAt,
					updatedAt: usuario.updatedAt,
				},
			});
		} catch (error) {
			console.error('Error en getMe:', error);
			res.status(500).json({
				success: false,
				error: 'Error al obtener perfil',
				code: 'PROFILE_ERROR',
			});
		}
	}

	/**
	 * Endpoint para verificar el estado de autenticación.
	 * GET /api/auth/status
	 *
	 * Útil para verificar si el token es válido sin necesidad
	 * de que el usuario esté sincronizado.
	 *
	 * Response:
	 * - 200: Autenticado (con o sin sincronización)
	 */
	static async getStatus(req: Request, res: Response): Promise<void> {
		try {
			const { userId, sessionId } = req.auth;
			const authReq = req as AuthenticatedRequest;

			res.status(200).json({
				success: true,
				authenticated: !!userId,
				synced: !!authReq.user,
				data: {
					clerkId: userId || null,
					sessionId: sessionId || null,
					hasLocalProfile: !!authReq.user,
					username: authReq.user?.username || null,
					balance: authReq.user?.balance || 0,
				},
			});
		} catch (error) {
			console.error('Error en getStatus:', error);
			res.status(500).json({
				success: false,
				error: 'Error al verificar estado',
				code: 'STATUS_ERROR',
			});
		}
	}

	/**
	 * Endpoint para obtener los roomies del usuario.
	 * GET /api/auth/roommates
	 *
	 * Requiere autenticación y sincronización.
	 */
	static async getRoommates(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.auth;
			const authReq = req as AuthenticatedRequest;

			if (!userId) {
				res.status(401).json({
					success: false,
					error: 'Usuario no autenticado',
					code: 'NOT_AUTHENTICATED',
				});
				return;
			}

			if (!authReq.user) {
				res.status(404).json({
					success: false,
					error: 'Usuario no sincronizado',
					code: 'USER_NOT_SYNCED',
				});
				return;
			}

			// Importación dinámica para evitar ciclos
			const { ComprasModel } = await import('../models/compras.model');

			// Buscar compras donde el usuario es acreedor o deudor
			const compras = await ComprasModel.find({
				$or: [{ acreedorId: authReq.user._id }, { deudorId: authReq.user._id }],
			}).populate('acreedorId deudorId');

			// Extraer IDs únicos de roomies
			const roommateIds = new Set<string>();
			compras.forEach((compra: any) => {
				const acreedorId = compra.acreedorId?._id?.toString() || compra.acreedorId?.toString();
				const deudorId = compra.deudorId?._id?.toString() || compra.deudorId?.toString();

				if (acreedorId && acreedorId !== authReq.user?._id?.toString()) {
					roommateIds.add(acreedorId);
				}
				if (deudorId && deudorId !== authReq.user?._id?.toString()) {
					roommateIds.add(deudorId);
				}
			});

			// Obtener información de los roomies
			const roomies = await UsuarioModel.find({
				_id: { $in: Array.from(roommateIds) },
			});

			res.status(200).json({
				success: true,
				data: roomies.map(rookie => ({
					id: rookie._id,
					clerkId: rookie.clerkId,
					username: rookie.username,
					avatarUrl: rookie.avatarUrl,
					balance: rookie.balance,
				})),
			});
		} catch (error) {
			console.error('Error en getRoommates:', error);
			res.status(500).json({
				success: false,
				error: 'Error al obtener roomies',
				code: 'ROOMMIES_ERROR',
			});
		}
	}
}
