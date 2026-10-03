import { describe, expect, it } from 'vitest';
import { cn } from './utils.js';

describe('cn', () => {
  it('merges conflicting tailwind classes keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignores falsy values', () => {
    const classesFor = (isActive: boolean) => cn('text-sm', isActive && 'font-bold', undefined);

    expect(classesFor(false)).toBe('text-sm');
    expect(classesFor(true)).toBe('text-sm font-bold');
  });
});
