// ---------------------------------------------------------------------------
// Error model — one registry, everything else derived.
// ---------------------------------------------------------------------------
//
//   throw pathError('MISSING_PARAM', { name, path });
//
//   TEMPLATES                         ← single source of truth
//     ├─ keys              → ErrorCode (event names)
//     ├─ parameter types   → per-code context shape
//     └─ function bodies   → rendered messages
//
// Adding a new error = adding one key to TEMPLATES. Types & factory update
// automatically.
// ---------------------------------------------------------------------------

import pkg from '../package.json' with { type: 'json' };

/** Read from `package.json#name` at build time (esbuild/tsup inlines the value). */
const PKG_NAME = pkg.name;

const TEMPLATES = {
  MISSING_PARAM: ({ name, path }: { name: string; path: string }) =>
    `Missing param "${name}" for path "${path}"`,

  PARAM_CONTAINS_SLASH: ({ name, value }: { name: string; value: string }) =>
    `Param "${name}" value "${value}" contains "/" — use catch-all {...${name}} for multi-segment paths`,

  MISSING_CATCH_ALL: ({ name, path }: { name: string; path: string }) =>
    `Missing catch-all param "${name}" for path "${path}"`,

  CATCH_ALL_NOT_ARRAY: ({
    name,
    value,
    path,
  }: {
    name: string;
    value: unknown;
    path: string;
  }) =>
    `Catch-all param "${name}" must be an array (got ${typeof value}) for path "${path}"`,

  MISSING_PREFIX: ({ name, path }: { name: string; path: string }) =>
    `Missing prefix "${name}" for path "${path}"`,

  PREFIX_RETURNED_UNDEFINED: ({ name, path }: { name: string; path: string }) =>
    `Prefix "${name}" resolver returned undefined (expected string) for path "${path}"`,

  DISALLOWED_SCHEME: ({
    name,
    value,
    scheme,
    path,
  }: {
    name: string;
    value: string;
    scheme: string;
    path: string;
  }) =>
    `Prefix "${name}" resolved to "${value}" with disallowed scheme "${scheme}" (only http/https allowed) for path "${path}"`,

  URL_REQUIRES_BASE: ({ relativePath }: { relativePath: string }) =>
    `pathTo.url() requires absolute URL or 'base' option at createPaths. Got relative path: "${relativePath}"`,
};

/**
 * Discriminating string union of every runtime error the library may throw.
 * Consumers can pattern-match on {@link StrictPathError.code}.
 */
export type ErrorCode = keyof typeof TEMPLATES;

/** Context shape required for a given error code. */
type ContextOf<K extends ErrorCode> = Parameters<(typeof TEMPLATES)[K]>[0];

/**
 * Thrown by every runtime guard in strict-path.
 * Carries a stable {@link ErrorCode} so callers can `instanceof`-check and
 * branch on `error.code` without parsing the message string.
 */
export class StrictPathError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(`[${PKG_NAME}] ${message}`);
    this.name = 'StrictPathError';
    this.code = code;
  }
}

/**
 * Build a {@link StrictPathError} from a code + typed context.
 *
 * @example
 * ```ts
 * throw pathError('MISSING_PARAM', { name: 'id', path: '/users/{id}' });
 * ```
 */
export function pathError<K extends ErrorCode>(
  code: K,
  context: ContextOf<K>,
): StrictPathError {
  const render = TEMPLATES[code] as (c: ContextOf<K>) => string;
  return new StrictPathError(code, render(context));
}

/**
 * Emit a non-fatal warning with the package-name prefix. Used for silent
 * transformations (e.g. consecutive-slash collapsing) that a developer
 * would otherwise have no way to notice.
 */
export function pathWarn(message: string): void {
  console.warn(`[${PKG_NAME}] ${message}`);
}
