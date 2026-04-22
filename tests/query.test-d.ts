import { describe, test, expectTypeOf } from 'vitest';
import { createPaths, type QueryOf } from '../src';

const pathTo = createPaths<{
  '/search': { query: { q: string; page: number } };
  '/plain': {};
  '/users/{id}': { param: { id: number }; query: { verbose: boolean } };
}>();

test('QueryOf extracts the declared query type as-is (no auto-Partial)', () => {
  type Q = QueryOf<typeof pathTo, '/search'>;
  expectTypeOf<Q>().toEqualTypeOf<{ q: string; page: number }>();
});

describe('required vs optional at call site', () => {
  test('query declared non-optional with required inner fields → query required', () => {
    // @ts-expect-error — query is required
    pathTo('/search');
    // @ts-expect-error — query is required
    pathTo('/search', {});
    // @ts-expect-error — q and page are required
    pathTo('/search', { query: {} });
    // @ts-expect-error — page is required
    pathTo('/search', { query: { q: 'foo' } });
    pathTo('/search', { query: { q: 'foo', page: 1 } });
  });

  test('query with all inner fields optional → query itself omitable', () => {
    const p = createPaths<{ '/s': { query: { q?: string } } }>();
    p('/s');
    p('/s', {});
    p('/s', { query: {} });
    p('/s', { query: { q: 'x' } });
  });

  test('query declared optional (outer `?`) → query omitable even if inner required', () => {
    const p = createPaths<{ '/s': { query?: { q: string } } }>();
    p('/s');
    p('/s', {});
    p('/s', { query: { q: 'x' } });
    // @ts-expect-error — when provided, q is still required
    p('/s', { query: {} });
  });
});

test('wrong query value type is rejected', () => {
  // @ts-expect-error — page should be number
  pathTo('/search', { query: { q: 'foo', page: 'abc' } });
});

test('extra query key is rejected', () => {
  // @ts-expect-error — extra key not declared
  pathTo('/search', { query: { q: 'foo', page: 1, extra: 'x' } });
});

test('no query option when query not declared', () => {
  pathTo('/plain');
  // @ts-expect-error — /plain has no declared query
  pathTo('/plain', { query: { x: 'y' } });
});

test('param AND query both required when both declared non-optional', () => {
  // @ts-expect-error — query required
  pathTo('/users/{id}', { param: { id: 1 } });
  pathTo('/users/{id}', { param: { id: 1 }, query: { verbose: true } });
  // @ts-expect-error — param still required
  pathTo('/users/{id}', { query: { verbose: true } });
});
