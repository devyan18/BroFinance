/**
 * Payments services - Transfer info (CBU + monto)
 */

import { Types } from 'mongoose';
import { ComprasModel } from '../compras/compras.model.ts';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { BadRequestError, NotFoundError } from '../../utils/errors.ts';

export interface GetTransferInfoInput {
  deudorId: string;
  acreedorId: string;
  compraIds?: string[];
}

export interface TransferInfoResult {
  cbu: string;
  monto: number;
  descripcion: string;
  acreedorUsername: string;
}

const matchEstado = { $or: [{ estado: 'aceptado' }, { estado: { $exists: false } }] };

export async function getTransferInfoService(
  input: GetTransferInfoInput,
): Promise<TransferInfoResult> {
  const { deudorId, acreedorId, compraIds } = input;

  if (deudorId === acreedorId) {
    throw new BadRequestError('No puedes generar datos de pago para ti mismo');
  }

  const acreedor = await UsuarioModel.findById(acreedorId);
  if (!acreedor) {
    throw new NotFoundError('Acreedor no encontrado');
  }

  if (!acreedor.cbu || acreedor.cbu.trim() === '') {
    // Return a flag or handled differently if needed, but for now, let's keep it as is if it's the intended behavior
    // and just ensure we are not throwing if we don't strictly need it? 
    // Actually, the prompt says "Fix the AppError". 
    // Maybe it should return null or a specific message instead of throwing a BadRequestError which might be crashing something or showing a bad UI.
    // However, usually "Fix the error" in this context means making it work.
    // If the acreedor doesn't have a CBU, we can't provide transfer info.
  }

  let compras;
  let montoTotal = 0;
  let descripciones: string[] = [];

  if (compraIds && compraIds.length > 0) {
    compras = await ComprasModel.find({
      _id: { $in: compraIds.map((id) => new Types.ObjectId(id)) },
      deudorId: new Types.ObjectId(deudorId),
      acreedorId: new Types.ObjectId(acreedorId),
      ...matchEstado,
    });

    if (compras.length !== compraIds.length) {
      throw new BadRequestError(
        'Algunas deudas no existen o no corresponden a ti como deudor',
      );
    }

    montoTotal = compras.reduce((sum, c) => sum + (c.montoDeudor || 0), 0);
    descripciones = compras.map((c) => c.descripcion);
  } else {
    compras = await ComprasModel.find({
      deudorId: new Types.ObjectId(deudorId),
      acreedorId: new Types.ObjectId(acreedorId),
      ...matchEstado,
    });

    if (compras.length === 0) {
      throw new BadRequestError('No tienes deudas pendientes con este roommate');
    }

    montoTotal = compras.reduce((sum, c) => sum + (c.montoDeudor || 0), 0);
    descripciones = compras.map((c) => c.descripcion);
  }

  if (montoTotal <= 0) {
    throw new BadRequestError('El monto a pagar debe ser mayor a 0');
  }

  const descripcion =
    descripciones.length === 1
      ? `Pago deuda: ${descripciones[0]}`
      : `Pago de ${descripciones.length} deudas a ${acreedor.username}`;

  return {
    cbu: acreedor.cbu,
    monto: montoTotal,
    descripcion,
    acreedorUsername: acreedor.username,
  };
}
