import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';
import { apiEnvSchema } from './schemas.js';

const validApiEnv = {
  NODE_ENV: 'test',
  API_PUBLIC_URL: 'http://localhost:4000',
  DATABASE_URL: 'postgresql://user:super-secret-password@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = parseEnv(apiEnvSchema, validApiEnv);

    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.NODE_ENV).toBe('test');
  });

  it('coerces numeric variables', () => {
    const env = parseEnv(apiEnvSchema, { ...validApiEnv, API_PORT: '8080' });

    expect(env.API_PORT).toBe(8080);
  });

  it('reports every invalid variable by name', () => {
    const run = () =>
      parseEnv(apiEnvSchema, { ...validApiEnv, DATABASE_URL: 'mysql://x', REDIS_URL: undefined });

    expect(run).toThrow(EnvValidationError);
    try {
      run();
    } catch (error) {
      const variables = (error as EnvValidationError).issues.map((issue) => issue.variable);
      expect(variables).toEqual(expect.arrayContaining(['DATABASE_URL', 'REDIS_URL']));
    }
  });

  it('never leaks variable values in the error message', () => {
    const secretValue = 'not-a-url-but-a-secret-value';

    try {
      parseEnv(apiEnvSchema, { ...validApiEnv, DATABASE_URL: secretValue });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secretValue);
    }
  });
});
