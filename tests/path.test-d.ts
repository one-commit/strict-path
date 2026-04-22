import { test, expectTypeOf } from 'vitest';
import { createPaths, type RouteKeys } from '../src';

const pathTo = createPaths<{
  '/about': {};
  '/': {};
  '/foo/': {};
}>();

test('RouteKeys extracts declared keys as union', () => {
  type Keys = RouteKeys<typeof pathTo>;
  expectTypeOf<Keys>().toEqualTypeOf<'/about' | '/' | '/foo/'>();
});

test('known keys are accepted', () => {
  pathTo('/about');
  pathTo('/');
  pathTo('/foo/');
});

test('unknown key is rejected', () => {
  // @ts-expect-error — '/unknown' is not declared
  pathTo('/unknown');
});
