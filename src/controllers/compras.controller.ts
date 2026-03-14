// src/controllers/compras.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index';
import { ComprasModel, TipoCompraModel } from '../modules/compras/compras.model';
import { UsuarioModel } from '../modules/usuarios/usuario.model';
import { getFriendIds, areFriends } from '../modules/friends/friends.services.ts';
import { Types } from 'mongoose';
import { sendPushNotification } from '../utils/notifications.service.ts';
import { sendNewChargeEmail } from '../utils/email.service.ts';
import { getSettings } from '../modules/usuarios/user-settings.service.ts';
import { computeBilateralBalance } from '../modules/compras/balance.service.ts';

/**
 * Controlador para operaciones de gastos entre roomies.
 * Todas las rutas requieren loadUserFromDB antes de llegar aquí.
 */
export class ComprasController {
  /**
   * Crear un nuevo gasto entre roomies.
   * POST /api/compras
   *
   * Body:
   * - descripcion: string (requerido) - Descripción del gasto
   * - montoTotal: number (requerido) - Monto total del gasto
   * - tipo: Types.ObjectId (requerido) - ID del tipo de compra
   * - deudorId: Types.ObjectId (requerido) - ID del usuario que debe
   *
   * El acreedorId se toma automáticamente del usuario autenticado.
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { descripcion, montoTotal, montoDeudor, tipo, deudorId: deudorIdBody } = req.body;

      // Validaciones básicas (montoDeudor viene validado por Zod)
      if (!descripcion || montoTotal == null || montoDeudor == null || !tipo) {
        res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos',
          code: 'MISSING_FIELDS',
          required: ['descripcion', 'montoTotal', 'montoDeudor', 'tipo'],
        });
        return;
      }

      if (montoDeudor > montoTotal) {
        res.status(400).json({
          success: false,
          error: 'Lo que debe el deudor no puede superar el monto total',
          code: 'INVALID_MONTO_DEUDOR',
        });
        return;
      }

      const acreedorId = req.user.userId;
      const acreedor = await UsuarioModel.findById(acreedorId);

      if (!acreedor) {
        res.status(404).json({
          success: false,
          error: 'Acreedor no encontrado',
          code: 'ACREEDOR_NOT_FOUND',
        });
        return;
      }

      // Si no hay deudorId, es gasto personal (solo) - usar el mismo usuario
      const deudorId = deudorIdBody || acreedorId;

      if (deudorIdBody) {
        const deudor = await UsuarioModel.findById(deudorId);
        if (!deudor) {
          res.status(404).json({
            success: false,
            error: 'Deudor no encontrado',
            code: 'DEUDOR_NOT_FOUND',
          });
          return;
        }
        if (deudorId.toString() === acreedorId) {
          res.status(400).json({
            success: false,
            error: 'No puedes registrar un gasto donde eres ambas partes',
            code: 'SELF_TRANSACTION',
          });
          return;
        }
        const isFriend = await areFriends(acreedorId, deudorId.toString());
        if (!isFriend) {
          res.status(403).json({
            success: false,
            error: 'Solo puedes registrar gastos con amigos. Envía una solicitud de amistad primero.',
            code: 'NOT_FRIEND',
          });
          return;
        }
      }

      // Gasto personal (solo): acreedor === deudor → auto-aceptado, no requiere confirmación
      const isSolo = deudorId.toString() === acreedorId;

      // Crear la compra (montoDeudor = lo que debe; montoAcreedor = lo que cobra)
      const compra = new ComprasModel({
        acreedorId,
        deudorId,
        descripcion,
        tipo: new Types.ObjectId(tipo),
        montoTotal,
        montoAcreedor: montoDeudor,
        montoDeudor,
        estado: isSolo ? 'aceptado' : 'pendiente',
      });

      await compra.save();

      // Notificar al deudor si es un gasto compartido (push y/o email según preferencias)
      if (!isSolo) {
        const deudorDoc = await UsuarioModel.findById(deudorId);
        const settings = await getSettings(deudorId.toString());
        const montoFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(montoDeudor);
        if (deudorDoc?.pushToken && settings.notifyNewChargesPush) {
          await sendPushNotification([deudorDoc.pushToken], {
            title: `${acreedor.username} te cobró`,
            body: `${descripcion} — ${montoFormatted}`,
            data: { type: 'new_charge', compraId: String(compra._id) },
          });
        }
        if (settings.notifyNewChargesEmail && deudorDoc?.email) {
          try {
            await sendNewChargeEmail(
              deudorDoc.email,
              deudorDoc.username,
              acreedor.username,
              descripcion,
              montoFormatted,
            );
          } catch (err) {
            console.error('Error sending new charge email:', err);
          }
        }
      }

      res.status(201).json({
        success: true,
        data: {
          id: compra._id,
          descripcion: compra.descripcion,
          montoTotal: compra.montoTotal,
          acreedorId: compra.acreedorId,
          deudorId: compra.deudorId,
          createdAt: (compra as any).createdAt,
        },
        message: 'Gasto registrado correctamente',
      });
    } catch (error) {
      console.error('Error en create compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar el gasto',
        code: 'CREATE_ERROR',
      });
    }
  }

  /**
   * Crear múltiples gastos compartidos en una sola llamada (uno por deudor).
   * POST /api/compras/batch
   *
   * Body:
   * - descripcion: string
   * - montoTotal: number
   * - tipo: ObjectId
   * - deudores: [{ deudorId: ObjectId, montoDeudor: number }]
   */
  static async createBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
        return;
      }

      const { descripcion, montoTotal, tipo, deudores } = req.body as {
        descripcion: string;
        montoTotal: number;
        tipo: string;
        deudores: { deudorId: string; montoDeudor: number }[];
      };

      const acreedorId = req.user.userId;
      const acreedor = await UsuarioModel.findById(acreedorId);
      if (!acreedor) {
        res.status(404).json({ success: false, error: 'Acreedor no encontrado', code: 'ACREEDOR_NOT_FOUND' });
        return;
      }

      // Validate each debtor
      for (const { deudorId } of deudores) {
        if (deudorId === acreedorId) {
          res.status(400).json({ success: false, error: 'No puedes registrarte como deudor de tu propio gasto', code: 'SELF_TRANSACTION' });
          return;
        }
        const deudor = await UsuarioModel.findById(deudorId);
        if (!deudor) {
          res.status(404).json({ success: false, error: `Deudor ${deudorId} no encontrado`, code: 'DEUDOR_NOT_FOUND' });
          return;
        }
        const isFriend = await areFriends(acreedorId, deudorId);
        if (!isFriend) {
          res.status(403).json({
            success: false,
            error: `Solo puedes registrar gastos con amigos. ${deudor.username} no es tu amigo.`,
            code: 'NOT_FRIEND',
          });
          return;
        }
      }

      // Create one Compra per debtor
      const created = await Promise.all(
        deudores.map(({ deudorId, montoDeudor }) =>
          ComprasModel.create({
            acreedorId,
            deudorId: new Types.ObjectId(deudorId),
            descripcion,
            tipo: new Types.ObjectId(tipo),
            montoTotal,
            montoAcreedor: montoDeudor,
            montoDeudor,
            estado: 'pendiente',
          }),
        ),
      );

      // Notificar a cada deudor (push y/o email según preferencias)
      const montoByDeudor = new Map(deudores.map((d) => [d.deudorId, d.montoDeudor]));
      for (const compra of created) {
        const deudorIdStr = String(compra.deudorId);
        const deudorDoc = await UsuarioModel.findById(deudorIdStr);
        const settings = await getSettings(deudorIdStr);
        const montoDeudor = montoByDeudor.get(deudorIdStr) ?? compra.montoDeudor;
        const montoFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(montoDeudor);
        if (deudorDoc?.pushToken && settings.notifyNewChargesPush) {
          await sendPushNotification([deudorDoc.pushToken], {
            title: `${acreedor.username} te cobró`,
            body: `${compra.descripcion} — ${montoFormatted}`,
            data: { type: 'new_charge', compraId: String(compra._id) },
          });
        }
        if (settings.notifyNewChargesEmail && deudorDoc?.email) {
          try {
            await sendNewChargeEmail(
              deudorDoc.email,
              deudorDoc.username,
              acreedor.username,
              compra.descripcion,
              montoFormatted,
            );
          } catch (err) {
            console.error('Error sending new charge email:', err);
          }
        }
      }

      res.status(201).json({
        success: true,
        data: created.map((c) => ({
          id: c._id,
          descripcion: c.descripcion,
          montoTotal: c.montoTotal,
          montoDeudor: c.montoDeudor,
          deudorId: c.deudorId,
        })),
        message: `${created.length} gasto(s) registrado(s) correctamente`,
      });
    } catch (error) {
      console.error('Error en createBatch compra:', error);
      res.status(500).json({ success: false, error: 'Error al registrar los gastos', code: 'CREATE_ERROR' });
    }
  }

  /**
   * Obtener todos los gastos del usuario autenticado.
   * GET /api/compras
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const baseFiltro = {
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      };
      const andParts: object[] = [baseFiltro];
      const tipoFilter = req.query.tipo as string | undefined;
      const usuarioFilter = req.query.usuario as string | undefined;
      if (tipoFilter) andParts.push({ tipo: new Types.ObjectId(tipoFilter) });
      if (usuarioFilter) {
        const uid = new Types.ObjectId(usuarioFilter);
        andParts.push({ $or: [{ acreedorId: uid }, { deudorId: uid }] });
        // Excluir gastos personales (acreedor === deudor): no son "transacciones con" otro usuario
        andParts.push({ $expr: { $ne: ['$acreedorId', '$deudorId'] } });
      }
      const filtro = andParts.length === 1 ? baseFiltro : { $and: andParts };

      const sortBy = (req.query.sort as string) || 'createdAt';
      const sortOrder = req.query.order === 'asc' ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = {};
      if (sortBy === 'montoTotal' || sortBy === 'montoDeudor') sortObj[sortBy] = sortOrder;
      else sortObj['createdAt'] = sortOrder;

      const compras = await ComprasModel.find(filtro)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion')
        .sort(Object.keys(sortObj).length ? sortObj : { createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ComprasModel.countDocuments(filtro);

      res.status(200).json({
        success: true,
        data: compras,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error en getAll compras:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener gastos',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * Obtener todos los balances con roommates (para refresco en segundo plano).
   * GET /api/compras/balances
   */
  static async getBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const friendIds = await getFriendIds(req.user.userId);
      if (friendIds.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const compras = await ComprasModel.find({
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      })
        .select('acreedorId deudorId')
        .lean();

      const roommateIds = new Set<string>();
      compras.forEach((c: { acreedorId: { toString: () => string }; deudorId: { toString: () => string } }) => {
        const aid = c.acreedorId?.toString?.();
        const did = c.deudorId?.toString?.();
        const myId = req.user!.userId;
        if (aid && aid !== myId) roommateIds.add(aid);
        if (did && did !== myId) roommateIds.add(did);
      });
      const allowedIds = Array.from(roommateIds).filter((id) => friendIds.includes(id));
      if (allowedIds.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const data = await Promise.all(
        allowedIds.map(async (roommateId) => {
          const result = await computeBilateralBalance(req.user!.userId, roommateId);
          return { roommateId, ...result };
        }),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error en getBalances:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener balances',
        code: 'BALANCE_ERROR',
      });
    }
  }

  /**
   * Obtener balance neto con un roommate específico.
   * GET /api/compras/balance/:roommateId
   * Incluye solo compras aceptado/pago_pendiente; netea lo que me debe con lo que yo debo.
   */
  static async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { roommateId } = req.params;
      const result = await computeBilateralBalance(req.user.userId, roommateId);

      res.status(200).json({
        success: true,
        data: {
          roommateId,
          ...result,
        },
      });
    } catch (error) {
      console.error('Error en getBalance:', error);
      res.status(500).json({
        success: false,
        error: 'Error al calcular balance',
        code: 'BALANCE_ERROR',
      });
    }
  }

  /**
   * Obtener una compra por ID.
   * GET /api/compras/:id
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({
        _id: id,
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      })
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      if (!compra) {
        res.status(404).json({
          success: false,
          error: 'Compra no encontrada',
          code: 'COMPRA_NOT_FOUND',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: compra,
      });
    } catch (error) {
      console.error('Error en getById compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener la compra',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * Obtener todos los tipos de compra.
   * GET /api/compras/tipos
   */
  static async getTipos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tipos = await TipoCompraModel.find().sort({ descripcion: 1 });
      res.status(200).json({
        success: true,
        data: tipos,
      });
    } catch (error) {
      console.error('Error en getTipos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener tipos de compra',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * Obtener amigos disponibles para crear gastos compartidos (solo amigos aceptados).
   * GET /api/compras/usuarios
   */
  static async getUsuarios(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const friendIds = await getFriendIds(req.user.userId);
      if (friendIds.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const usuarios = await UsuarioModel.find({ _id: { $in: friendIds } })
        .select('username avatarUrl')
        .sort({ username: 1 });

      const data = await Promise.all(
        usuarios.map(async (u) => {
          const { balance } = await computeBilateralBalance(req.user!.userId, u._id.toString());
          return {
            id: u._id,
            username: u.username,
            avatarUrl: u.avatarUrl,
            balance,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error en getUsuarios:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener usuarios',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * Obtener roommates (amigos con gastos compartidos).
   * GET /api/compras/roommates
   */
  static async getRoommates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const friendIds = await getFriendIds(req.user.userId);
      if (friendIds.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const compras = await ComprasModel.find({
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      })
        .populate('acreedorId', '_id username avatarUrl')
        .populate('deudorId', '_id username avatarUrl');

      const roommateIds = new Set<string>();
      compras.forEach((compra: { acreedorId?: { _id?: { toString: () => string } }; deudorId?: { _id?: { toString: () => string } } }) => {
        const acreedorId = (compra.acreedorId as { _id?: { toString: () => string } })?._id?.toString?.();
        const deudorId = (compra.deudorId as { _id?: { toString: () => string } })?._id?.toString?.();
        const myId = req.user!.userId;
        if (acreedorId && acreedorId !== myId) roommateIds.add(acreedorId);
        if (deudorId && deudorId !== myId) roommateIds.add(deudorId);
      });

      // Solo incluir roommates que sean amigos
      const allowedIds = Array.from(roommateIds).filter((id) => friendIds.includes(id));
      if (allowedIds.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const roommates = await UsuarioModel.find({ _id: { $in: allowedIds } })
        .select('username avatarUrl');

      const data = await Promise.all(
        roommates.map(async (u) => {
          const { balance } = await computeBilateralBalance(req.user!.userId, u._id.toString());
          return {
            id: u._id,
            username: u.username,
            avatarUrl: u.avatarUrl,
            balance,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error en getRoommates:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener roommates',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * Actualizar una compra.
   * PATCH /api/compras/:id
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { id } = req.params;
      const { descripcion, montoTotal, montoDeudor, tipo } = req.body;

      const compra = await ComprasModel.findOne({
        _id: id,
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      });

      if (!compra) {
        res.status(404).json({
          success: false,
          error: 'Compra no encontrada',
          code: 'COMPRA_NOT_FOUND',
        });
        return;
      }

      const compraDoc = compra as { estado?: string };

      // Solo el acreedor puede editar
      if (compra.acreedorId.toString() !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: 'Solo el acreedor puede editar esta compra',
          code: 'FORBIDDEN',
        });
        return;
      }
      // No se puede editar una compra ya pagada o con pago en espera
      if (compraDoc.estado === 'pagado' || compraDoc.estado === 'pago_pendiente') {
        res.status(400).json({
          success: false,
          error: 'No se puede editar una compra con pago en curso o ya pagada',
          code: 'COMPRA_NOT_EDITABLE',
        });
        return;
      }

      const wasAceptado = compraDoc.estado === 'aceptado';
      const oldMonto = compra.montoDeudor;

      if (descripcion !== undefined) compra.descripcion = descripcion;
      if (montoTotal !== undefined) compra.montoTotal = montoTotal;
      if (montoDeudor !== undefined) {
        if (montoDeudor > (compra.montoTotal ?? montoDeudor)) {
          res.status(400).json({
            success: false,
            error: 'Lo que debe el deudor no puede superar el monto total',
            code: 'INVALID_MONTO_DEUDOR',
          });
          return;
        }
        compra.montoDeudor = montoDeudor;
        compra.montoAcreedor = montoDeudor;
      }
      if (tipo !== undefined) compra.tipo = new Types.ObjectId(tipo);

      const newMonto = compra.montoDeudor;

      // Si estaba aceptado: revertir balance y volver a pendiente para re-aceptación
      if (wasAceptado) {
        const deudor = await UsuarioModel.findById(compra.deudorId);
        const acreedor = await UsuarioModel.findById(compra.acreedorId);
        if (deudor && acreedor) {
          deudor.balance += oldMonto;
          acreedor.balance -= oldMonto;
          await deudor.save();
          await acreedor.save();
        }
        compraDoc.estado = 'pendiente';
      } else if (compraDoc.estado === 'pendiente' && oldMonto !== newMonto) {
        // Si ya era pendiente y cambió el monto, ajustar balance si aplica
        const deudor = await UsuarioModel.findById(compra.deudorId);
        const acreedor = await UsuarioModel.findById(compra.acreedorId);
        if (deudor && acreedor) {
          deudor.balance += oldMonto;
          acreedor.balance -= oldMonto;
          deudor.balance -= newMonto;
          acreedor.balance += newMonto;
          await deudor.save();
          await acreedor.save();
        }
      }

      await compra.save();

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Compra actualizada correctamente',
      });
    } catch (error) {
      console.error('Error en update compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar la compra',
        code: 'UPDATE_ERROR',
      });
    }
  }

  /**
   * Eliminar una compra.
   * DELETE /api/compras/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { id } = req.params;

      const compra = await ComprasModel.findOne({
        _id: id,
        $or: [{ acreedorId: req.user.userId }, { deudorId: req.user.userId }],
      });

      if (!compra) {
        res.status(404).json({
          success: false,
          error: 'Compra no encontrada',
          code: 'COMPRA_NOT_FOUND',
        });
        return;
      }

      // Solo el acreedor puede eliminar
      if (compra.acreedorId.toString() !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: 'Solo el acreedor puede eliminar esta compra',
          code: 'FORBIDDEN',
        });
        return;
      }

      // Revertir balance si estaba aceptado o pago_pendiente (balance ya aplicado)
      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado === 'aceptado' || compraDoc.estado === 'pago_pendiente') {
        const deudor = await UsuarioModel.findById(compra.deudorId);
        const acreedor = await UsuarioModel.findById(compra.acreedorId);
        if (deudor && acreedor) {
          deudor.balance += compra.montoDeudor;
          acreedor.balance -= compra.montoDeudor;
          await deudor.save();
          await acreedor.save();
        }
      }

      await ComprasModel.deleteOne({ _id: id });

      res.status(200).json({
        success: true,
        message: 'Compra eliminada correctamente',
      });
    } catch (error) {
      console.error('Error en delete compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar la compra',
        code: 'DELETE_ERROR',
      });
    }
  }

  /**
   * Aceptar una compra (solo el deudor).
   * PATCH /api/compras/:id/accept
   */
  static async accept(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({
        _id: id,
        deudorId: req.user.userId,
      });

      if (!compra) {
        res.status(404).json({
          success: false,
          error: 'Compra no encontrada o no eres el deudor',
          code: 'COMPRA_NOT_FOUND',
        });
        return;
      }

      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado !== 'pendiente') {
        res.status(400).json({
          success: false,
          error: 'Esta compra ya fue aceptada o rechazada',
          code: 'COMPRA_NOT_PENDING',
        });
        return;
      }

      compraDoc.estado = 'aceptado';
      await compra.save();

      // Notificar al acreedor
      const acreedorDoc = await UsuarioModel.findById(compra.acreedorId);
      const deudorForNotif = await UsuarioModel.findById(compra.deudorId);
      if (acreedorDoc?.pushToken && deudorForNotif) {
        await sendPushNotification([acreedorDoc.pushToken], {
          title: `${deudorForNotif.username} aceptó tu cobro`,
          body: compra.descripcion,
          data: { type: 'charge_accepted', compraId: id },
        });
      }

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Cargo aceptado correctamente',
      });
    } catch (error) {
      console.error('Error en accept compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al aceptar el cargo',
        code: 'ACCEPT_ERROR',
      });
    }
  }

  /**
   * Solicitar confirmación de pago (solo el deudor, cuando estado = aceptado).
   * PATCH /api/compras/:id/request-payment
   */
  static async requestPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({ _id: id, deudorId: req.user.userId });

      if (!compra) {
        res.status(404).json({ success: false, error: 'Compra no encontrada o no eres el deudor', code: 'COMPRA_NOT_FOUND' });
        return;
      }

      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado !== 'aceptado') {
        res.status(400).json({ success: false, error: 'Solo puedes marcar como pagada una compra aceptada', code: 'COMPRA_NOT_ACEPTADO' });
        return;
      }

      compraDoc.estado = 'pago_pendiente';
      await compra.save();

      // Notificar al acreedor que el deudor dice haber pagado
      const acreedorForPayment = await UsuarioModel.findById(compra.acreedorId);
      const deudorForPayment = await UsuarioModel.findById(compra.deudorId);
      if (acreedorForPayment?.pushToken && deudorForPayment) {
        const montoFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(compra.montoDeudor);
        await sendPushNotification([acreedorForPayment.pushToken], {
          title: `${deudorForPayment.username} dice haber pagado`,
          body: `${compra.descripcion} — ${montoFormatted}`,
          data: { type: 'payment_requested', compraId: id },
        });
      }

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({ success: true, data: updated, message: 'Pago enviado al cobrador para confirmación' });
    } catch (error) {
      console.error('Error en requestPayment:', error);
      res.status(500).json({ success: false, error: 'Error al solicitar confirmación de pago', code: 'REQUEST_PAYMENT_ERROR' });
    }
  }

  /**
   * Confirmar que el pago fue recibido (solo el acreedor, cuando estado = pago_pendiente).
   * PATCH /api/compras/:id/confirm-payment
   */
  static async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({ _id: id, acreedorId: req.user.userId });

      if (!compra) {
        res.status(404).json({ success: false, error: 'Compra no encontrada o no eres el acreedor', code: 'COMPRA_NOT_FOUND' });
        return;
      }

      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado !== 'pago_pendiente') {
        res.status(400).json({ success: false, error: 'No hay solicitud de pago pendiente para esta compra', code: 'NO_PAYMENT_REQUEST' });
        return;
      }

      compraDoc.estado = 'pagado';
      await compra.save(); // pre-save hook revertirá los balances

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({ success: true, data: updated, message: 'Pago confirmado. Deuda saldada.' });
    } catch (error) {
      console.error('Error en confirmPayment:', error);
      res.status(500).json({ success: false, error: 'Error al confirmar el pago', code: 'CONFIRM_PAYMENT_ERROR' });
    }
  }

  /**
   * Rechazar la solicitud de pago (solo el acreedor, vuelve a 'aceptado').
   * PATCH /api/compras/:id/reject-payment
   */
  static async rejectPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({ _id: id, acreedorId: req.user.userId });

      if (!compra) {
        res.status(404).json({ success: false, error: 'Compra no encontrada o no eres el acreedor', code: 'COMPRA_NOT_FOUND' });
        return;
      }

      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado !== 'pago_pendiente') {
        res.status(400).json({ success: false, error: 'No hay solicitud de pago pendiente para esta compra', code: 'NO_PAYMENT_REQUEST' });
        return;
      }

      compraDoc.estado = 'aceptado';
      await compra.save();

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({ success: true, data: updated, message: 'Solicitud de pago rechazada. La deuda sigue activa.' });
    } catch (error) {
      console.error('Error en rejectPayment:', error);
      res.status(500).json({ success: false, error: 'Error al rechazar la solicitud de pago', code: 'REJECT_PAYMENT_ERROR' });
    }
  }

  /**
   * Rechazar una compra (solo el deudor).
   * PATCH /api/compras/:id/reject
   */
  static async reject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(404).json({
          success: false,
          error: 'Usuario no sincronizado',
          code: 'USER_NOT_SYNCED',
        });
        return;
      }

      const { id } = req.params;
      const compra = await ComprasModel.findOne({
        _id: id,
        deudorId: req.user.userId,
      });

      if (!compra) {
        res.status(404).json({
          success: false,
          error: 'Compra no encontrada o no eres el deudor',
          code: 'COMPRA_NOT_FOUND',
        });
        return;
      }

      const compraDoc = compra as { estado?: string };
      if (compraDoc.estado !== 'pendiente') {
        res.status(400).json({
          success: false,
          error: 'Esta compra ya fue aceptada o rechazada',
          code: 'COMPRA_NOT_PENDING',
        });
        return;
      }

      compraDoc.estado = 'rechazado';
      await compra.save();

      // Notificar al acreedor
      const acreedorForReject = await UsuarioModel.findById(compra.acreedorId);
      const deudorForReject = await UsuarioModel.findById(compra.deudorId);
      if (acreedorForReject?.pushToken && deudorForReject) {
        await sendPushNotification([acreedorForReject.pushToken], {
          title: `${deudorForReject.username} rechazó tu cobro`,
          body: compra.descripcion,
          data: { type: 'charge_rejected', compraId: id },
        });
      }

      const updated = await ComprasModel.findById(id)
        .populate('acreedorId', 'username avatarUrl')
        .populate('deudorId', 'username avatarUrl')
        .populate('tipo', 'descripcion');

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Cargo rechazado',
      });
    } catch (error) {
      console.error('Error en reject compra:', error);
      res.status(500).json({
        success: false,
        error: 'Error al rechazar el cargo',
        code: 'REJECT_ERROR',
      });
    }
  }
}
