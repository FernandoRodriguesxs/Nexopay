import { describe, expect, it } from 'vitest';
import { NexoPay } from './client.js';
import { NexoPayConfigurationError } from './errors.js';

describe('NexoPay client', () => {
  it('detects sandbox from sk_test_ keys', () => {
    const client = new NexoPay({ apiKey: 'sk_test_abc123' });

    expect(client.environment).toBe('sandbox');
  });

  it('detects production from sk_live_ keys', () => {
    const client = new NexoPay({ apiKey: 'sk_live_abc123' });

    expect(client.environment).toBe('production');
  });

  it('rejects keys with an unknown prefix', () => {
    expect(() => new NexoPay({ apiKey: 'pk_test_abc' })).toThrow(NexoPayConfigurationError);
  });

  it('normalizes the base url', () => {
    const client = new NexoPay({ apiKey: 'sk_test_abc', baseUrl: 'http://localhost:4000/' });

    expect(client.baseUrl).toBe('http://localhost:4000');
  });

  it('never serializes the api key', () => {
    const client = new NexoPay({ apiKey: 'sk_test_super_secret' });

    expect(JSON.stringify(client)).not.toContain('sk_test_super_secret');
  });
});
