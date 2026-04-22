import { test, expectTypeOf } from 'vitest';
import { createPaths } from '../src';

const pathTo = createPaths<{
  '/users/{id}': { param: { id: number } };
  '/foo': {};
}>({ base: 'http://localhost' });

test('pathTo.url returns URL', () => {
  const url = pathTo.url('/users/{id}', { param: { id: 1 } });
  expectTypeOf(url).toEqualTypeOf<URL>();
});

test('pathTo.url shares the same call signature shape as pathTo', () => {
  // @ts-expect-error — missing required param
  pathTo.url('/users/{id}');

  // @ts-expect-error — unknown key
  pathTo.url('/unknown');
});

test('pathTo.url accepts no-arg call for plain paths', () => {
  pathTo.url('/foo');
});
