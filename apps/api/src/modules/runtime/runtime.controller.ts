import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  activateDatabaseProfile,
  getActiveDatabaseProfileId,
  listDatabaseProfiles,
  runWithActiveDatabase,
} from '@lib/prisma';
import { logger } from '@lib/logger';
import { AppError } from '@middleware/errorHandler';
import { sendSuccess } from '@utils/response';
import {
  startWhatsAppRuntime,
  stopWhatsAppRuntime,
} from '@modules/whatsapp/whatsapp-runtime';
import * as runtimeService from './runtime.service';

const databaseProfileSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/i),
  label: z.string().trim().min(2).max(80),
  url: z.string().trim().min(10).max(2_000),
});

const zohoApiProfileSchema = z.object({
  label: z.string().trim().min(2).max(80),
  clientId: z.string().trim().min(5).max(500),
  clientSecret: z.string().trim().min(5).max(1_000),
  redirectUri: z.string().trim().url().max(1_000),
  accountsBaseUrl: z.string().trim().url().max(500).default('https://accounts.zoho.com'),
  apiBaseUrl: z.string().trim().url().max(500).default('https://www.zohoapis.com'),
});

export async function databases(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, {
      activeProfileId: getActiveDatabaseProfileId(),
      profiles: await runtimeService.getDatabaseProfiles(),
    });
  } catch (error) {
    next(error);
  }
}

export async function addDatabase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = databaseProfileSchema.parse(req.body);
    const profiles = await runtimeService.addDatabaseProfile({
      id: input.id!,
      label: input.label!,
      url: input.url!,
      actor: req.user.email,
    });
    sendSuccess(res, {
      activeProfileId: getActiveDatabaseProfileId(),
      profiles,
    }, 201);
  } catch (error) {
    next(error);
  }
}

export async function activateDatabase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await runtimeService.hydrateDatabaseProfiles();
    const profileId = typeof req.body?.profileId === 'string' ? req.body.profileId.trim() : '';
    const target = listDatabaseProfiles().find((profile) => profile.id === profileId);
    if (!target) {
      throw new AppError(400, 'DATABASE_PROFILE_INVALID', 'Profile database tidak tersedia.');
    }

    const previousProfileId = getActiveDatabaseProfileId();
    // The WhatsApp socket and its callbacks are database-bound. Restart it so
    // an old socket can never persist auth/session state into the new database.
    await stopWhatsAppRuntime();
    try {
      await activateDatabaseProfile(profileId);
    } catch (error) {
      await runWithActiveDatabase(() => startWhatsAppRuntime()).catch((restartError) => {
        logger.error('WhatsApp runtime failed to recover after database switch failure', restartError);
      });
      throw error;
    }
    await runWithActiveDatabase(() => startWhatsAppRuntime()).catch((error) => {
      logger.error('WhatsApp runtime failed to start after database switch', error);
    });
    logger.warn('Active database profile changed at runtime', {
      actorUserId: req.user.userId,
      actorEmail: req.user.email,
      previousProfileId,
      activeProfileId: profileId,
    });

    sendSuccess(res, {
      activeProfileId: profileId,
      profiles: listDatabaseProfiles(),
      reauthenticationRequired: previousProfileId !== profileId,
    });
  } catch (error) {
    next(error);
  }
}

export async function zohoApiProfiles(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(res, await runtimeService.listZohoApiProfiles());
  } catch (error) {
    next(error);
  }
}

export async function addZohoApiProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = zohoApiProfileSchema.parse(req.body);
    sendSuccess(res, await runtimeService.addZohoApiProfile({
      label: input.label!,
      clientId: input.clientId!,
      clientSecret: input.clientSecret!,
      redirectUri: input.redirectUri!,
      accountsBaseUrl: input.accountsBaseUrl!,
      apiBaseUrl: input.apiBaseUrl!,
      actor: req.user.email,
    }), 201);
  } catch (error) {
    next(error);
  }
}

export async function activateZohoApiProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(
      res,
      await runtimeService.activateZohoApiProfile(req.params.id, req.user.email),
    );
  } catch (error) {
    next(error);
  }
}
