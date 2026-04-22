import { describe, test, expectTypeOf } from 'vitest';
import { createPaths, type ParamOf, type QueryOf, type HashOf } from '../src';

/**
 * Type-level combinations checking that required/optional semantics across
 * param + query + hash interact correctly and that the extractor utilities
 * work on complex route definitions.
 */
describe('combined — required / optional semantics', () => {
  const pathTo = createPaths<{
    '/[cc]/users/{id}': {
      param: { id: number };
      query: { tab: string };
      hash: 'info' | 'settings';
    };
    '/[cc]/posts/{id}': {
      param: { id: number };
      query?: { preview: boolean };
      hash?: 'top';
    };
    '/about': { query: { ref?: string }; hash?: 'faq' };
    '/[cc]/docs/{...path}': {
      param: { path: string[] };
    };
  }>({ prefix: { cc: 'acme' } });

  test('all-required route — every field enforced at call site', () => {
    pathTo('/[cc]/users/{id}', {
      param: { id: 1 },
      query: { tab: 'posts' },
      hash: 'info',
    });

    // @ts-expect-error — query required
    pathTo('/[cc]/users/{id}', { param: { id: 1 }, hash: 'info' });
    // @ts-expect-error — hash required
    pathTo('/[cc]/users/{id}', {
      param: { id: 1 },
      query: { tab: 'posts' },
    });
    // @ts-expect-error — param required
    pathTo('/[cc]/users/{id}', {
      query: { tab: 'posts' },
      hash: 'info',
    });
  });

  test('mixed — required param, optional query/hash', () => {
    pathTo('/[cc]/posts/{id}', { param: { id: 1 } });
    pathTo('/[cc]/posts/{id}', {
      param: { id: 1 },
      query: { preview: true },
    });
    pathTo('/[cc]/posts/{id}', {
      param: { id: 1 },
      query: { preview: true },
      hash: 'top',
    });

    // @ts-expect-error — param still required even if query/hash are optional
    pathTo('/[cc]/posts/{id}', { query: { preview: true } });
  });

  test('no-param route with only optional fields — opts fully omitable', () => {
    pathTo('/about');
    pathTo('/about', {});
    pathTo('/about', { query: { ref: 'x' } });
    pathTo('/about', { hash: 'faq' });
    pathTo('/about', { query: { ref: 'x' }, hash: 'faq' });
  });

  test('catch-all param is still required (array)', () => {
    pathTo('/[cc]/docs/{...path}', { param: { path: ['a', 'b'] } });

    // @ts-expect-error — catch-all param required
    pathTo('/[cc]/docs/{...path}');
    // @ts-expect-error — path must be array
    pathTo('/[cc]/docs/{...path}', { param: { path: 'a/b' } });
  });
});

describe('combined — type utility extraction on mixed routes', () => {
  const pathTo = createPaths<{
    '/search': {
      query: { q: string; tags?: string[]; active: boolean };
      hash?: 'top' | 'bottom';
    };
    '/users/{id}/{...rest}': {
      param: { id: number; rest: string[] };
      query: { v: number };
    };
  }>();

  void pathTo;

  test('QueryOf preserves declared required/optional per field', () => {
    type Q = QueryOf<typeof pathTo, '/search'>;
    expectTypeOf<Q>().toEqualTypeOf<{
      q: string;
      tags?: string[];
      active: boolean;
    }>();
  });

  test('HashOf on optional hash still extracts the union', () => {
    type H = HashOf<typeof pathTo, '/search'>;
    expectTypeOf<H>().toEqualTypeOf<'top' | 'bottom'>();
  });

  test('ParamOf extracts single + catch-all together', () => {
    type P = ParamOf<typeof pathTo, '/users/{id}/{...rest}'>;
    expectTypeOf<P>().toEqualTypeOf<{ id: number; rest: string[] }>();
  });
});
