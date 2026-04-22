import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPaths } from '../src';

describe('combined + edge cases', () => {
  // Silence slash-collapse warnings in the tests below; explicit warn assertions
  // live in the dedicated "slash-collapse warning" describe.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });
  it('combines prefix + param + catch-all + query + hash', () => {
    const pathTo = createPaths<{
      '/[cc]/users/{id}/{...rest}': {
        param: { id: number; rest: string[] };
        query: { tab: string };
        hash: 'info' | 'history';
      };
    }>({ prefix: { cc: 'tenant' } });

    expect(
      pathTo('/[cc]/users/{id}/{...rest}', {
        param: { id: 42, rest: ['posts', 'latest'] },
        query: { tab: 'featured' },
        hash: 'info',
      }),
    ).toBe('/tenant/users/42/posts/latest?tab=featured#info');
  });

  it('preserves trailing slash before query', () => {
    const pathTo = createPaths<{ '/foo/': { query: { q: string } } }>();
    expect(pathTo('/foo/', { query: { q: 'x' } })).toBe('/foo/?q=x');
  });

  it('preserves root path with query', () => {
    const pathTo = createPaths<{ '/': { query: { q: string } } }>();
    expect(pathTo('/', { query: { q: 'x' } })).toBe('/?q=x');
  });

  it('collapses duplicate slashes when prefix resolves to empty string', () => {
    const pathTo = createPaths<{ '/[locale]/posts': {} }>({
      prefix: { locale: '' },
    });
    expect(pathTo('/[locale]/posts')).toBe('/posts');
  });

  it('collapses multiple consecutive empty prefixes', () => {
    const pathTo = createPaths<{ '/[a]/[b]/end': {} }>({
      prefix: { a: '', b: '' },
    });
    expect(pathTo('/[a]/[b]/end')).toBe('/end');
  });

  it('preserves scheme // in absolute URL', () => {
    const pathTo = createPaths<{ '[base]/api': {} }>({
      prefix: { base: 'https://api.example.com' },
    });
    expect(pathTo('[base]/api')).toBe('https://api.example.com/api');
  });

  it('collapses duplicate slashes within absolute URL path', () => {
    const pathTo = createPaths<{ '[base]/[version]/api': {} }>({
      prefix: { base: 'https://api.example.com/', version: '' },
    });
    expect(pathTo('[base]/[version]/api')).toBe('https://api.example.com/api');
  });

  it('does not touch slashes inside query values', () => {
    const pathTo = createPaths<{ '/redirect': { query: { to: string } } }>();
    expect(pathTo('/redirect', { query: { to: '//external' } })).toBe(
      '/redirect?to=%2F%2Fexternal',
    );
  });

  // ---------------------------------------------------------------------------
  // Path template — leading pattern survey
  //
  // Each `it()` records the CURRENT behavior — no judgement on whether it
  // should be a compile-time rejection, a runtime throw, or stay valid.
  // All cases below currently pass TypeScript typecheck.
  // ---------------------------------------------------------------------------

  describe('leading pattern — 1. "/" (absolute path)', () => {
    it('"/foo"', () => {
      const pathTo = createPaths<{ '/foo': {} }>();
      expect(pathTo('/foo')).toBe('/foo');
    });

    it('"/foo/{id}"', () => {
      const pathTo = createPaths<{
        '/foo/{id}': { param: { id: number } };
      }>();
      expect(pathTo('/foo/{id}', { param: { id: 1 } })).toBe('/foo/1');
    });

    it('"/[cc]/x"', () => {
      const pathTo = createPaths<{ '/[cc]/x': {} }>({
        prefix: { cc: 'acme' },
      });
      expect(pathTo('/[cc]/x')).toBe('/acme/x');
    });

    it('"/" (root)', () => {
      const pathTo = createPaths<{ '/': {} }>();
      expect(pathTo('/')).toBe('/');
    });
  });

  describe('leading pattern — 2. "[prefix]"', () => {
    it('"[api]/v1/users" with https prefix', () => {
      const pathTo = createPaths<{ '[api]/v1/users': {} }>({
        prefix: { api: 'https://api.example.com' },
      });
      expect(pathTo('[api]/v1/users')).toBe('https://api.example.com/v1/users');
    });

    it('"[cc]/x" with bare-word prefix', () => {
      const pathTo = createPaths<{ '[cc]/x': {} }>({
        prefix: { cc: 'acme' },
      });
      expect(pathTo('[cc]/x')).toBe('acme/x');
    });

    it('"[cdn]/[version]/img" — multiple prefixes at start', () => {
      const pathTo = createPaths<{ '[cdn]/[version]/img': {} }>({
        prefix: {
          cdn: 'https://cdn.example.com',
          version: 'v2',
        },
      });
      expect(pathTo('[cdn]/[version]/img')).toBe(
        'https://cdn.example.com/v2/img',
      );
    });

    it('"[only]" — prefix is the whole path', () => {
      const pathTo = createPaths<{ '[only]': {} }>({
        prefix: { only: 'resolved' },
      });
      expect(pathTo('[only]')).toBe('resolved');
    });
  });

  describe('leading pattern — 3. "http(s)://" (static absolute URL literal)', () => {
    it('"https://fixed.example.com/x"', () => {
      const pathTo = createPaths<{ 'https://fixed.example.com/x': {} }>();
      expect(pathTo('https://fixed.example.com/x')).toBe(
        'https://fixed.example.com/x',
      );
    });

    it('"http://localhost:3000/ping"', () => {
      const pathTo = createPaths<{ 'http://localhost:3000/ping': {} }>();
      expect(pathTo('http://localhost:3000/ping')).toBe(
        'http://localhost:3000/ping',
      );
    });
  });

  describe('leading pattern — 4. bare word (no "/" or "[")', () => {
    it('"users/{id}" — probably meant "/users/{id}"', () => {
      const pathTo = createPaths<{
        'users/{id}': { param: { id: number } };
      }>();
      expect(pathTo('users/{id}', { param: { id: 1 } })).toBe('users/1');
    });

    it('"foo" — single-word path', () => {
      const pathTo = createPaths<{ foo: {} }>();
      expect(pathTo('foo')).toBe('foo');
    });

    it('"some/deep/path" — multi-segment without leading slash', () => {
      const pathTo = createPaths<{ 'some/deep/path': {} }>();
      expect(pathTo('some/deep/path')).toBe('some/deep/path');
    });
  });

  describe('leading pattern — 5. relative markers (".", "..")', () => {
    it('"./foo"', () => {
      const pathTo = createPaths<{ './foo': {} }>();
      expect(pathTo('./foo')).toBe('./foo');
    });

    it('"../foo"', () => {
      const pathTo = createPaths<{ '../foo': {} }>();
      expect(pathTo('../foo')).toBe('../foo');
    });

    it('"."', () => {
      const pathTo = createPaths<{ '.': {} }>();
      expect(pathTo('.')).toBe('.');
    });
  });

  describe('leading pattern — 6. URL component markers at start', () => {
    it('"?q=x" — starts with query marker', () => {
      const pathTo = createPaths<{ '?q=x': {} }>();
      expect(pathTo('?q=x')).toBe('?q=x');
    });

    it('"#hash" — starts with hash marker', () => {
      const pathTo = createPaths<{ '#hash': {} }>();
      expect(pathTo('#hash')).toBe('#hash');
    });

    it('"//protocol-relative/path"', () => {
      const pathTo = createPaths<{ '//protocol-relative/path': {} }>();
      // normalizeSlashes currently collapses the leading // to /
      expect(pathTo('//protocol-relative/path')).toBe(
        '/protocol-relative/path',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Slash-collapse warning — the only silent transformation strict-path performs.
  // Must surface to the developer via console.warn.
  // ---------------------------------------------------------------------------

  describe('slash-collapse warning', () => {
    it('warns when consecutive slashes are collapsed', () => {
      const pathTo = createPaths<{ '/[locale]/posts': {} }>({
        prefix: { locale: '' },
      });
      pathTo('/[locale]/posts');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Collapsed consecutive slashes'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[strict-path]'),
      );
    });

    it('warning includes raw, normalized, and template strings', () => {
      const pathTo = createPaths<{ '/[a]/[b]/end': {} }>({
        prefix: { a: '', b: '' },
      });
      pathTo('/[a]/[b]/end');
      const message = warnSpy.mock.calls[0]?.[0] as string;
      expect(message).toContain('///end'); // raw
      expect(message).toContain('/end'); // normalized
      expect(message).toContain('/[a]/[b]/end'); // template
    });

    it('deduplicates warning per route template', () => {
      const pathTo = createPaths<{ '/[locale]/x': {} }>({
        prefix: { locale: '' },
      });
      pathTo('/[locale]/x');
      pathTo('/[locale]/x');
      pathTo('/[locale]/x');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not warn when nothing was collapsed', () => {
      const pathTo = createPaths<{ '/foo': {} }>();
      pathTo('/foo');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns separately per distinct template key', () => {
      const pathTo = createPaths<{
        '/[a]/x': {};
        '/[b]/y': {};
      }>({ prefix: { a: '', b: '' } });
      pathTo('/[a]/x');
      pathTo('/[b]/y');
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('leading pattern — 7. edges', () => {
    it('empty string ""', () => {
      const pathTo = createPaths<{ '': {} }>();
      expect(pathTo('')).toBe('');
    });

    it('single character "x"', () => {
      const pathTo = createPaths<{ x: {} }>();
      expect(pathTo('x')).toBe('x');
    });
  });
});
