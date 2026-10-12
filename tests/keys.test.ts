import { describe, it, expect } from 'vitest';
import { generateApiKey, computeKeyHmac, verifyKeyHmac } from '../src/lib/client-auth/keys';

describe('API Key Cryptography', () => {
  it('generates unique keys with proper prefix and entropy', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1.rawKey).toMatch(/^ksk_live_[a-f0-9]{64}$/);
    expect(key2.rawKey).toMatch(/^ksk_live_[a-f0-9]{64}$/);
    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyId).toMatch(/^ksk_id_[a-f0-9]{16}$/);
    expect(key1.maskedKey).toMatch(/^ksk_live_••••••••••••[a-f0-9]{4}$/);
  });

  it('correctly verifies HMAC using constant-time comparison', () => {
    const { rawKey, keyHmac } = generateApiKey();
    expect(verifyKeyHmac(rawKey, keyHmac)).toBe(true);
    expect(verifyKeyHmac(rawKey + 'x', keyHmac)).toBe(false);
    expect(verifyKeyHmac('invalid_key', keyHmac)).toBe(false);
  });
});
