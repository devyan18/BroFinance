// src/controllers/compras.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ComprasModel } from '../models/compras.model';
import { UsuarioModel } from '../models/usuario.model';
import { Types } from 'mongoose';

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

			const { descripcion, montoTotal, tipo, deudorId } = req.body;

			// Validaciones básicas
			if (!descripcion || !montoTotal || !tipo || !deudorId) {
				res.status(400).json({
					success: false,
					error: 'Faltan campos requeridos',
					code: 'MISSING_FIELDS',
					required: ['descripcion', 'montoTotal', 'tipo', 'deudorId'],
				});
				return;
			}

			// Verificar que el deudor exista en la base de datos local
			const deudor = await UsuarioModel.findById(deudorId);
			if (!deudor) {
				res.status(404).json({
					success: false,
					error: 'Deudor no encontrado',
					code: 'DEUDOR_NOT_FOUND',
				});
				return;
			}

			// Verificar que el deudor no sea el mismo que el acreedor
			if (deudorId.toString() === req.user._id.toString()) {
				res.status(400).json({
					success: false,
					error: 'No puedes registrar un gasto donde eres ambas partes',
					code: 'SELF_TRANSACTION',
				});
				return;
			}

			// El acreedor es el usuario autenticado
			const acreedorId = req.user._id;
			const acreedor = await UsuarioModel.findById(acreedorId);

			if (!acreedor) {
				res.status(404).json({
					success: false,
					error: 'Acreedor no encontrado',
					code: 'ACREEDOR_NOT_FOUND',
				});
				return;
			}

			// Crear la compra
			const compra = new ComprasModel({
				acreedorId,
				deudorId,
				descripcion,
				tipo: new Types.ObjectId(tipo),
				montoTotal,
				montoAcreedor: montoTotal,
				montoDeudor: montoTotal,
			});

			await compra.save();

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

			const filtro = {
				$or: [{ acreedorId: req.user._id }, { deudorId: req.user._id }],
			};

			const compras = await ComprasModel.find(filtro)
				.populate('acreedorId', 'username avatarUrl')
				.populate('deudorId', 'username avatarUrl')
				.populate('tipo', 'descripcion')
				.sort({ createdAt: -1 })
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
	 * Obtener balance con un roommate específico.
	 * GET /api/compras/balance/:roommateId
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

			// Calcular total de compras donde el usuario es acreedor
			const comoAcreedor = await ComprasModel.aggregate([
				{
					$match: {
						acreedorId: req.user._id,
						deudorId: new Types.ObjectId(roommateId),
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: '$montoAcreedor' },
					},
				},
			]);

			// Calcular total de compras donde el usuario es deudor
			const comoDeudor = await ComprasModel.aggregate([
				{
					$match: {
						acreedorId: new Types.ObjectId(roommateId),
						deudorId: req.user._id,
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: '$montoDeudor' },
					},
				},
			]);

			const totalAcreedor = comoAcreedor[0]?.total || 0;
			const totalDeudor = comoDeudor[0]?.total || 0;
			const balance = totalAcreedor - totalDeudor;

			res.status(200).json({
				success: true,
				data: {
					roommateId,
					totalACobrar: totalAcreedor,
					totalAPagar: totalDeudor,
					balance,
					estado: balance > 0 ? 'te deben' : balance < 0 ? 'debes' : 'cuadrado',
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
}
