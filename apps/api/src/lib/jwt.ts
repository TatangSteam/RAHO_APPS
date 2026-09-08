import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { Role } from '@prisma/client';
import {
  getCurrentDatabaseProfileId,
  getCurrentDatabaseRuntimeRevision,
} from '@lib/prisma';

export interface ImpersonationData {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
  adminManagerAccessScope?: string | null;
  branches?: string[];
  impersonating?: ImpersonationData;
}

export interface JwtPayload {
  databaseProfileId?: string;
  databaseRuntimeRevision?: number;
  userId: string;
  email: string;
  role: string;
  branchId: string | null;
  branchCode: string | null;
  adminManagerAccessScope?: string | null;
  fullName: string;
  staffCode: string | null;
  roleTemplateName?: string | null;
  branches?: string[]; // Multi-branch assignment for staff
  impersonating?: ImpersonationData;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function signAccessToken(payload: JwtPayload, expiresIn?: string): string {
  return jwt.sign({
    ...payload,
    databaseProfileId: payload.databaseProfileId || getCurrentDatabaseProfileId(),
    databaseRuntimeRevision: payload.databaseRuntimeRevision
      ?? getCurrentDatabaseRuntimeRevision(),
  }, env.JWT_ACCESS_SECRET, {
    expiresIn: expiresIn || env.JWT_ACCESS_EXPIRES,
    issuer: 'raho-api',
    audience: 'raho-client',
  } as jwt.SignOptions);
}

type RefreshTokenPayload = Pick<
  JwtPayload,
  'userId' | 'email' | 'databaseProfileId' | 'databaseRuntimeRevision'
>;

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign({
    ...payload,
    databaseProfileId: payload.databaseProfileId || getCurrentDatabaseProfileId(),
    databaseRuntimeRevision: payload.databaseRuntimeRevision
      ?? getCurrentDatabaseRuntimeRevision(),
  }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
    issuer: 'raho-api',
    audience: 'raho-client',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'raho-api',
    audience: 'raho-client',
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'raho-api',
    audience: 'raho-client',
  }) as RefreshTokenPayload;
}

export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({
      userId: payload.userId,
      email: payload.email,
      databaseProfileId: payload.databaseProfileId,
      databaseRuntimeRevision: payload.databaseRuntimeRevision,
    }),
  };
}
