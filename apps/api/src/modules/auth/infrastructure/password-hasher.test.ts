import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

const hasher = new PasswordHasher();

describe('PasswordHasher (Argon2id)', () => {
  it('produces a PHC string with argon2id and OWASP parameters', async () => {
    const encoded = await hasher.hash('correct horse battery staple');

    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    expect(encoded).not.toContain('correct horse');
  });

  it('uses a random salt per hash', async () => {
    const first = await hasher.hash('same-password-123');
    const second = await hasher.hash('same-password-123');

    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const encoded = await hasher.hash('correct horse battery staple');

    await expect(hasher.verify('correct horse battery staple', encoded)).resolves.toBe(true);
    await expect(hasher.verify('correct horse battery stapl', encoded)).resolves.toBe(false);
  });

  it('rejects malformed hashes instead of throwing', async () => {
    await expect(hasher.verify('anything', 'plaintext-password')).resolves.toBe(false);
    await expect(hasher.verify('anything', '$argon2i$v=19$m=1,t=1,p=1$aa$bb')).resolves.toBe(false);
  });

  it('flags hashes created with outdated parameters for rehash', async () => {
    const encoded = await hasher.hash('correct horse battery staple');
    const outdated = encoded.replace('m=19456,t=2', 'm=8192,t=2');

    expect(hasher.needsRehash(encoded)).toBe(false);
    expect(hasher.needsRehash(outdated)).toBe(true);
  });

  it('always fails dummy verification', async () => {
    await expect(hasher.verifyAgainstDummy('whatever')).resolves.toBe(false);
  });
});
