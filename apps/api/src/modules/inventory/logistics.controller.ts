import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendSuccess } from '../../utils/response';
import { LogisticsService } from './logistics.service';

const logisticsService = new LogisticsService();

export class LogisticsController {
  private query<T>(req: Request): T {
    return req.query as unknown as T;
  }

  private actor(req: Request) {
    return {
      userId: req.user!.userId,
      role: req.user!.role as Role,
      branchId: req.user!.branchId,
    };
  }

  async getCentralStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.getCentralStock(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listHomecareBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBranches(this.actor(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listHomecareStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareStaff(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createBranchStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.createBranchStockRequest(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async approveBranchStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.approveBranchStockRequest(this.actor(req), req.params.requestId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async rejectBranchStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.rejectBranchStockRequest(this.actor(req), req.params.requestId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async shipBranchShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.shipBranchShipment(this.actor(req), req.params.shipmentId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async receiveBranchShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.receiveBranchShipment(this.actor(req), req.params.shipmentId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createHomecareTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.createHomecareTeam(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateHomecareTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.updateHomecareTeam(this.actor(req), req.params.teamId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listHomecareTeams(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareTeams(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async addHomecareTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.addHomecareTeamMember(this.actor(req), req.params.teamId, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async removeHomecareTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.removeHomecareTeamMember(
        this.actor(req),
        req.params.teamId,
        req.params.userId,
        req.body,
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteHomecareTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.deleteHomecareTeam(this.actor(req), req.params.teamId);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createHomecareBag(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.createHomecareBag(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateHomecareBag(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.updateHomecareBag(this.actor(req), req.params.bagId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async assignHomecareBag(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.assignHomecareBag(this.actor(req), req.params.bagId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteHomecareBag(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.deleteHomecareBag(this.actor(req), req.params.bagId);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listHomecareBags(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBags(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getBagStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.getBagStock(this.actor(req), req.params.bagId);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createBagStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.createBagStockRequest(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async listBagStockRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBagRequests(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async approveBagStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.approveBagStockRequest(this.actor(req), req.params.requestId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async rejectBagStockRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.rejectBagStockRequest(this.actor(req), req.params.requestId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async shipBagShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.shipBagShipment(this.actor(req), req.params.shipmentId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listBagShipments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBagShipments(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async receiveBagShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.receiveBagShipment(this.actor(req), req.params.shipmentId, req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async useBagStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.useBagStock(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async listBagUsages(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBagUsages(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getHomecareUsageHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.getHomecareUsageHistory(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async exportHomecareUsageHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.exportHomecareUsageHistory(this.actor(req), this.query(req));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer.length);
      return res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  async returnBagStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.returnBagStock(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async listBagReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBagReturns(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createBagOpname(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.createBagOpname(this.actor(req), req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async listBagOpnames(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await logisticsService.listHomecareBagOpnames(this.actor(req), this.query(req));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
