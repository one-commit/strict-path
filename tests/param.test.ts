import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

describe('local param {name}', () => {
  const pathTo = createPaths<{
    '/users/{id}': { param: { id: number } };
    '/a/{x}/b/{y}': { param: { x: number; y: number } };
    '/s/{q}': { param: { q: string } };
    '/flag/{active}': { param: { active: boolean } };
  }>();

  it('substitutes a single param', () => {
    expect(pathTo('/users/{id}', { param: { id: 1 } })).toBe('/users/1');
  });

  it('substitutes multiple params', () => {
    expect(pathTo('/a/{x}/b/{y}', { param: { x: 1, y: 2 } })).toBe('/a/1/b/2');
  });

  it('encodes special characters in param values', () => {
    expect(pathTo('/s/{q}', { param: { q: 'a&b c' } })).toBe('/s/a%26b%20c');
  });

  it('encodes unicode characters', () => {
    expect(pathTo('/s/{q}', { param: { q: '한글' } })).toBe(
      '/s/%ED%95%9C%EA%B8%80',
    );
  });

  it('coerces number to string', () => {
    expect(pathTo('/users/{id}', { param: { id: 42 } })).toBe('/users/42');
  });

  it('coerces boolean to string', () => {
    expect(pathTo('/flag/{active}', { param: { active: true } })).toBe(
      '/flag/true',
    );
  });

  it('throws with descriptive message when a required param is missing', () => {
    expect(() =>
      // @ts-expect-error — intentionally missing required param to test runtime guard
      pathTo('/users/{id}', { param: {} }),
    ).toThrow(/Missing param "id" for path "\/users\/\{id\}"/);
  });

  it('rejects "/" in a single param value with guidance toward catch-all', () => {
    expect(() => pathTo('/s/{q}', { param: { q: 'a/b' } })).toThrow(
      /contains "\/"/,
    );
    expect(() => pathTo('/s/{q}', { param: { q: 'a/b' } })).toThrow(
      /use catch-all/,
    );
  });
});

describe('catch-all param {...name}', () => {
  const pathTo = createPaths<{
    '/docs/{...path}': { param: { path: string[] } };
    '/users/{id}/{...rest}': {
      param: { id: number; rest: string[] };
    };
    '/x/{...slug}': { param: { slug: string[] } };
  }>();

  it('joins array segments with "/"', () => {
    expect(pathTo('/docs/{...path}', { param: { path: ['a', 'b'] } })).toBe(
      '/docs/a/b',
    );
  });

  it('encodes each segment independently', () => {
    expect(pathTo('/docs/{...path}', { param: { path: ['a b', 'c&d'] } })).toBe(
      '/docs/a%20b/c%26d',
    );
  });

  it('combines with a regular param', () => {
    expect(
      pathTo('/users/{id}/{...rest}', {
        param: { id: 1, rest: ['posts', 'latest'] },
      }),
    ).toBe('/users/1/posts/latest');
  });

  it('handles empty array as empty segment list', () => {
    expect(pathTo('/docs/{...path}', { param: { path: [] } })).toBe('/docs/');
  });

  it('accepts a plain string array for catch-all', () => {
    expect(pathTo('/x/{...slug}', { param: { slug: ['a', 'b', 'c'] } })).toBe(
      '/x/a/b/c',
    );
  });

  it('throws when catch-all param is missing', () => {
    expect(() =>
      // @ts-expect-error — intentionally missing
      pathTo('/docs/{...path}', { param: {} }),
    ).toThrow(/Missing catch-all param "path"/);
  });

  it('throws when catch-all value is not an array', () => {
    expect(() =>
      // @ts-expect-error — not an array
      pathTo('/docs/{...path}', { param: { path: 'not-array' } }),
    ).toThrow(/must be an array/);
  });
});
