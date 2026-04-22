import { test } from 'vitest';
import { createPaths } from '../src';

test('options.prefix is required when path has [name]', () => {
  // @ts-expect-error — missing options
  createPaths<{ '/[cc]/x': {} }>();

  // @ts-expect-error — prefix.cc is required
  createPaths<{ '/[cc]/x': {} }>({ prefix: {} });
});

test('all declared prefix names must be provided', () => {
  createPaths<{ '/[cc]/x': {}; '[api]/y': {} }>({
    // @ts-expect-error — missing 'api'
    prefix: { cc: 'abc' },
  });
});

test('prefix accepts string values', () => {
  createPaths<{ '/[cc]/x': {} }>({ prefix: { cc: 'abc' } });
});

test('prefix accepts function resolvers returning string | undefined', () => {
  createPaths<{ '/[cc]/x': {} }>({ prefix: { cc: () => 'abc' } });
  createPaths<{ '/[cc]/x': {} }>({ prefix: { cc: () => undefined } });
});

test('prefix rejects extra keys not declared in paths', () => {
  createPaths<{ '/[cc]/x': {} }>({
    // @ts-expect-error — 'extra' is not a declared prefix
    prefix: { cc: 'abc', extra: 'x' },
  });
});

test('options optional & prefix disallowed for plain paths', () => {
  createPaths<{ '/about': {} }>();
  createPaths<{ '/about': {} }>({});

  createPaths<{ '/about': {} }>({
    // @ts-expect-error — prefix not allowed when no [name] in paths
    prefix: { x: 'abc' },
  });
});
