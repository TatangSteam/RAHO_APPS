import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../errorHandler';
import { sendError } from '@utils/response';
import multer from 'multer';

jest.mock('@utils/response', () => ({ sendError: jest.fn() }));

describe('errorHandler', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('returns a clear client error when an uploaded file exceeds its limit', () => {
    const req = { method: 'POST', url: '/members/member-1/documents' } as Request;
    const res = { headersSent: false } as Response;
    const next = jest.fn() as NextFunction;
    const error = new multer.MulterError('LIMIT_FILE_SIZE', 'file');

    errorHandler(error, req, res, next);

    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      'FILE_TOO_LARGE',
      'Ukuran file melebihi batas maksimal.',
    );
  });
});
