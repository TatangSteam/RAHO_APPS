import makeWASocket, {
  Browsers,
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import sharp from 'sharp';
import { WhatsAppConnectionStatus } from '@prisma/client';
import { env } from '@config/env';
import { logger } from '@lib/logger';
import { prisma } from '@lib/prisma';
import { BaileysWhatsAppProvider } from './baileys-whatsapp.provider';
import type { WhatsAppProvider, WhatsAppSendImageInput } from './whatsapp-provider';
import { maskWhatsAppNumber } from './whatsapp-phone.util';
import { GLOBAL_WHATSAPP_CONNECTION_ID, loadDatabaseAuthState } from './whatsapp-auth-state.repository';
import type { SessionReportBackgroundKey } from './whatsapp-backgrounds';
import { logAudit } from '@utils/auditLog';
import { uploadFile } from '@config/minio';

const SYSTEM_ACTOR = 'SYSTEM';
const CUSTOM_BACKGROUND_KEY = 'CUSTOM' as const;
const CUSTOM_BACKGROUND_WIDTH = 1080;
const CUSTOM_BACKGROUND_HEIGHT = 1350;
const CUSTOM_BACKGROUND_MIN_WIDTH = 720;
const CUSTOM_BACKGROUND_MIN_HEIGHT = 900;
const CUSTOM_BACKGROUND_MAX_BYTES = 5 * 1024 * 1024;
const CUSTOM_BACKGROUND_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Koneksi WhatsApp terputus';
}

function disconnectCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const output = (error as { output?: { statusCode?: number } }).output;
  return output?.statusCode;
}

class WhatsAppConnectionManager implements WhatsAppProvider {
  private socket: WASocket | null = null;
  private connected = false;
  private starting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private authClear: (() => Promise<void>) | null = null;
  private qrCode: string | null = null;
  private qrRestarting: Promise<void> | null = null;

  isReady(): boolean { return this.connected && this.socket !== null; }

  async sendImage(input: WhatsAppSendImageInput): Promise<{ messageId: string }> {
    if (!this.socket) throw new Error('WhatsApp belum terhubung');
    return new BaileysWhatsAppProvider(this.socket, () => this.connected).sendImage(input);
  }

  async status() {
    const row = await prisma.whatsAppConnection.findUnique({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      select: {
        status: true,
        phoneMasked: true,
        lastConnectedAt: true,
        lastDisconnectedAt: true,
        lastErrorSanitized: true,
        defaultBackgroundKey: true,
        customBackgroundUrl: true,
        customBackgroundObjectKey: true,
        customBackgroundFileName: true,
        customBackgroundMimeType: true,
        customBackgroundFileSize: true,
        customBackgroundWidth: true,
        customBackgroundHeight: true,
        updatedAt: true,
      },
    });
    return {
      enabled: env.WHATSAPP_ENABLED,
      provider: env.WHATSAPP_PROVIDER,
      workerEnabled: env.WHATSAPP_WORKER_ENABLED,
      ready: this.isReady(),
      // QR is intentionally ephemeral and is only exposed by the
      // SUPER_ADMIN-protected connection status endpoint.
      qrCode: this.connected ? null : this.qrCode,
      connection: row ? {
        ...row,
        customBackgroundObjectKey: undefined,
        customBackground: row.customBackgroundUrl ? {
          url: row.customBackgroundUrl,
          fileName: row.customBackgroundFileName,
          mimeType: row.customBackgroundMimeType,
          fileSize: row.customBackgroundFileSize,
          width: row.customBackgroundWidth,
          height: row.customBackgroundHeight,
        } : null,
      } : { status: WhatsAppConnectionStatus.DISCONNECTED },
    };
  }

  async updateDefaultBackground(backgroundKey: SessionReportBackgroundKey, actorId: string): Promise<void> {
    const before = await prisma.whatsAppConnection.upsert({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      create: {
        id: GLOBAL_WHATSAPP_CONNECTION_ID,
        defaultBackgroundKey: backgroundKey,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {},
    });
    if (backgroundKey === CUSTOM_BACKGROUND_KEY && !before.customBackgroundObjectKey) {
      throw {
        status: 400,
        code: 'WHATSAPP_CUSTOM_BACKGROUND_REQUIRED',
        message: 'Upload background custom terlebih dahulu sebelum memilihnya.',
      };
    }
    const updated = await prisma.whatsAppConnection.update({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      data: { defaultBackgroundKey: backgroundKey, updatedBy: actorId },
    });
    await logAudit({
      userId: actorId,
      action: 'UPDATE',
      module: 'WHATSAPP',
      resource: 'WhatsAppConnection',
      resourceId: GLOBAL_WHATSAPP_CONNECTION_ID,
      beforeData: { defaultBackgroundKey: before.defaultBackgroundKey },
      afterData: { defaultBackgroundKey: updated.defaultBackgroundKey },
      description: `Background laporan WhatsApp diubah menjadi ${backgroundKey}.`,
    });
  }

  async uploadCustomBackground(file: Express.Multer.File, actorId: string) {
    if (!CUSTOM_BACKGROUND_MIME_TYPES.has(file.mimetype)) {
      throw {
        status: 400,
        code: 'WHATSAPP_BACKGROUND_INVALID_TYPE',
        message: 'Background hanya menerima JPG, PNG, atau WebP.',
      };
    }
    if (file.size > CUSTOM_BACKGROUND_MAX_BYTES) {
      throw {
        status: 400,
        code: 'WHATSAPP_BACKGROUND_TOO_LARGE',
        message: 'Ukuran background maksimal 5 MB.',
      };
    }

    const metadata = await sharp(file.buffer).rotate().metadata();
    if (!metadata.width || !metadata.height) {
      throw {
        status: 400,
        code: 'WHATSAPP_BACKGROUND_INVALID_IMAGE',
        message: 'Dimensi gambar tidak dapat dibaca.',
      };
    }
    if (metadata.width < CUSTOM_BACKGROUND_MIN_WIDTH || metadata.height < CUSTOM_BACKGROUND_MIN_HEIGHT) {
      throw {
        status: 400,
        code: 'WHATSAPP_BACKGROUND_TOO_SMALL',
        message: `Resolusi minimal ${CUSTOM_BACKGROUND_MIN_WIDTH}×${CUSTOM_BACKGROUND_MIN_HEIGHT} px (rasio 4:5 disarankan).`,
      };
    }

    const normalized = await sharp(file.buffer)
      .rotate()
      .resize(CUSTOM_BACKGROUND_WIDTH, CUSTOM_BACKGROUND_HEIGHT, { fit: 'cover', position: 'centre' })
      .webp({ quality: 90 })
      .toBuffer();
    const objectKey = `uploads/whatsapp/backgrounds/${Date.now()}-${actorId}.webp`;
    const uploaded = await uploadFile(normalized, objectKey, 'image/webp');
    const before = await prisma.whatsAppConnection.findUnique({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      select: { defaultBackgroundKey: true, customBackgroundUrl: true },
    });
    const updated = await prisma.whatsAppConnection.upsert({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      create: {
        id: GLOBAL_WHATSAPP_CONNECTION_ID,
        defaultBackgroundKey: CUSTOM_BACKGROUND_KEY,
        customBackgroundUrl: uploaded.url,
        customBackgroundObjectKey: objectKey,
        customBackgroundFileName: file.originalname,
        customBackgroundMimeType: 'image/webp',
        customBackgroundFileSize: normalized.length,
        customBackgroundWidth: CUSTOM_BACKGROUND_WIDTH,
        customBackgroundHeight: CUSTOM_BACKGROUND_HEIGHT,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        defaultBackgroundKey: CUSTOM_BACKGROUND_KEY,
        customBackgroundUrl: uploaded.url,
        customBackgroundObjectKey: objectKey,
        customBackgroundFileName: file.originalname,
        customBackgroundMimeType: 'image/webp',
        customBackgroundFileSize: normalized.length,
        customBackgroundWidth: CUSTOM_BACKGROUND_WIDTH,
        customBackgroundHeight: CUSTOM_BACKGROUND_HEIGHT,
        updatedBy: actorId,
      },
      select: {
        customBackgroundUrl: true,
        customBackgroundFileName: true,
        customBackgroundMimeType: true,
        customBackgroundFileSize: true,
        customBackgroundWidth: true,
        customBackgroundHeight: true,
      },
    });
    await logAudit({
      userId: actorId,
      action: 'UPDATE',
      module: 'WHATSAPP',
      resource: 'WhatsAppConnection',
      resourceId: GLOBAL_WHATSAPP_CONNECTION_ID,
      beforeData: {
        defaultBackgroundKey: before?.defaultBackgroundKey,
        hadCustomBackground: Boolean(before?.customBackgroundUrl),
      },
      afterData: {
        defaultBackgroundKey: CUSTOM_BACKGROUND_KEY,
        fileSize: updated.customBackgroundFileSize,
        width: updated.customBackgroundWidth,
        height: updated.customBackgroundHeight,
      },
      description: 'Background custom laporan WhatsApp diunggah.',
    });
    return {
      key: CUSTOM_BACKGROUND_KEY,
      url: updated.customBackgroundUrl,
      fileName: updated.customBackgroundFileName,
      mimeType: updated.customBackgroundMimeType,
      fileSize: updated.customBackgroundFileSize,
      width: updated.customBackgroundWidth,
      height: updated.customBackgroundHeight,
    };
  }

  async start(actorId = SYSTEM_ACTOR): Promise<void> {
    if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'BAILEYS' || this.socket) return;
    if (this.starting) return this.starting;
    this.stopped = false;
    this.starting = this.createSocket(actorId).finally(() => { this.starting = null; });
    return this.starting;
  }

  async requestQr(actorId: string): Promise<void> {
    if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'BAILEYS') {
      throw new Error('Provider WhatsApp Baileys belum diaktifkan');
    }
    if (this.isReady()) throw new Error('WhatsApp sudah terhubung. Logout sebelum mengganti nomor.');
    if (this.qrCode) return;
    if (this.qrRestarting) return this.qrRestarting;

    this.qrRestarting = this.restartForQr(actorId).finally(() => {
      this.qrRestarting = null;
    });
    return this.qrRestarting;
  }

  async logout(actorId: string): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    this.qrCode = null;
    if (socket) await socket.logout().catch(() => undefined);
    await this.authClear?.();
    await prisma.whatsAppConnection.upsert({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      create: {
        id: GLOBAL_WHATSAPP_CONNECTION_ID,
        status: WhatsAppConnectionStatus.LOGGED_OUT,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        status: WhatsAppConnectionStatus.LOGGED_OUT,
        phoneMasked: null,
        authStateEncrypted: null,
        lastDisconnectedAt: new Date(),
        updatedBy: actorId,
      },
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.connected = false;
    this.qrCode = null;
    const socket = this.socket;
    this.socket = null;
    socket?.end(undefined);
  }

  private async restartForQr(actorId: string): Promise<void> {
    // A Baileys QR expires after a limited number of refreshes. Recreate the
    // socket on demand so opening the admin page never depends on a QR that
    // was generated earlier during server startup.
    if (this.starting) await this.starting;
    if (this.isReady() || this.qrCode) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const staleSocket = this.socket;
    this.socket = null;
    this.connected = false;
    this.qrCode = null;
    staleSocket?.end(undefined);
    await this.start(actorId);
  }

  private async createSocket(actorId: string): Promise<void> {
    this.qrCode = null;
    const auth = await loadDatabaseAuthState(actorId);
    this.authClear = auth.clear;
    await prisma.whatsAppConnection.update({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      data: { status: WhatsAppConnectionStatus.CONNECTING, updatedBy: actorId },
    });
    const socket = makeWASocket({
      auth: auth.state,
      browser: Browsers.ubuntu('RAHO ERP'),
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      // Baileys otherwise shortens every QR after the first one to 20s.
      qrTimeout: env.WHATSAPP_QR_TIMEOUT_MS,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.socket = socket;
    socket.ev.on('creds.update', async (update) => {
      Object.assign(auth.state.creds, update);
      await auth.saveCreds();
    });
    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (socket !== this.socket) return;
      if (qr) {
        this.qrCode = qr;
        await prisma.whatsAppConnection.update({
          where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
          data: {
            status: WhatsAppConnectionStatus.PAIRING,
            phoneMasked: null,
            lastErrorSanitized: null,
            updatedBy: actorId,
          },
        });
      }
      if (connection === 'open') {
        this.connected = true;
        this.qrCode = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        const ownNumber = auth.state.creds.me?.id?.split(':')[0]?.split('@')[0];
        await prisma.whatsAppConnection.update({
          where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
          data: {
            status: WhatsAppConnectionStatus.CONNECTED,
            phoneMasked: ownNumber ? maskWhatsAppNumber(ownNumber) : undefined,
            lastConnectedAt: new Date(),
            lastErrorSanitized: null,
            updatedBy: SYSTEM_ACTOR,
          },
        });
        logger.info('WhatsApp Baileys connected');
      }
      if (connection === 'close') {
        this.connected = false;
        this.qrCode = null;
        this.socket = null;
        const code = disconnectCode(lastDisconnect?.error);
        const loggedOut = code === DisconnectReason.loggedOut;
        await prisma.whatsAppConnection.update({
          where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
          data: {
            status: loggedOut ? WhatsAppConnectionStatus.LOGGED_OUT : WhatsAppConnectionStatus.RECONNECTING,
            lastDisconnectedAt: new Date(),
            lastErrorSanitized: safeError(lastDisconnect?.error),
            updatedBy: SYSTEM_ACTOR,
          },
        });
        if (!loggedOut && !this.stopped) {
          this.reconnectTimer = setTimeout(() => void this.start(), 5_000);
        }
      }
    });
  }
}

export const whatsappConnectionManager = new WhatsAppConnectionManager();
