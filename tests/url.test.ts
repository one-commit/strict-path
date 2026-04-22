import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

describe('pathTo.url()', () => {
  it('returns URL instance for absolute URL via prefix', () => {
    const pathTo = createPaths<{ '[api]/users': {} }>({
      prefix: { api: 'https://api.example.com' },
    });
    const url = pathTo.url('[api]/users');
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toBe('https://api.example.com/users');
  });

  it('returns URL for relative path when base option is configured', () => {
    const pathTo = createPaths<{
      '/users/{id}': { param: { id: number } };
    }>({ base: 'http://localhost:3000' });
    const url = pathTo.url('/users/{id}', { param: { id: 1 } });
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toBe('http://localhost:3000/users/1');
  });

  it('throws for relative path without base', () => {
    const pathTo = createPaths<{ '/foo': {} }>();
    expect(() => pathTo.url('/foo')).toThrow(/requires absolute URL or 'base'/);
  });

  it('reflects query and hash on the URL instance', () => {
    const pathTo = createPaths<{
      '/search': { query: { q: string }; hash: 'a' | 'b' };
    }>({ base: 'http://localhost' });
    const url = pathTo.url('/search', { query: { q: 'foo' }, hash: 'a' });
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('foo');
    expect(url.hash).toBe('#a');
  });

  it('prefers absolute URL over configured base', () => {
    const pathTo = createPaths<{ '[api]/x': {} }>({
      prefix: { api: 'https://api.example.com' },
      base: 'http://localhost',
    });
    const url = pathTo.url('[api]/x');
    expect(url.href).toBe('https://api.example.com/x');
  });

  describe('base trailing-slash defense (URL constructor handles it)', () => {
    it('normalizes base with trailing slash', () => {
      const pathTo = createPaths<{ '/foo': {} }>({
        base: 'http://x.com/',
      });
      expect(pathTo.url('/foo').href).toBe('http://x.com/foo');
    });

    it('normalizes base without trailing slash identically', () => {
      const pathTo = createPaths<{ '/foo': {} }>({ base: 'http://x.com' });
      expect(pathTo.url('/foo').href).toBe('http://x.com/foo');
    });

    it('normalizes base with duplicate trailing slashes', () => {
      const pathTo = createPaths<{ '/foo': {} }>({
        base: 'http://x.com//',
      });
      expect(pathTo.url('/foo').href).toBe('http://x.com/foo');
    });

    it('absolute path overrides any base pathname component', () => {
      const pathTo = createPaths<{ '/foo': {} }>({
        base: 'http://x.com/api/v1/',
      });
      // Absolute path in str ignores base's pathname, resolves at origin.
      expect(pathTo.url('/foo').href).toBe('http://x.com/foo');
    });
  });
});
