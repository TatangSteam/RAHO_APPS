import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { errors } from './errorHandler';

/**
 * Middleware to validate request body against a Zod schema
 */
export function validate(schema: ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Log incoming body for debugging
      console.log('📝 [VALIDATE] Request body:', JSON.stringify(req.body, null, 2));
      
      // Validate and parse the request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        console.log('❌ [VALIDATE] Validation errors:', JSON.stringify(formattedErrors, null, 2));

        return next(
          errors.badRequest('VALIDATION_ERROR', JSON.stringify(formattedErrors))
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate query parameters against a Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate and parse the query parameters
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return next(
          errors.badRequest('VALIDATION_ERROR', JSON.stringify(formattedErrors))
        );
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate route parameters against a Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate and parse the route parameters
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return next(
          errors.badRequest('VALIDATION_ERROR', JSON.stringify(formattedErrors))
        );
      }
      next(error);
    }
  };
}
