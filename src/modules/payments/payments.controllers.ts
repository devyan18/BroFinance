/**
 * Payments controllers - Transfer info (CBU + monto)
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/index.ts';
import { sendSuccess } from '../../utils/response.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { getTransferInfoService } from './payments.services.ts';

/**
 * Get transfer info (CBU, monto) for paying debts
 * POST /api/v1/payments/transfer-info
 *
 * Body:
 * - acreedorId: string (required) - User who will receive the transfer
 * - compraIds?: string[] (optional) - Specific debt IDs. If omitted, all debts to acreedor
 */
export const getTransferInfoController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  const { acreedorId, compraIds } = req.body;

  const result = await getTransferInfoService({
    deudorId: userId,
    acreedorId,
    compraIds: compraIds as string[] | undefined,
  });
  sendSuccess(res, result, 'Datos de transferencia');
};
