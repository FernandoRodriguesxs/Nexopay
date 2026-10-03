import { isPublicId } from '@nexopay/contracts';
import { describe, expect, it } from 'vitest';
import { generateId, ulid } from './generate-id.js';

describe('ulid', () => {
  it('produces 26 Crockford base32 characters', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('encodes the timestamp so ids sort by creation time', () => {
    const random = new Uint8Array(10).fill(255);
    const earlier = ulid(1_000, random);
    const later = ulid(2_000, new Uint8Array(10));

    expect(earlier < later).toBe(true);
  });

  it('matches the reference encoding for a known timestamp', () => {
    expect(ulid(1_469_918_176_385, new Uint8Array(10)).slice(0, 10)).toBe('01ARYZ6S41');
  });

  it('rejects timestamps outside the 48-bit range', () => {
    expect(() => ulid(-1)).toThrow(RangeError);
    expect(() => ulid(2 ** 48)).toThrow(RangeError);
  });
});

describe('generateId', () => {
  it('prefixes the ULID with the resource prefix', () => {
    const id = generateId('key');

    expect(isPublicId(id, 'key')).toBe(true);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => generateId('req')));

    expect(ids.size).toBe(1_000);
  });
});
