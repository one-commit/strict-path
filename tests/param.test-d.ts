import { test, expectTypeOf } from 'vitest';
import { createPaths, type ParamOf } from '../src';

const pathTo = createPaths<{
  '/users/{id}': { param: { id: number } };
  '/about': {};
  '/docs/{...path}': { param: { path: string[] } };
  '/mixed/{id}/{...rest}': { param: { id: number; rest: string[] } };
  '/x/{...slug}': { param: { slug: string[] } };
}>();

test('ParamOf extracts the param type', () => {
  type P = ParamOf<typeof pathTo, '/users/{id}'>;
  expectTypeOf<P>().toEqualTypeOf<{ id: number }>();
});

test('param arg is required when path has {name}', () => {
  // @ts-expect-error — missing required param arg
  pathTo('/users/{id}');
});

test('no param arg needed for plain path', () => {
  pathTo('/about');
});

test('wrong param value type is rejected', () => {
  // @ts-expect-error — id should be number, not string
  pathTo('/users/{id}', { param: { id: 'abc' } });
});

test('extra param key is rejected', () => {
  // @ts-expect-error — extra key not in declared param
  pathTo('/users/{id}', { param: { id: 1, extra: 'x' } });
});

test('ParamOf extracts catch-all as array type', () => {
  type P = ParamOf<typeof pathTo, '/docs/{...path}'>;
  expectTypeOf<P>().toEqualTypeOf<{ path: string[] }>();
});

test('catch-all param arg is required', () => {
  // @ts-expect-error — missing catch-all param arg
  pathTo('/docs/{...path}');
});

test('catch-all rejects non-array value', () => {
  // @ts-expect-error — string is not assignable to string[]
  pathTo('/docs/{...path}', { param: { path: 'a/b' } });
});

test('mixed param + catch-all requires both', () => {
  pathTo('/mixed/{id}/{...rest}', {
    param: { id: 1, rest: ['a', 'b'] },
  });

  // @ts-expect-error — rest is missing
  pathTo('/mixed/{id}/{...rest}', { param: { id: 1 } });

  // @ts-expect-error — id is missing
  pathTo('/mixed/{id}/{...rest}', { param: { rest: ['a'] } });
});

test('ParamOf reflects explicit catch-all declaration as-is', () => {
  type P = ParamOf<typeof pathTo, '/x/{...slug}'>;
  expectTypeOf<P>().toEqualTypeOf<{ slug: string[] }>();
});

test('route with {name} in path but no param declared is a type error', () => {
  // @ts-expect-error — path has {id} but no param field declared in route def
  createPaths<{ '/users/{id}': {} }>();
});
