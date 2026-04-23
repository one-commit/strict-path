import { describe, it, expect, vi } from 'vitest';
import { createPaths } from '../src';
import * as logs from '../src/logs';

describe('hash fragment', () => {
  it('appends literal hash', () => {
    const pathTo = createPaths<{
      '/settings': { hash: 'account' | 'privacy' };
    }>();
    expect(pathTo('/settings', { hash: 'account' })).toBe('/settings#account');
  });

  it('encodes special characters in hash', () => {
    const pathTo = createPaths<{ '/x': { hash: string } }>();
    expect(pathTo('/x', { hash: 'a b' })).toBe('/x#a%20b');
  });

  it('returns path without # when hash is optional and omitted', () => {
    const pathTo = createPaths<{ '/settings': { hash?: 'a' | 'b' } }>();
    expect(pathTo('/settings')).toBe('/settings');
    expect(pathTo('/settings', {})).toBe('/settings');
  });

  it('combines param + query + hash', () => {
    const pathTo = createPaths<{
      '/users/{id}': {
        param: { id: number };
        query: { tab: string };
        hash: 'info' | 'settings';
      };
    }>();
    expect(
      pathTo('/users/{id}', {
        param: { id: 1 },
        query: { tab: 'posts' },
        hash: 'info',
      }),
    ).toBe('/users/1?tab=posts#info');
  });

  it('combines query + hash without param', () => {
    const pathTo = createPaths<{
      '/x': { query: { q: string }; hash: 'top' };
    }>();
    expect(pathTo('/x', { query: { q: 'foo' }, hash: 'top' })).toBe(
      '/x?q=foo#top',
    );
  });

  it('warns and omits fragment when hash is empty string', () => {
    const warn = vi.spyOn(logs, 'pathWarn').mockImplementation(() => {});
    const pathTo = createPaths<{ '/x': { hash: string } }>();
    expect(pathTo('/x', { hash: '' })).toBe('/x');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
