/**
 * Payments routes - Transfer info for debt settlement
 */

import { Router } from 'express';
import { validateData } from '../middlewares/validateRoute.ts';
import { transferInfoSchema } from './payments.route.validations.ts';
import { getTransferInfoController } from './payments.controllers.ts';
import { asyncHandler } from '../../middlewares/errorHandler.ts';
import { authenticate } from '../../middlewares/authenticate.ts';

const paymentsRouter = Router();

/**
 * @route   POST /api/v1/payments/transfer-info
 * @desc    Get CBU and amount to transfer for paying debts
 * @access  Private
 */
paymentsRouter.post(
  '/payments/transfer-info',
  authenticate,
  validateData(transferInfoSchema),
  asyncHandler(getTransferInfoController),
);

export { paymentsRouter };
