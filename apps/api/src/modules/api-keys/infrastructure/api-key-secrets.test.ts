import type { ApiEnv } from '@nexopay/config';
import { describe, expect, it } from 'vitest';
import { ApiKeySecrets, apiKeyHint, parseApiKeyEnvironment } from './api-key-secrets.js';

function secretsWithPepper(pepper: string): ApiKeySecrets {
  return new ApiKeySecrets({ API_KEY_PEPPER: pepper } as ApiEnv);
}

const secrets = secretsWithPepper('test-pepper-with-at-least-32-characters!!');

describe('ApiKeySecrets', () => {
  it('generates sandbox keys with 43 base62 characters after the prefix', () => {
    const { secret } = secrets.generate('SANDBOX');

    expect(secret).toMatch(/^sk_test_[0-9A-Za-z]{43}$/);
  });

  it('generates production keys with the live prefix', () => {
    expect(secrets.generate('PRODUCTION').secret).toMatch(/^sk_live_/);
  });

  it('never returns a hash or hint that contains the secret', () => {
    const { secret, hash, hint } = secrets.generate('SANDBOX');
    const randomPart = secret.slice('sk_test_'.length);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(randomPart);
    expect(hint).toBe(`sk_test_…${secret.slice(-4)}`);
    expect(hint).not.toContain(randomPart.slice(0, 8));
  });

  it('hashes deterministically so the key can be looked up', () => {
    const { secret, hash } = secrets.generate('SANDBOX');

    expect(secrets.hash(secret)).toBe(hash);
  });

  it('depends on the pepper (a database dump alone is not enough)', () => {
    const { secret, hash } = secrets.generate('SANDBOX');
    const otherPepper = secretsWithPepper('another-pepper-with-at-least-32-characters');

    expect(otherPepper.hash(secret)).not.toBe(hash);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 200 }, () => secrets.generate('SANDBOX').secret));

    expect(keys.size).toBe(200);
  });
});

describe('parseApiKeyEnvironment', () => {
  it('derives the environment from the prefix', () => {
    expect(parseApiKeyEnvironment(`sk_test_${'a'.repeat(43)}`)).toBe('SANDBOX');
    expect(parseApiKeyEnvironment(`sk_live_${'a'.repeat(43)}`)).toBe('PRODUCTION');
  });

  it.each([
    ['unknown prefixes', `pk_test_${'a'.repeat(43)}`],
    ['short secrets', `sk_test_${'a'.repeat(42)}`],
    ['long secrets', `sk_test_${'a'.repeat(44)}`],
    ['non-base62 characters', `sk_test_${'a'.repeat(42)}-`],
    ['surrounding whitespace', ` sk_test_${'a'.repeat(43)}`],
  ])('rejects %s', (_label, value) => {
    expect(parseApiKeyEnvironment(value)).toBeNull();
  });
});

describe('apiKeyHint', () => {
  it('keeps only the prefix and the last 4 characters', () => {
    expect(apiKeyHint(`sk_live_${'x'.repeat(39)}a1b2`)).toBe('sk_live_…a1b2');
  });
});
