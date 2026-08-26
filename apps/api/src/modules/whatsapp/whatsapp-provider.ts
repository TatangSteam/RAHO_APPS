export interface WhatsAppSendImageInput {
  recipient: string;
  image: Buffer;
  caption: string;
}

export interface WhatsAppProvider {
  isReady(): boolean;
  sendImage(input: WhatsAppSendImageInput): Promise<{ messageId: string }>;
}

export class DisabledWhatsAppProvider implements WhatsAppProvider {
  isReady() { return false; }

  async sendImage(): Promise<{ messageId: string }> {
    throw new Error('WhatsApp provider is not connected');
  }
}
