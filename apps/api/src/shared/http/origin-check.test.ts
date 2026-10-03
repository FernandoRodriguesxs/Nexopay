import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { assertTrustedOrigin } from './origin-check.js';

const DASHBOARD = 'http://localhost:3000';

describe('assertTrustedOrigin', () => {
  it('allows safe methods from any origin', () => {
    expect(() => {
      assertTrustedOrigin('GET', 'https://evil.example', DASHBOARD);
    }).not.toThrow();
  });

  it('allows unsafe methods from the dashboard origin', () => {
    expect(() => {
      assertTrustedOrigin('POST', DASHBOARD, DASHBOARD);
    }).not.toThrow();
  });

  it.each([
    ['a foreign origin', 'https://evil.example'],
    ['a missing origin', undefined],
    ['a look-alike origin', 'http://localhost:3000.evil.example'],
    ['the literal null origin', 'null'],
  ])('rejects unsafe methods from %s', (_label, origin) => {
    expect(() => {
      assertTrustedOrigin('DELETE', origin, DASHBOARD);
    }).toThrow(AppError);
  });
});
