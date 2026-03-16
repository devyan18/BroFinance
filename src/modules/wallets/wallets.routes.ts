/**
 * Wallets routes - User wallets (one CBU per provider)
 */

import { Router } from 'express';
import { validateData } from '../middlewares/validateRoute.ts';
import {
  addWalletSchema,
  updateWalletSchema,
  deleteWalletSchema,
} from './wallets.route.validations.ts';
import {
  listWalletsController,
  listProvidersController,
  addWalletController,
  updateWalletController,
  deleteWalletController,
} from './wallets.controllers.ts';
import { asyncHandler } from '../../middlewares/errorHandler.ts';
import { authenticate } from '../../middlewares/authenticate.ts';

const walletsRouter = Router();

walletsRouter.get('/wallets', authenticate, asyncHandler(listWalletsController));
walletsRouter.get('/wallets/providers', authenticate, asyncHandler(listProvidersController));
walletsRouter.post(
  '/wallets',
  authenticate,
  validateData(addWalletSchema),
  asyncHandler(addWalletController),
);
walletsRouter.patch(
  '/wallets/:id',
  authenticate,
  validateData(updateWalletSchema),
  asyncHandler(updateWalletController),
);
walletsRouter.delete(
  '/wallets/:id',
  authenticate,
  validateData(deleteWalletSchema),
  asyncHandler(deleteWalletController),
);

export { walletsRouter };
