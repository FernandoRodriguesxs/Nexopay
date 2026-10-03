import { describe, expect, it } from 'vitest';
import { parseClientRequestId } from './request-middlewares.js';

describe('parseClientRequestId', () => {
  it('accepts short ids with a restricted charset', () => {
    expect(parseClientRequestId('trace-01J9Z.abc:42_x')).toBe('trace-01J9Z.abc:42_x');
  });

  it.each([
    ['line breaks (log injection)', 'abc\ninjected'],
    ['spaces', 'abc def'],
    ['quotes', 'abc"}'],
    ['an empty value', ''],
    ['oversized values', 'a'.repeat(129)],
  ])('rejects %s', (_label, value) => {
    expect(parseClientRequestId(value)).toBeUndefined();
  });

  it('ignores repeated headers', () => {
    expect(parseClientRequestId(['a', 'b'])).toBeUndefined();
  });
});
