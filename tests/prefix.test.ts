import { describe, it, expect } from 'vitest';
import { createPaths } from '../src';

describe('global prefix [name]', () => {
  it('substitutes a string value prefix', () => {
    const pathTo = createPaths<{
      '/[cc]/x': {};
    }>({ prefix: { cc: 'abc' } });
    expect(pathTo('/[cc]/x')).toBe('/abc/x');
  });

  it('substitutes a function resolver prefix', () => {
    const pathTo = createPaths<{
      '/[cc]/x': {};
    }>({ prefix: { cc: () => 'def' } });
    expect(pathTo('/[cc]/x')).toBe('/def/x');
  });

  it('combines prefix with local param', () => {
    const pathTo = createPaths<{
      '/[cc]/users/{id}': { param: { id: number } };
    }>({ prefix: { cc: 'tenant' } });
    expect(pathTo('/[cc]/users/{id}', { param: { id: 1 } })).toBe(
      '/tenant/users/1',
    );
  });

  it('substitutes multiple prefixes in one path', () => {
    const pathTo = createPaths<{
      '[cdn]/[version]/img': {};
    }>({
      prefix: {
        cdn: 'https://cdn.example.com',
        version: 'v2',
      },
    });
    expect(pathTo('[cdn]/[version]/img')).toBe(
      'https://cdn.example.com/v2/img',
    );
  });

  it('allows http scheme in prefix value', () => {
    const pathTo = createPaths<{
      '[base]/api': {};
    }>({ prefix: { base: () => 'http://localhost:3000' } });
    expect(pathTo('[base]/api')).toBe('http://localhost:3000/api');
  });

  it('allows https scheme in prefix value', () => {
    const pathTo = createPaths<{
      '[base]/api': {};
    }>({ prefix: { base: () => 'https://api.example.com' } });
    expect(pathTo('[base]/api')).toBe('https://api.example.com/api');
  });

  it('rejects prefix resolving to disallowed scheme', () => {
    const pathTo = createPaths<{
      '[base]/api': {};
    }>({ prefix: { base: () => 'javascript:alert(1)' } });
    expect(() => pathTo('[base]/api')).toThrow(
      /disallowed scheme "javascript"/,
    );
  });

  it('throws when resolver returns undefined', () => {
    const pathTo = createPaths<{
      '/[cc]/x': {};
    }>({ prefix: { cc: () => undefined } });
    expect(() => pathTo('/[cc]/x')).toThrow(/resolver returned undefined/);
  });
});
