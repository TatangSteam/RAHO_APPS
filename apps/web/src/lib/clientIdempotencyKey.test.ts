import { createClientIdempotencyKey } from './clientIdempotencyKey';

describe('createClientIdempotencyKey', () => {
  it('uses randomUUID when the browser supports it', () => {
    const randomUUID = jest.fn(() => '4f142fe4-1c14-44d2-b59c-48a55943bd9d');

    expect(createClientIdempotencyKey({ randomUUID, getRandomValues: jest.fn() })).toBe(
      '4f142fe4-1c14-44d2-b59c-48a55943bd9d',
    );
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('creates a UUID-compatible key when randomUUID is unavailable', () => {
    const getRandomValues = jest.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => {
        bytes[index] = index;
      });
      return bytes;
    });

    expect(createClientIdempotencyKey({ getRandomValues })).toBe(
      '00010203-0405-4607-8809-0a0b0c0d0e0f',
    );
  });

  it('still creates a non-empty key without Web Crypto methods', () => {
    expect(createClientIdempotencyKey({})).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
  });
});
