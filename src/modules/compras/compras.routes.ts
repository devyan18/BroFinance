/**
 * Compras (purchases/expenses) routes
 * Defines API endpoints for expense management between roommates
 */

import { Router } from 'express';
import { ComprasController } from '../../controllers/compras.controller';
import { validateData } from '../middlewares/validateRoute';
import {
  createCompraSchema,
  createCompraBatchSchema,
  updateCompraSchema,
  getByIdSchema,
  getBalanceSchema,
} from './compras.route.validations';
import { asyncHandler } from '../../middlewares/errorHandler';
import { authenticate } from '../../middlewares/authenticate';

const comprasRouter = Router();

/**
 * @route   GET /api/v1/compras
 * @desc    Get all purchases for the authenticated user
 * @access  Private
 */
comprasRouter.get('/compras', authenticate, asyncHandler(ComprasController.getAll));

/**
 * @route   GET /api/v1/compras/tipos
 * @desc    Get all purchase types
 * @access  Private
 */
comprasRouter.get('/compras/tipos', authenticate, asyncHandler(ComprasController.getTipos));

/**
 * @route   GET /api/v1/compras/usuarios
 * @desc    Get users available for creating expenses (all except self)
 * @access  Private
 */
comprasRouter.get('/compras/usuarios', authenticate, asyncHandler(ComprasController.getUsuarios));

/**
 * @route   GET /api/v1/compras/roommates
 * @desc    Get roommates (users with shared expenses)
 * @access  Private
 */
comprasRouter.get('/compras/roommates', authenticate, asyncHandler(ComprasController.getRoommates));

/**
 * @route   GET /api/v1/compras/balances
 * @desc    Get all balances with roommates (for background refresh)
 * @access  Private
 */
comprasRouter.get('/compras/balances', authenticate, asyncHandler(ComprasController.getBalances));

/**
 * @route   GET /api/v1/compras/balance/:roommateId
 * @desc    Get balance with a specific roommate
 * @access  Private
 */
comprasRouter.get(
  '/compras/balance/:roommateId',
  authenticate,
  validateData(getBalanceSchema),
  asyncHandler(ComprasController.getBalance),
);

/**
 * @route   GET /api/v1/compras/:id
 * @desc    Get a single purchase by ID
 * @access  Private
 */
comprasRouter.get(
  '/compras/:id',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.getById),
);

/**
 * @route   POST /api/v1/compras
 * @desc    Create a new purchase
 * @access  Private
 */
comprasRouter.post(
  '/compras',
  authenticate,
  validateData(createCompraSchema),
  asyncHandler(ComprasController.create),
);

/**
 * @route   POST /api/v1/compras/batch
 * @desc    Create multiple purchases (one per debtor) in a single call
 * @access  Private
 */
comprasRouter.post(
  '/compras/batch',
  authenticate,
  validateData(createCompraBatchSchema),
  asyncHandler(ComprasController.createBatch),
);

/**
 * @route   PATCH /api/v1/compras/:id
 * @desc    Update a purchase
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id',
  authenticate,
  validateData(updateCompraSchema),
  asyncHandler(ComprasController.update),
);

/**
 * @route   PATCH /api/v1/compras/:id/accept
 * @desc    Accept a charge (debtor only)
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id/accept',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.accept),
);

/**
 * @route   PATCH /api/v1/compras/:id/reject
 * @desc    Reject a charge (debtor only)
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id/reject',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.reject),
);

/**
 * @route   PATCH /api/v1/compras/:id/request-payment
 * @desc    Debtor marks the expense as paid (awaiting creditor confirmation)
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id/request-payment',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.requestPayment),
);

/**
 * @route   PATCH /api/v1/compras/:id/confirm-payment
 * @desc    Creditor confirms payment received — closes the debt
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id/confirm-payment',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.confirmPayment),
);

/**
 * @route   PATCH /api/v1/compras/:id/reject-payment
 * @desc    Creditor rejects the payment claim — debt back to 'aceptado'
 * @access  Private
 */
comprasRouter.patch(
  '/compras/:id/reject-payment',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.rejectPayment),
);

/**
 * @route   DELETE /api/v1/compras/:id
 * @desc    Delete a purchase
 * @access  Private
 */
comprasRouter.delete(
  '/compras/:id',
  authenticate,
  validateData(getByIdSchema),
  asyncHandler(ComprasController.delete),
);

export { comprasRouter };
