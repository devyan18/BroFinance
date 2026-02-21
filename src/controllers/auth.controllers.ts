// src/controllers/auth.controller.ts
import { Response } from 'express';
import { UsuarioModel } from '../modules/usuarios/usuario.model';
import { ComprasModel } from '../modules/compras/compras.model';
import { AuthenticatedRequest } from '../types/index';

/**
 * Controlador de autenticación.
 * Usa JWT (middleware authenticate) e identifica al usuario por userId en BD.
 */
export class AuthController {
  /**
   * Endpoint para obtener el perfil del usuario actual.
   * GET /api/auth/me
   * Requiere autenticación JWT (middleware authenticate).
   */
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const usuario = await UsuarioModel.findById(userId);

      if (!usuario) {
        res.status(404).json({
          success: false,
          error: 'Usuario no encontrado en la base de datos',
          code: 'USER_NOT_FOUND',
          message: 'El usuario no existe',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: usuario._id,
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
   * Requiere autenticación JWT.
   */
  static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const usuario = userId ? await UsuarioModel.findById(userId) : null;

      res.status(200).json({
        success: true,
        authenticated: !!userId,
        synced: !!usuario,
        data: {
          hasLocalProfile: !!usuario,
          username: usuario?.username ?? null,
          balance: usuario?.balance ?? 0,
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
   * Requiere autenticación JWT.
   */
  static async getRoommates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const usuario = await UsuarioModel.findById(userId);

      if (!usuario) {
        res.status(404).json({
          success: false,
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      const compras = await ComprasModel.find({
        $or: [{ acreedorId: usuario._id }, { deudorId: usuario._id }],
      }).populate('acreedorId deudorId');

      const roommateIds = new Set<string>();
      compras.forEach((compra: { acreedorId?: { _id?: unknown }; deudorId?: { _id?: unknown } }) => {
        const acreedorId = compra.acreedorId?._id?.toString?.() ?? (compra.acreedorId as unknown as string)?.toString?.();
        const deudorId = compra.deudorId?._id?.toString?.() ?? (compra.deudorId as unknown as string)?.toString?.();
        const myId = usuario._id.toString();

        if (acreedorId && acreedorId !== myId) roommateIds.add(acreedorId);
        if (deudorId && deudorId !== myId) roommateIds.add(deudorId);
      });

      const roomies = await UsuarioModel.find({
        _id: { $in: Array.from(roommateIds) },
      });

      res.status(200).json({
        success: true,
        data: roomies.map((u) => ({
          id: u._id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          balance: u.balance,
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
