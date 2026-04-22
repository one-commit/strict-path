import { describe, test, expectTypeOf } from 'vitest';
import { createPaths, type HashOf } from '../src';

const pathTo = createPaths<{
  '/settings': { hash: 'account' | 'privacy' };
  '/x': { hash: string };
  '/opt': { hash?: 'a' | 'b' };
  '/plain': {};
}>();

test('HashOf extracts literal union', () => {
  type H = HashOf<typeof pathTo, '/settings'>;
  expectTypeOf<H>().toEqualTypeOf<'account' | 'privacy'>();
});

test('HashOf extracts union even when declared optional', () => {
  type H = HashOf<typeof pathTo, '/opt'>;
  expectTypeOf<H>().toEqualTypeOf<'a' | 'b'>();
});

describe('required vs optional at call site', () => {
  test('hash declared non-optional → required', () => {
    // @ts-expect-error — hash required
    pathTo('/settings');
    // @ts-expect-error — hash required
    pathTo('/settings', {});
    pathTo('/settings', { hash: 'account' });
  });

  test('hash declared optional (outer `?`) → omitable', () => {
    pathTo('/opt');
    pathTo('/opt', {});
    pathTo('/opt', { hash: 'a' });
  });
});

test('wrong hash literal is rejected', () => {
  // @ts-expect-error — 'unknown' not in literal union
  pathTo('/settings', { hash: 'unknown' });
});

test('no hash arg when not declared', () => {
  pathTo('/plain');
  // @ts-expect-error — /plain has no declared hash
  pathTo('/plain', { hash: 'x' });
});

test('string hash accepts any string', () => {
  pathTo('/x', { hash: 'anything' });
});
