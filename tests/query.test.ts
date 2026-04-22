import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

describe('query string', () => {
  it('builds a single query', () => {
    const pathTo = createPaths<{ '/s': { query: { q: string } } }>();
    expect(pathTo('/s', { query: { q: 'foo' } })).toBe('/s?q=foo');
  });

  it('builds multiple queries in insertion order', () => {
    const pathTo = createPaths<{
      '/s': { query: { q: string; page: number } };
    }>();
    expect(pathTo('/s', { query: { q: 'foo', page: 2 } })).toBe(
      '/s?q=foo&page=2',
    );
  });

  it('omits undefined values (fields declared optional with `?`)', () => {
    const pathTo = createPaths<{
      '/s': { query: { q: string; page?: number } };
    }>();
    expect(pathTo('/s', { query: { q: 'foo', page: undefined } })).toBe(
      '/s?q=foo',
    );
  });

  it('omits empty strings by default', () => {
    const pathTo = createPaths<{ '/s': { query: { q: string } } }>();
    expect(pathTo('/s', { query: { q: '' } })).toBe('/s');
  });

  it('encodes special characters in values', () => {
    const pathTo = createPaths<{ '/s': { query: { q: string } } }>();
    expect(pathTo('/s', { query: { q: 'a&b c' } })).toBe('/s?q=a%26b%20c');
  });

  it('serializes booleans as "true"/"false" by default', () => {
    const pathTo = createPaths<{ '/s': { query: { active: boolean } } }>();
    expect(pathTo('/s', { query: { active: true } })).toBe('/s?active=true');
    expect(pathTo('/s', { query: { active: false } })).toBe('/s?active=false');
  });

  it('serializes arrays with repeat style by default', () => {
    const pathTo = createPaths<{ '/s': { query: { t: string[] } } }>();
    expect(pathTo('/s', { query: { t: ['a', 'b'] } })).toBe('/s?t=a&t=b');
  });

  it('serializes arrays with repeat style when configured', () => {
    const pathTo = createPaths<{ '/s': { query: { t: string[] } } }>({
      querySerialization: { array: 'repeat' },
    });
    expect(pathTo('/s', { query: { t: ['a', 'b'] } })).toBe('/s?t=a&t=b');
  });

  it('serializes arrays with comma style when configured', () => {
    const pathTo = createPaths<{ '/s': { query: { t: string[] } } }>({
      querySerialization: { array: 'comma' },
    });
    expect(pathTo('/s', { query: { t: ['a', 'b'] } })).toBe('/s?t=a,b');
  });

  it('serializes booleans as flag when configured', () => {
    const pathTo = createPaths<{ '/s': { query: { active: boolean } } }>({
      querySerialization: { boolean: 'flag' },
    });
    expect(pathTo('/s', { query: { active: true } })).toBe('/s?active');
    expect(pathTo('/s', { query: { active: false } })).toBe('/s');
  });

  it('keeps empty strings when configured', () => {
    const pathTo = createPaths<{ '/s': { query: { q: string } } }>({
      querySerialization: { empty: 'keep' },
    });
    expect(pathTo('/s', { query: { q: '' } })).toBe('/s?q=');
  });

  it('returns path without ? when query is all-optional and omitted', () => {
    const pathTo = createPaths<{ '/s': { query: { q?: string } } }>();
    expect(pathTo('/s')).toBe('/s');
    expect(pathTo('/s', {})).toBe('/s');
    expect(pathTo('/s', { query: {} })).toBe('/s');
  });

  it('combines with params', () => {
    const pathTo = createPaths<{
      '/users/{id}/posts': {
        param: { id: number };
        query: { page: number };
      };
    }>();
    expect(
      pathTo('/users/{id}/posts', {
        param: { id: 1 },
        query: { page: 2 },
      }),
    ).toBe('/users/1/posts?page=2');
  });
});
