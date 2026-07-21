import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  inventoryLedgerQuerySchema,
  issueInventorySchema,
  receiveInventorySchema,
  reverseInventoryPostingSchema,
} from './inventory-ledger.schema';
import {
  issueInventory,
  listInventoryBalances,
  listInventoryPostings,
  receiveInventory,
  reconcileInventory,
  reverseInventoryPosting,
} from './services/inventory-ledger.service';

export class InventoryLedgerController {
  async receive(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await receiveInventory(req.user.userId, receiveInventorySchema.parse(req.body))); } catch (error) { next(error); }
  }
  async issue(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await issueInventory(req.user.userId, issueInventorySchema.parse(req.body))); } catch (error) { next(error); }
  }
  async reverse(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await reverseInventoryPosting(req.user.userId, req.params.postingId, reverseInventoryPostingSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async balances(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listInventoryBalances(req.user.userId, inventoryLedgerQuerySchema.parse(req.query))); } catch (error) { next(error); }
  }
  async postings(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listInventoryPostings(req.user.userId, inventoryLedgerQuerySchema.parse(req.query))); } catch (error) { next(error); }
  }
  async reconcile(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await reconcileInventory(req.user.userId, String(req.query.branchId || ''))); } catch (error) { next(error); }
  }
}

