import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/app-error.js';
import { assertApiKeyUsable, LAST_USED_THROTTLE_MS, shouldTouchLastUsed } from './api-key.js';

const now = new Date('2026-10-03T12:00:00.000Z');

function codeOf(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error.code : 'unexpected';
  }
}

describe('assertApiKeyUsable', () => {
  it('accepts an active key used in its own environment', () => {
    expect(
      codeOf(() => {
        assertApiKeyUsable({ environment: 'SANDBOX', revokedAt: null }, 'SANDBOX');
      }),
    ).toBeUndefined();
  });

  it('rejects revoked keys', () => {
    expect(
      codeOf(() => {
        assertApiKeyUsable({ environment: 'SANDBOX', revokedAt: now }, 'SANDBOX');
      }),
    ).toBe('API_KEY_REVOKED');
  });

  it('rejects keys whose prefix does not match the stored environment', () => {
    expect(
      codeOf(() => {
        assertApiKeyUsable({ environment: 'PRODUCTION', revokedAt: null }, 'SANDBOX');
      }),
    ).toBe('INVALID_API_KEY');
  });
});

describe('shouldTouchLastUsed', () => {
  it('touches keys never used before', () => {
    expect(shouldTouchLastUsed({ lastUsedAt: null }, now)).toBe(true);
  });

  it('throttles updates to once per minute', () => {
    const recently = new Date(now.getTime() - LAST_USED_THROTTLE_MS + 1);
    const longAgo = new Date(now.getTime() - LAST_USED_THROTTLE_MS);

    expect(shouldTouchLastUsed({ lastUsedAt: recently }, now)).toBe(false);
    expect(shouldTouchLastUsed({ lastUsedAt: longAgo }, now)).toBe(true);
  });
});
