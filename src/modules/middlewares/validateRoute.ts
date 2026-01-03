import { ZodError, ZodType } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * validateRequest
 * Recibe un objeto opcional con Zod schemas:
 * - body?: ZodType
 * - params?: ZodType
 * - query?: ZodType
 *
 * Valida cada parte usando safeParse
 * y devuelve errores estructurados si fallan.
 */
export const validateData =
  (schemas: { body?: ZodType; params?: ZodType; query?: ZodType }) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) throw result.error;
        req.body = result.data;
      }

      // Validar params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) throw result.error;
      }

      // Validar query
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) throw result.error;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.issues.map(issue => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: formatted,
        });
      }

      next(error);
    }
  };
