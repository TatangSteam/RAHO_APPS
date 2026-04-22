import jwt from 'jsonwebtoken';
import { env } from '@config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  branchId: string | null;
  branchCode: string | null;
  fullName: string;
  staffCode: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
    issuer: 'raho-api',
    audience: 'raho-client',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Pick<JwtPayload, 'userId' | 'email'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
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

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'userId' | 'email'> {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'raho-api',
    audience: 'raho-client',
  }) as Pick<JwtPayload, 'userId' | 'email'>;
}

export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ userId: payload.userId, email: payload.email }),
  };
}
