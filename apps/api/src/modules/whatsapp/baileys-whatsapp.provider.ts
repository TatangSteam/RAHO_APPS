import type { WASocket } from '@whiskeysockets/baileys';
import type { WhatsAppProvider, WhatsAppSendImageInput } from './whatsapp-provider';

export class BaileysWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly socket: WASocket,
    private readonly connected: () => boolean,
  ) {}

  isReady() {
    return this.connected();
  }

  async sendImage(input: WhatsAppSendImageInput): Promise<{ messageId: string }> {
    if (!this.isReady()) throw new Error('Baileys socket is not connected');
    const result = await this.socket.sendMessage(`${input.recipient}@s.whatsapp.net`, {
      image: input.image,
      caption: input.caption,
    });
    const messageId = result?.key.id;
    if (!messageId) throw new Error('Baileys did not return a message id');
    return { messageId };
  }
}
