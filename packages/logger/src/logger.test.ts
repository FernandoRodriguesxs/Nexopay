import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { REDACTED, scrubString } from './redaction.js';

const API_KEY = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc4eC39HqLyjWDarjtT1z';

function captureLogger(
  options: { redactKeys?: readonly string[]; context?: () => Record<string, unknown> } = {},
) {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  const logger = createLogger({ service: 'test', level: 'info', destination, ...options });
  return { logger, lines, output: () => JSON.stringify(lines) };
}

describe('createLogger', () => {
  it('emits structured JSON with service, level and message', () => {
    const { logger, lines } = captureLogger();

    logger.info({ requestId: 'req_123' }, 'request completed');

    expect(lines[0]).toMatchObject({
      service: 'test',
      level: 'info',
      message: 'request completed',
      requestId: 'req_123',
    });
  });

  it('redacts authorization headers and secrets at any depth', () => {
    const { logger, output } = captureLogger();

    logger.info(
      {
        authorization: 'Bearer root-token',
        req: { headers: { Authorization: 'Bearer nested', 'x-nexopay-signature': 'abc' } },
        a: { b: { c: { d: { e: { cookie: 'np_session=deep-cookie' } } } } },
        endpoint: { signingSecret: 'whsec_123' },
      },
      'sensitive',
    );

    const serialized = output();
    expect(serialized).not.toContain('root-token');
    expect(serialized).not.toContain('nested');
    expect(serialized).not.toContain('deep-cookie');
    expect(serialized).not.toContain('whsec_123');
    expect(serialized).toContain(REDACTED);
  });

  it('redacts personal data keys regardless of casing or separators', () => {
    const { logger, output } = captureLogger();

    logger.info(
      { user: { Email: 'dev@example.com', tax_id: '12345678900', PASSWORD: 'p' } },
      'pii',
    );

    expect(output()).not.toContain('dev@example.com');
    expect(output()).not.toContain('12345678900');
  });

  it('removes API keys embedded in messages, strings and errors', () => {
    const { logger, output } = captureLogger();
    const error = new Error(`Lookup failed for ${API_KEY}`, {
      cause: new Error(`cause ${API_KEY}`),
    });

    logger.error({ err: error, note: `header was Bearer ${API_KEY}` }, `failed for ${API_KEY}`);

    expect(output()).not.toContain(API_KEY);
    expect(output()).not.toContain('4eC39HqLyjWDarjtT1zdp7dc');
  });

  it('keeps the error type and message shape', () => {
    const { logger, lines } = captureLogger();

    logger.error({ err: new TypeError('boom') }, 'failed');

    expect(lines[0]?.err).toMatchObject({ type: 'TypeError', message: 'boom' });
  });

  it('handles circular structures', () => {
    const { logger, lines } = captureLogger();
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    logger.info({ circular }, 'circular');

    expect(lines[0]?.circular).toEqual({ name: 'loop', self: '[Circular]' });
  });

  it('supports additional redaction keys', () => {
    const { logger, output } = captureLogger({ redactKeys: ['documentNumber'] });

    logger.info({ customer: { documentNumber: '12345678900' } }, 'customer');

    expect(output()).not.toContain('12345678900');
  });

  it('adds context fields to every line', () => {
    const { logger, lines } = captureLogger({ context: () => ({ requestId: 'req_ctx' }) });

    logger.info('with context');

    expect(lines[0]).toMatchObject({ requestId: 'req_ctx' });
  });

  it('does not mutate the logged object', () => {
    const { logger } = captureLogger();
    const payload = { password: 'kept-in-memory' };

    logger.info(payload, 'mutation');

    expect(payload.password).toBe('kept-in-memory');
  });
});

describe('scrubString', () => {
  it('masks credentials inside connection strings', () => {
    expect(scrubString('postgresql://nexopay:s3cr3t@db:5432/app')).toBe(
      `postgresql://nexopay:${REDACTED}@db:5432/app`,
    );
  });

  it('masks API keys and webhook secrets', () => {
    expect(scrubString(`key=${API_KEY} whsec_abc123`)).toBe(`key=${REDACTED} ${REDACTED}`);
  });
});
