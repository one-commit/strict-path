import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

/**
 * End-to-end combinations exercising prefix + param + catch-all + query + hash
 * together with various required/optional mixes. Per-feature tests already
 * cover each axis in isolation; this suite checks that they interact
 * correctly and that required-vs-optional semantics hold in combination.
 */
describe('combined — full feature matrix', () => {
  // -------------------------------------------------------------------------
  // All-required scenarios — every declared field must be provided
  // -------------------------------------------------------------------------

  describe('every declared field required', () => {
    it('static prefix + single param + required query + required hash', () => {
      const pathTo = createPaths<{
        '/[cc]/users/{id}': {
          param: { id: number };
          query: { tab: string };
          hash: 'info' | 'settings';
        };
      }>({ prefix: { cc: 'acme' } });

      expect(
        pathTo('/[cc]/users/{id}', {
          param: { id: 42 },
          query: { tab: 'posts' },
          hash: 'info',
        }),
      ).toBe('/acme/users/42?tab=posts#info');
    });

    it('function-resolved prefix + catch-all + required query + required hash', () => {
      const pathTo = createPaths<{
        '/[cc]/docs/{...path}': {
          param: { path: Array<'api' | 'v2'> };
          query: { v: number };
          hash: 'top' | 'bottom';
        };
      }>({ prefix: { cc: () => 'tenant' } });

      expect(
        pathTo('/[cc]/docs/{...path}', {
          param: { path: ['api', 'v2'] },
          query: { v: 1 },
          hash: 'top',
        }),
      ).toBe('/tenant/docs/api/v2?v=1#top');
    });

    it('absolute URL prefix + catch-all + query array', () => {
      const pathTo = createPaths<{
        '[api]/v1/search/{...scope}': {
          param: { scope: string[] };
          query: { tags: string[]; exact: boolean };
        };
      }>({
        prefix: { api: 'https://api.example.com' },
        querySerialization: { array: 'comma' },
      });

      expect(
        pathTo('[api]/v1/search/{...scope}', {
          param: { scope: ['team', 'eng'] },
          query: { tags: ['ts', 'urls'], exact: true },
        }),
      ).toBe(
        'https://api.example.com/v1/search/team/eng?tags=ts,urls&exact=true',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Mixed required and optional — parts omitable, parts mandatory
  // -------------------------------------------------------------------------

  describe('mixed required / optional', () => {
    it('required param + optional query (inner `?`)', () => {
      const pathTo = createPaths<{
        '/users/{id}': {
          param: { id: number };
          query: { tab?: string };
        };
      }>();

      expect(pathTo('/users/{id}', { param: { id: 1 } })).toBe('/users/1');
      expect(
        pathTo('/users/{id}', { param: { id: 1 }, query: { tab: 'posts' } }),
      ).toBe('/users/1?tab=posts');
    });

    it('required query + optional hash', () => {
      const pathTo = createPaths<{
        '/search': {
          query: { q: string };
          hash?: 'top';
        };
      }>();

      expect(pathTo('/search', { query: { q: 'ts' } })).toBe('/search?q=ts');
      expect(pathTo('/search', { query: { q: 'ts' }, hash: 'top' })).toBe(
        '/search?q=ts#top',
      );
    });

    it('all-optional route → opts itself omitable', () => {
      const pathTo = createPaths<{
        '/about': { query: { ref?: string }; hash?: 'faq' };
      }>();

      expect(pathTo('/about')).toBe('/about');
      expect(pathTo('/about', { query: { ref: 'nav' } })).toBe(
        '/about?ref=nav',
      );
      expect(pathTo('/about', { hash: 'faq' })).toBe('/about#faq');
      expect(pathTo('/about', { query: { ref: 'nav' }, hash: 'faq' })).toBe(
        '/about?ref=nav#faq',
      );
    });

    it('outer optional query (`query?:`) — absent vs empty vs populated', () => {
      const pathTo = createPaths<{
        '/s': { query?: { q: string } };
      }>();

      expect(pathTo('/s')).toBe('/s');
      expect(pathTo('/s', {})).toBe('/s');
      expect(pathTo('/s', { query: { q: 'x' } })).toBe('/s?q=x');
    });

    it('prefix + required param + optional query + optional hash', () => {
      const pathTo = createPaths<{
        '/[locale]/users/{id}': {
          param: { id: number };
          query?: { ref: string };
          hash?: 'profile' | 'activity';
        };
      }>({ prefix: { locale: 'ko' } });

      expect(pathTo('/[locale]/users/{id}', { param: { id: 1 } })).toBe(
        '/ko/users/1',
      );
      expect(
        pathTo('/[locale]/users/{id}', {
          param: { id: 1 },
          hash: 'profile',
        }),
      ).toBe('/ko/users/1#profile');
      expect(
        pathTo('/[locale]/users/{id}', {
          param: { id: 1 },
          query: { ref: 'nav' },
          hash: 'activity',
        }),
      ).toBe('/ko/users/1?ref=nav#activity');
    });
  });

  // -------------------------------------------------------------------------
  // pathTo.url() across the same shapes
  // -------------------------------------------------------------------------

  describe('URL output across combinations', () => {
    it('absolute URL from prefix + param + query + hash → URL instance', () => {
      const pathTo = createPaths<{
        '[api]/v1/users/{id}': {
          param: { id: string };
          query: { fields: string };
          hash?: 'raw';
        };
      }>({ prefix: { api: 'https://api.example.com' } });

      const url = pathTo.url('[api]/v1/users/{id}', {
        param: { id: 'u_1' },
        query: { fields: 'name,email' },
        hash: 'raw',
      });
      expect(url).toBeInstanceOf(URL);
      expect(url.pathname).toBe('/v1/users/u_1');
      expect(url.searchParams.get('fields')).toBe('name,email');
      expect(url.hash).toBe('#raw');
    });

    it('relative path + base option + mixed fields → URL instance', () => {
      const pathTo = createPaths<{
        '/[tenant]/posts/{id}': {
          param: { id: number };
          query?: { preview: boolean };
        };
      }>({
        prefix: { tenant: 'acme' },
        base: 'http://localhost:3000',
      });

      const url = pathTo.url('/[tenant]/posts/{id}', {
        param: { id: 7 },
        query: { preview: true },
      });
      expect(url.href).toBe('http://localhost:3000/acme/posts/7?preview=true');
    });
  });
});
