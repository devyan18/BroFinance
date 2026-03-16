/**
 * Wallets controllers - CRUD for user wallets
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/index.ts';
import { sendSuccess } from '../../utils/response.ts';
import { UnauthorizedError } from '../../utils/errors.ts';
import {
  listWalletsByUserId,
  addWallet,
  updateWallet,
  deleteWallet,
} from './wallets.service.ts';
import { WALLET_PROVIDERS } from './wallet-providers.const.ts';

/**
 * GET /api/v1/wallets - List current user's wallets
 */
export const listWalletsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('Usuario no autenticado');
  const wallets = await listWalletsByUserId(userId);
  sendSuccess(res, { wallets });
};

/**
 * GET /api/v1/wallets/providers - List available wallet providers (name + color)
 */
export const listProvidersController = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  sendSuccess(res, { providers: WALLET_PROVIDERS });
};

/**
 * POST /api/v1/wallets - Add or update wallet for a provider
 */
export const addWalletController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('Usuario no autenticado');
  const { providerKey, cbu } = req.body;
  const wallet = await addWallet(userId, providerKey, cbu);
  sendSuccess(res, { wallet }, 'Billetera agregada');
};

/**
 * PATCH /api/v1/wallets/:id - Update wallet CBU
 */
export const updateWalletController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('Usuario no autenticado');
  const walletId = req.params.id;
  const { cbu } = req.body;
  const wallet = await updateWallet(userId, walletId, cbu);
  sendSuccess(res, { wallet }, 'Billetera actualizada');
};

/**
 * DELETE /api/v1/wallets/:id - Remove wallet
 */
export const deleteWalletController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('Usuario no autenticado');
  const walletId = req.params.id;
  await deleteWallet(userId, walletId);
  sendSuccess(res, null, 'Billetera eliminada');
};
