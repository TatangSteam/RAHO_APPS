import makeWASocket, {
  Browsers,
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { WhatsAppConnectionStatus } from '@prisma/client';
import { env } from '@config/env';
import { logger } from '@lib/logger';
import { prisma } from '@lib/prisma';
import { BaileysWhatsAppProvider } from './baileys-whatsapp.provider';
import type { WhatsAppProvider, WhatsAppSendImageInput } from './whatsapp-provider';
import { maskWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from './whatsapp-phone.util';
import { GLOBAL_WHATSAPP_CONNECTION_ID, loadDatabaseAuthState } from './whatsapp-auth-state.repository';
import type { SessionReportBackgroundKey } from './whatsapp-backgrounds';
import { logAudit } from '@utils/auditLog';

const SYSTEM_ACTOR = 'SYSTEM';

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
        updatedAt: true,
      },
    });
    return {
      enabled: env.WHATSAPP_ENABLED,
      provider: env.WHATSAPP_PROVIDER,
      workerEnabled: env.WHATSAPP_WORKER_ENABLED,
      ready: this.isReady(),
      connection: row ?? { status: WhatsAppConnectionStatus.DISCONNECTED },
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

  async start(actorId = SYSTEM_ACTOR): Promise<void> {
    if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'BAILEYS' || this.socket) return;
    if (this.starting) return this.starting;
    this.stopped = false;
    this.starting = this.createSocket(actorId).finally(() => { this.starting = null; });
    return this.starting;
  }

  async requestPairingCode(phone: string, actorId: string): Promise<string> {
    if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'BAILEYS') {
      throw new Error('Provider WhatsApp Baileys belum diaktifkan');
    }
    const normalized = normalizeIndonesianWhatsAppNumber(phone);
    if (!normalized) throw new Error('Nomor WhatsApp tidak valid');
    if (this.isReady()) throw new Error('WhatsApp sudah terhubung. Logout sebelum mengganti nomor.');
    await this.start(actorId);
    if (!this.socket) throw new Error('Socket WhatsApp gagal dibuat');
    const code = await this.socket.requestPairingCode(normalized);
    await prisma.whatsAppConnection.update({
      where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
      data: {
        status: WhatsAppConnectionStatus.PAIRING,
        phoneMasked: maskWhatsAppNumber(normalized),
        updatedBy: actorId,
        lastErrorSanitized: null,
      },
    });
    return code;
  }

  async logout(actorId: string): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
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
    const socket = this.socket;
    this.socket = null;
    socket?.end(undefined);
  }

  private async createSocket(actorId: string): Promise<void> {
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
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.socket = socket;
    socket.ev.on('creds.update', async (update) => {
      Object.assign(auth.state.creds, update);
      await auth.saveCreds();
    });
    socket.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (socket !== this.socket) return;
      if (connection === 'open') {
        this.connected = true;
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
