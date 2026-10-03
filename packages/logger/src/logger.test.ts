import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { REDACTED } from './redaction.js';

function captureLogger(redactKeys: readonly string[] = []) {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  const logger = createLogger({ service: 'test', level: 'info', destination, redactKeys });
  return { logger, lines };
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

  it('redacts authorization headers and secrets at any supported depth', () => {
    const { logger, lines } = captureLogger();

    logger.info(
      {
        authorization: 'Bearer sk_test_root',
        req: { headers: { authorization: 'Bearer sk_test_nested', 'x-nexopay-signature': 'abc' } },
        endpoint: { signingSecret: 'whsec_123' },
      },
      'sensitive',
    );

    const serialized = JSON.stringify(lines[0]);
    expect(serialized).not.toContain('sk_test_root');
    expect(serialized).not.toContain('sk_test_nested');
    expect(serialized).not.toContain('whsec_123');
    expect(serialized).toContain(REDACTED);
  });

  it('supports additional redaction keys', () => {
    const { logger, lines } = captureLogger(['cpf']);

    logger.info({ customer: { cpf: '12345678900' } }, 'customer');

    expect(JSON.stringify(lines[0])).not.toContain('12345678900');
  });
});
