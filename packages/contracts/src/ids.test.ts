import { describe, expect, it } from 'vitest';
import { hasIdPrefix, ID_PREFIXES, isPublicId, publicIdSchema } from './ids.js';

const VALID_ULID = '01JABCDEFGHJKMNPQRSTVWXYZ0';

describe('public ids', () => {
  it('uses unique prefixes per resource', () => {
    const prefixes = Object.values(ID_PREFIXES);

    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('recognizes ids with the expected prefix', () => {
    expect(hasIdPrefix('pay_01JABC', 'pay')).toBe(true);
    expect(hasIdPrefix('cus_01JABC', 'pay')).toBe(false);
    expect(hasIdPrefix('pay_', 'pay')).toBe(false);
    expect(hasIdPrefix('payment_01JABC', 'pay')).toBe(false);
  });

  it('validates the full <prefix>_<ULID> format', () => {
    expect(isPublicId(`key_${VALID_ULID}`, 'key')).toBe(true);
    expect(isPublicId(`key_${VALID_ULID.toLowerCase()}`, 'key')).toBe(false);
    expect(isPublicId(`key_${VALID_ULID}x`, 'key')).toBe(false);
    expect(isPublicId(`mer_${VALID_ULID}`, 'key')).toBe(false);
    expect(isPublicId(`key_01JABCDEFGHJKMNPQRSTVWXYZI`, 'key')).toBe(false);
  });

  it('exposes a zod schema per prefix', () => {
    const schema = publicIdSchema('mer');

    expect(schema.safeParse(`mer_${VALID_ULID}`).success).toBe(true);
    expect(schema.safeParse(`key_${VALID_ULID}`).success).toBe(false);
  });
});
