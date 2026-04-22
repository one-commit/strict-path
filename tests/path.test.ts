import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

describe('plain path (no params)', () => {
  const pathTo = createPaths<{
    '/about': {};
    '/': {};
    '/foo/': {};
  }>();

  it('returns path as declared', () => {
    expect(pathTo('/about')).toBe('/about');
  });

  it('preserves root path', () => {
    expect(pathTo('/')).toBe('/');
  });

  it('preserves trailing slash when declared', () => {
    expect(pathTo('/foo/')).toBe('/foo/');
  });
});
