import { describe, expect, it } from 'vitest';
import {
  isSessionActive,
  renewSession,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_RENEW_INTERVAL_MS,
  shouldRenewSession,
  startSession,
} from './session-policy.js';

const start = new Date('2026-10-03T12:00:00.000Z');
const after = (ms: number) => new Date(start.getTime() + ms);

describe('session policy', () => {
  it('starts active with idle and absolute expirations', () => {
    const session = startSession(start);

    expect(session.expiresAt).toEqual(after(SESSION_IDLE_TTL_MS));
    expect(session.absoluteExpiresAt).toEqual(after(SESSION_ABSOLUTE_TTL_MS));
    expect(isSessionActive(session, start)).toBe(true);
  });

  it('expires after the idle timeout', () => {
    const session = startSession(start);

    expect(isSessionActive(session, after(SESSION_IDLE_TTL_MS))).toBe(false);
  });

  it('is inactive once revoked', () => {
    const session = { ...startSession(start), revokedAt: after(1) };

    expect(isSessionActive(session, after(2))).toBe(false);
  });

  it('renews only after the renew interval', () => {
    const session = startSession(start);

    expect(shouldRenewSession(session, after(SESSION_RENEW_INTERVAL_MS - 1))).toBe(false);
    expect(shouldRenewSession(session, after(SESSION_RENEW_INTERVAL_MS))).toBe(true);
  });

  it('slides the idle expiration forward when renewed', () => {
    const renewedAt = after(SESSION_IDLE_TTL_MS - 1000);
    const renewed = renewSession(startSession(start), renewedAt);

    expect(renewed.expiresAt).toEqual(new Date(renewedAt.getTime() + SESSION_IDLE_TTL_MS));
    expect(isSessionActive(renewed, after(SESSION_IDLE_TTL_MS + 1000))).toBe(true);
  });

  it('never renews beyond the absolute expiration', () => {
    const renewedAt = after(SESSION_ABSOLUTE_TTL_MS - 1000);
    const renewed = renewSession(startSession(start), renewedAt);

    expect(renewed.expiresAt).toEqual(after(SESSION_ABSOLUTE_TTL_MS));
    expect(isSessionActive(renewed, after(SESSION_ABSOLUTE_TTL_MS))).toBe(false);
  });
});
