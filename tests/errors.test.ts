import { describe, it, expect } from 'vitest';
import { createPaths, StrictPathError, type ErrorCode } from '../src';

/**
 * Every runtime failure in strict-path funnels through StrictPathError.
 *
 * Tests grouped by reachability:
 *
 *   1. Format invariants
 *      All errors, regardless of origin, must be StrictPathError instances,
 *      carry the right `.code`, and have a `[strict-path]`-prefixed message.
 *
 *   2. Runtime-only errors
 *      Failures that cannot in principle be caught at compile time —
 *      they depend on string content, resolver return values, or the
 *      dynamic result of substitution.
 *
 *   3. Type-safety bypass errors
 *      Failures the type system already blocks. The runtime guard exists
 *      as defense-in-depth for cast-based escapes (`as any`, `@ts-expect-error`
 *      user code, `unknown`-shaped external data, etc.).
 */
describe('errors', () => {
  // -------------------------------------------------------------------------
  // 1. Format invariants — every ErrorCode routed through StrictPathError
  // -------------------------------------------------------------------------

  describe('format invariants', () => {
    // Keyed by ErrorCode so TS forces every new code to register a trigger —
    // missing entries surface as a type error here, not as silent test gaps.
    const triggers: Record<ErrorCode, () => void> = {
      MISSING_PARAM: () => {
        const p = createPaths<{ '/users/{id}': { param: { id: number } } }>();
        // @ts-expect-error — bypass required param.id for defense test
        p('/users/{id}', { param: {} });
      },
      PARAM_CONTAINS_SLASH: () => {
        const p = createPaths<{ '/s/{q}': { param: { q: string } } }>();
        p('/s/{q}', { param: { q: 'a/b' } });
      },
      MISSING_CATCH_ALL: () => {
        const p = createPaths<{
          '/d/{...p}': { param: { p: string[] } };
        }>();
        // @ts-expect-error — bypass required catch-all param.p
        p('/d/{...p}', { param: {} });
      },
      CATCH_ALL_NOT_ARRAY: () => {
        const p = createPaths<{
          '/d/{...p}': { param: { p: string[] } };
        }>();
        // @ts-expect-error — catch-all must be an array
        p('/d/{...p}', { param: { p: 'not-array' } });
      },
      MISSING_PREFIX: () => {
        const p = createPaths<{ '/[cc]/x': {} }>(
          // @ts-expect-error — prefix.cc is required; bypass for defense test
          { prefix: {} },
        );
        p('/[cc]/x');
      },
      PREFIX_RETURNED_UNDEFINED: () => {
        const p = createPaths<{ '/[cc]/x': {} }>({
          prefix: { cc: () => undefined },
        });
        p('/[cc]/x');
      },
      DISALLOWED_SCHEME: () => {
        const p = createPaths<{ '[b]/x': {} }>({
          prefix: { b: () => 'javascript:alert(1)' },
        });
        p('[b]/x');
      },
      URL_REQUIRES_BASE: () => {
        const p = createPaths<{ '/foo': {} }>();
        p.url('/foo');
      },
    };

    it('each scenario throws a StrictPathError with the matching code and [strict-path] prefix', () => {
      for (const [code, trigger] of Object.entries(triggers) as Array<
        [ErrorCode, () => void]
      >) {
        try {
          trigger();
          expect.fail(`expected ${code} to throw`);
        } catch (e) {
          expect(e).toBeInstanceOf(StrictPathError);
          expect((e as StrictPathError).code).toBe(code);
          expect((e as StrictPathError).message).toMatch(/^\[strict-path\]/);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Runtime-only errors — inherently uncatchable at compile time
  // -------------------------------------------------------------------------

  describe('runtime-only errors (no compile-time guard possible)', () => {
    it('PARAM_CONTAINS_SLASH — string content is opaque to TS; caught at runtime with guidance toward catch-all', () => {
      const p = createPaths<{ '/s/{q}': { param: { q: string } } }>();
      expect(() => p('/s/{q}', { param: { q: 'a/b' } })).toThrow(
        /contains "\/"/,
      );
      expect(() => p('/s/{q}', { param: { q: 'a/b' } })).toThrow(
        /use catch-all/,
      );
    });

    it('DISALLOWED_SCHEME — scheme is only known after resolver runs; error exposes resolved value', () => {
      const p = createPaths<{ '[b]/x': {} }>({
        prefix: { b: () => 'javascript:alert(1)' },
      });
      expect(() => p('[b]/x')).toThrow(/disallowed scheme "javascript"/);
      expect(() => p('[b]/x')).toThrow(/javascript:alert\(1\)/);
    });

    it('PREFIX_RETURNED_UNDEFINED — resolver return type permits `| undefined`; library enforces string at use site', () => {
      const p = createPaths<{ '/[cc]/x': {} }>({
        prefix: { cc: () => undefined },
      });
      expect(() => p('/[cc]/x')).toThrow(/expected string/);
    });

    it('URL_REQUIRES_BASE — absoluteness of a resolved URL is a runtime property', () => {
      const p = createPaths<{ '/foo': {} }>();
      expect(() => p.url('/foo')).toThrow(/requires absolute URL or 'base'/);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Type-safety bypass — TS blocks these; runtime guards as defense
  // -------------------------------------------------------------------------

  describe('type-safety bypass errors (defense-in-depth when TS is circumvented)', () => {
    it('MISSING_PARAM — required single-segment param omitted via cast', () => {
      const p = createPaths<{ '/users/{id}': { param: { id: number } } }>();
      expect(() => {
        // @ts-expect-error — bypass required param.id
        p('/users/{id}', { param: {} });
      }).toThrow(/Missing param "id"/);
    });

    it('MISSING_CATCH_ALL — required catch-all param omitted via cast', () => {
      const p = createPaths<{
        '/d/{...p}': { param: { p: string[] } };
      }>();
      expect(() => {
        // @ts-expect-error — bypass required catch-all param.p
        p('/d/{...p}', { param: {} });
      }).toThrow(/Missing catch-all param "p"/);
    });

    it('CATCH_ALL_NOT_ARRAY — non-array forced in via cast; error reports received type', () => {
      const p = createPaths<{
        '/d/{...p}': { param: { p: string[] } };
      }>();
      expect(() => {
        // @ts-expect-error — string is not assignable to string[]
        p('/d/{...p}', { param: { p: 'not-array' } });
      }).toThrow(/got string/);
    });

    it('MISSING_PREFIX — prefix config forced empty via cast', () => {
      const p = createPaths<{ '/[cc]/x': {} }>(
        // @ts-expect-error — prefix.cc is required
        { prefix: {} },
      );
      expect(() => p('/[cc]/x')).toThrow(/Missing prefix "cc"/);
    });
  });
});
