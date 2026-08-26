import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { prisma } from '@lib/prisma';
import { decryptWhatsAppValue, encryptWhatsAppValue } from './whatsapp.crypto';

export const GLOBAL_WHATSAPP_CONNECTION_ID = 'whatsapp_global';

type StoredKeys = Partial<{
  [T in keyof SignalDataTypeMap]: Record<string, SignalDataTypeMap[T]>;
}>;

interface StoredAuthState {
  creds: AuthenticationCreds;
  keys: StoredKeys;
}

function serialize(value: StoredAuthState): string {
  return JSON.stringify(value, BufferJSON.replacer);
}

function deserialize(value: string): StoredAuthState {
  return JSON.parse(value, BufferJSON.reviver) as StoredAuthState;
}

export async function loadDatabaseAuthState(actorId = 'SYSTEM'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
}> {
  const connection = await prisma.whatsAppConnection.upsert({
    where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
    create: { id: GLOBAL_WHATSAPP_CONNECTION_ID, createdBy: actorId, updatedBy: actorId },
    update: {},
  });
  const stored = connection.authStateEncrypted
    ? deserialize(decryptWhatsAppValue(connection.authStateEncrypted))
    : { creds: initAuthCreds(), keys: {} };

  let writeChain = Promise.resolve();
  const persist = (): Promise<void> => {
    writeChain = writeChain.then(async () => {
      await prisma.whatsAppConnection.update({
        where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
        data: {
          authStateEncrypted: encryptWhatsAppValue(serialize(stored)),
          updatedBy: actorId,
        },
      });
    });
    return writeChain;
  };

  const state: AuthenticationState = {
    creds: stored.creds,
    keys: {
      async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        const bucket = stored.keys[type] as Record<string, SignalDataTypeMap[T]> | undefined;
        for (const id of ids) {
          let value = bucket?.[id];
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value) as unknown as SignalDataTypeMap[T];
          }
          if (value) result[id] = value;
        }
        return result;
      },
      async set(data: SignalDataSet) {
        for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          const changes = data[type] as Record<string, SignalDataTypeMap[typeof type] | null>;
          const bucket = (stored.keys[type] ?? {}) as Record<string, SignalDataTypeMap[typeof type]>;
          for (const [id, value] of Object.entries(changes)) {
            if (value === null) delete bucket[id];
            else bucket[id] = value;
          }
          stored.keys[type] = bucket as never;
        }
        await persist();
      },
      async clear() {
        stored.keys = {};
        await persist();
      },
    },
  };

  return {
    state,
    saveCreds: persist,
    async clear() {
      stored.creds = initAuthCreds();
      stored.keys = {};
      await prisma.whatsAppConnection.update({
        where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
        data: { authStateEncrypted: null, updatedBy: actorId },
      });
    },
  };
}
