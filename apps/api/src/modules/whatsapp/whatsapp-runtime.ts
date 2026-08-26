import { randomUUID } from 'crypto';
import { env } from '@config/env';
import { logger } from '@lib/logger';
import { whatsappConnectionManager } from './whatsapp-connection.manager';
import { WhatsAppDeliveryWorker } from './whatsapp.worker';

let timer: NodeJS.Timeout | null = null;
let processing = false;

async function tick(worker: WhatsAppDeliveryWorker, workerId: string): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    for (let count = 0; count < 10; count += 1) {
      if (!await worker.processNext(workerId)) break;
    }
  } catch (error) {
    logger.error('WhatsApp worker tick failed', error);
  } finally {
    processing = false;
  }
}

export async function startWhatsAppRuntime(): Promise<void> {
  if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'BAILEYS') return;
  await whatsappConnectionManager.start();
  if (!env.WHATSAPP_WORKER_ENABLED || timer) return;
  const worker = new WhatsAppDeliveryWorker(whatsappConnectionManager);
  const workerId = `whatsapp-${process.pid}-${randomUUID()}`;
  timer = setInterval(() => void tick(worker, workerId), env.WHATSAPP_WORKER_INTERVAL_MS);
  timer.unref();
  void tick(worker, workerId);
  logger.info('WhatsApp delivery worker started');
}

export async function stopWhatsAppRuntime(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await whatsappConnectionManager.stop();
}
