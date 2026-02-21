/**
 * Validation middleware
 * Validates request data using Zod schemas
 */

import { ZodError, ZodType } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../../utils/response.ts';

/**
 * Middleware to validate request data (body, params, query)
 * @param schemas - Object containing Zod schemas for body, params, and/or query
 */
export const validateData =
  (schemas: { body?: ZodType; params?: ZodType; query?: ZodType }) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) throw result.error;
        req.body = result.data;
      }

      // Validate params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) throw result.error;
        req.params = result.data as any;
      }

      // Validate query (req.query is read-only in Express, store in validatedQuery)
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) throw result.error;
        (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.issues.map(issue => ({
          path: (issue.path || []).join('.') || '(root)',
          message: typeof issue.message === 'string' ? issue.message : String(issue.message),
        }));
        const firstMsg = formatted[0]?.message || 'Validation failed';
        sendError(res, firstMsg, 400, formatted);
        return;
      }

      next(error);
    }
  };

