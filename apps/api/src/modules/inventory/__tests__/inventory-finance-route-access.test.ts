import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import inventoryRouter from '../inventory.routes';

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      handle: (req: Request, res: Response, next: NextFunction) => unknown;
    }>;
  };
};

const readRoutes = [
  '/uoms',
  '/batches',
  '/items',
  '/ledger/balances',
  '/ledger/postings',
];

function getRoleGuard(path: string) {
  const layers = (inventoryRouter as unknown as { stack: RouteLayer[] }).stack;
  const layer = layers.find((candidate) => (
    candidate.route?.path === path && candidate.route.methods.get
  ));

  if (!layer?.route?.stack[1]) {
    throw new Error(`Role guard untuk GET ${path} tidak ditemukan`);
  }

  return layer.route.stack[1].handle;
}

function mockResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('Finance & Logistics Controller inventory route access', () => {
  it.each(readRoutes)('allows Finance to read %s', async (path) => {
    const guard = getRoleGuard(path);
    const request = {
      user: { role: Role.FINANCE_LOGISTICS_CONTROLLER },
      params: {},
      query: {},
      body: {},
    } as unknown as Request;
    const response = mockResponse();
    const next = jest.fn();

    await guard(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each(readRoutes)('continues to reject members from %s', async (path) => {
    const guard = getRoleGuard(path);
    const request = {
      user: { role: Role.MEMBER },
      params: {},
      query: {},
      body: {},
    } as unknown as Request;
    const response = mockResponse();
    const next = jest.fn();

    await guard(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });
});
