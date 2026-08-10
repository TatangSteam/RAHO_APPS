import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../errorHandler';
import { sendError } from '@utils/response';

jest.mock('@utils/response', () => ({ sendError: jest.fn() }));

describe('errorHandler', () => {
  it('preserves application error detail messages', () => {
    const req = { method: 'POST', url: '/test' } as Request;
    const res = { headersSent: false } as Response;
    const next = jest.fn() as NextFunction;

    errorHandler({
      status: 422,
      code: 'INCOMPLETE_SESSION',
      message: 'Sesi belum lengkap',
      errors: ['Material wajib BOM belum dicatat: Oneswab'],
    }, req, res, next);

    expect(sendError).toHaveBeenCalledWith(
      res,
      422,
      'INCOMPLETE_SESSION',
      'Sesi belum lengkap',
      [{ message: 'Material wajib BOM belum dicatat: Oneswab' }],
    );
  });
});
