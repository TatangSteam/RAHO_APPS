import { NextFunction, Request, Response } from 'express';
import { runWithActiveDatabase } from '@lib/prisma';

/** Pin one complete HTTP request to one database, including async callbacks. */
export function databaseContext(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  runWithActiveDatabase(() => next());
}
