import { describe, expect, it } from 'vitest';
import { hasIdPrefix, ID_PREFIXES } from './ids.js';

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
});
