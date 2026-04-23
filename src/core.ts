// ---------------------------------------------------------------------------
// strict-path — core URL builder
// ---------------------------------------------------------------------------
//
// Public surface:
//   createPaths<Routes>(options?)      factory returning a typed pathTo
//   pathTo(key, opts?)                 → string
//   pathTo.url(key, opts?)             → URL
//   ParamOf / QueryOf / HashOf / RouteKeys
//   RouteDef / UrlPrimitive / QueryValue / QuerySerialization
//
// Path template syntax:
//   {name}     single-segment param (primitive)
//   {...name}  catch-all param (array, joined by `/`)
//   [name]     runtime-resolved prefix (tenant, locale, base URL, ...)
// ---------------------------------------------------------------------------

import { pathError, pathWarn } from './logs';

/**
 * Primitive types allowed as URL path parameter values.
 * Catch-all params take `ReadonlyArray<UrlPrimitive>` instead.
 */
export type UrlPrimitive = string | number | boolean;

/**
 * Value types allowed for query string entries.
 * Arrays are serialized per {@link QuerySerialization.array}.
 */
export type QueryValue = UrlPrimitive | ReadonlyArray<UrlPrimitive>;

/**
 * Query-string serialization options (per-builder, set at `createPaths` time).
 */
export type QuerySerialization = {
  /** How arrays are serialized. `'repeat'` → `?t=a&t=b` (default). `'comma'` → `?t=a,b`. */
  array?: 'repeat' | 'comma';
  /** How booleans are serialized. `'string'` → `?active=true` (default). `'flag'` → `?active` (true only, omit false). */
  boolean?: 'string' | 'flag';
  /** What to do with empty string values. `'omit'` (default) or `'keep'` (`?q=`). */
  empty?: 'omit' | 'keep';
};

/**
 * A single route's type shape.
 *
 * Required-vs-optional follows the declaration:
 * - `query: { q: string }` — query field is required at call site
 * - `query: { q?: string }` — inner all-optional, query itself becomes optional
 * - `query?: { q: string }` — outer optional, query omitable
 *
 * Same rules apply to `hash`. `param` requiredness is driven by the path
 * template (presence of `{name}` / `{...name}`).
 */
export type RouteDef = {
  param?: Record<string, UrlPrimitive | ReadonlyArray<UrlPrimitive>>;
  query?: Record<string, QueryValue | undefined>;
  hash?: string;
};

type PrefixResolver = string | (() => string | undefined);

/** Extract single-segment `{name}` identifiers (excludes catch-all). */
type ExtractLocalParams<T extends string> =
  T extends `${string}{${infer P}}${infer Rest}`
    ? P extends `...${string}`
      ? ExtractLocalParams<Rest>
      : P | ExtractLocalParams<Rest>
    : never;

/** Extract catch-all `{...name}` identifiers. */
type ExtractCatchAllParams<T extends string> =
  T extends `${string}{...${infer P}}${infer Rest}`
    ? P | ExtractCatchAllParams<Rest>
    : never;

type ExtractGlobalParams<T extends string> =
  T extends `${string}[${infer P}]${infer Rest}`
    ? P | ExtractGlobalParams<Rest>
    : never;

type AllGlobalParams<Routes> = {
  [K in keyof Routes & string]: ExtractGlobalParams<K>;
}[keyof Routes & string];

/** True if path has any `{name}` or `{...name}`. */
type HasAnyParams<T extends string> = [
  ExtractLocalParams<T> | ExtractCatchAllParams<T>,
] extends [never]
  ? false
  : true;

/** `query` key present on TDef (optional or required). */
type IsQueryDeclared<TDef extends RouteDef> = 'query' extends keyof TDef
  ? true
  : false;

/** `hash` key present on TDef (optional or required). */
type IsHashDeclared<TDef extends RouteDef> = 'hash' extends keyof TDef
  ? true
  : false;

/**
 * Is `query` required at the call site?
 *
 * Required iff `query:` declared non-optional AND at least one inner field
 * has no `?`. An all-optional inner shape means the user can reasonably omit
 * the whole `query` arg.
 */
type IsQueryRequired<TDef extends RouteDef> = 'query' extends keyof TDef
  ? undefined extends TDef['query']
    ? false
    : {} extends TDef['query']
      ? false
      : true
  : false;

/** Is `hash` required at the call site? Follows declaration optional-ness. */
type IsHashRequired<TDef extends RouteDef> = 'hash' extends keyof TDef
  ? undefined extends TDef['hash']
    ? false
    : true
  : false;

type HashOfDef<TDef extends RouteDef> = 'hash' extends keyof TDef
  ? NonNullable<TDef['hash']> extends string
    ? NonNullable<TDef['hash']>
    : never
  : never;

/** Auto-inferred param shape when no explicit `param` declared. */
type AutoParam<TPath extends string> = ([ExtractLocalParams<TPath>] extends [
  never,
]
  ? {}
  : { [K in ExtractLocalParams<TPath>]: UrlPrimitive }) &
  ([ExtractCatchAllParams<TPath>] extends [never]
    ? {}
    : { [K in ExtractCatchAllParams<TPath>]: ReadonlyArray<UrlPrimitive> });

type ParamOfRoute<TPath extends string, TDef extends RouteDef> = TDef extends {
  param: infer P;
}
  ? P
  : AutoParam<TPath>;

/**
 * Forces an explicit `param` declaration whenever the path template contains
 * `{name}` or `{...name}`. Without this, auto-inference at the call site would
 * silently accept `'/users/{id}': {}` and leave intent ambiguous.
 *
 * Shape check: declared `param` must be assignable to {@link AutoParam}, i.e.
 * include every placeholder in the path with a compatible value type.
 */
type ValidateRouteDef<TPath extends string, TDef extends RouteDef> =
  HasAnyParams<TPath> extends true ? TDef & { param: AutoParam<TPath> } : TDef;

/** Declared query shape (no automatic `Partial` — user controls optionality per field). */
type QueryOfDef<TDef extends RouteDef> = 'query' extends keyof TDef
  ? NonNullable<TDef['query']> extends Record<string, QueryValue | undefined>
    ? NonNullable<TDef['query']>
    : never
  : never;

/**
 * Merged opts shape combining every declared section for a route.
 *
 * Each section's key is rendered as `field:` or `field?:` based on the
 * declaration — mirrors TS idiom so the call site matches the declaration
 * exactly.
 */
type MergeOpts<
  TPath extends string,
  TDef extends RouteDef,
> = (HasAnyParams<TPath> extends true
  ? { param: ParamOfRoute<TPath, TDef> }
  : {}) &
  (IsQueryDeclared<TDef> extends true
    ? IsQueryRequired<TDef> extends true
      ? { query: QueryOfDef<TDef> }
      : { query?: QueryOfDef<TDef> }
    : {}) &
  (IsHashDeclared<TDef> extends true
    ? IsHashRequired<TDef> extends true
      ? { hash: HashOfDef<TDef> }
      : { hash?: HashOfDef<TDef> }
    : {});

/** Whether any declared section forces `opts` itself to be required. */
type IsAnyFieldRequired<TPath extends string, TDef extends RouteDef> =
  HasAnyParams<TPath> extends true
    ? true
    : IsQueryRequired<TDef> extends true
      ? true
      : IsHashRequired<TDef> extends true
        ? true
        : false;

/** Whether `opts` has any declared (but not required) section → makes opts omitable. */
type HasOptionalFields<TDef extends RouteDef> =
  IsQueryDeclared<TDef> extends true
    ? true
    : IsHashDeclared<TDef> extends true
      ? true
      : false;

type PathArgs<TPath extends string, TDef extends RouteDef> =
  IsAnyFieldRequired<TPath, TDef> extends true
    ? [opts: MergeOpts<TPath, TDef>]
    : HasOptionalFields<TDef> extends true
      ? [opts?: MergeOpts<TPath, TDef>]
      : [];

/**
 * The callable returned by {@link createPaths}.
 */
type PathTo<Routes extends Record<string, RouteDef>> = {
  <K extends keyof Routes & string>(
    key: K,
    ...args: PathArgs<K, Routes[K]>
  ): string;
  /**
   * Same call signature as the default, but returns a `URL` instance.
   * Requires either an absolute URL (via `[prefix]` resolving to `http(s)://…`)
   * or the `base` option at {@link createPaths} time.
   *
   * @throws when result is a relative path and no `base` was configured.
   */
  url<K extends keyof Routes & string>(
    key: K,
    ...args: PathArgs<K, Routes[K]>
  ): URL;
  /** Phantom type carrier for {@link RouteKeys}, {@link ParamOf}, {@link QueryOf} etc. */
  __routes?: Routes;
};

/**
 * `createPaths` options. The shape depends on whether any declared path has
 * `[name]` prefixes.
 */
type CreatePathsArgs<Routes extends Record<string, RouteDef>> = [
  AllGlobalParams<Routes>,
] extends [never]
  ? [
      options?: {
        prefix?: never;
        querySerialization?: QuerySerialization;
        /** Base URL used by `pathTo.url()` when path is relative. */
        base?: string;
      },
    ]
  : [
      options: {
        prefix: Record<AllGlobalParams<Routes>, PrefixResolver>;
        querySerialization?: QuerySerialization;
        /** Base URL used by `pathTo.url()` when path is relative. */
        base?: string;
      },
    ];

const ALLOWED_SCHEMES = new Set(['http', 'https']);
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Create a type-safe URL builder from a declarative route map.
 *
 * @example
 * ```ts
 * const pathTo = createPaths<{
 *   '/users/{id}': { param: { id: number } };
 *   '/search':     { query: { q: string } };
 *   '/[tenant]/x': {};
 * }>({ prefix: { tenant: 'acme' } });
 * ```
 *
 * @throws when a required `{name}` param or `[name]` prefix cannot be
 *   resolved at runtime, or when a prefix resolves to a disallowed URL scheme.
 */
export function createPaths<
  const Routes extends {
    [K in keyof Routes & string]: ValidateRouteDef<K, Routes[K] & RouteDef>;
  },
>(...args: CreatePathsArgs<Routes>): PathTo<Routes> {
  const options = args[0] as
    | {
        prefix?: Record<string, PrefixResolver>;
        querySerialization?: QuerySerialization;
        base?: string;
      }
    | undefined;
  const prefix = options?.prefix;

  const querySer = options?.querySerialization;

  const base = options?.base;

  // Per-builder: warn once per route template that triggered slash collapsing.
  // Keeps predictability — users see exactly which declaration is producing
  // unexpected `//` segments (prefix resolving to empty, stray `//` in template,
  // trailing-slash prefix + leading-slash suffix, etc.).
  const warnedKeys = new Set<string>();

  type CallOpts = {
    param?: Record<string, UrlPrimitive | ReadonlyArray<UrlPrimitive>>;
    query?: Record<string, QueryValue | undefined>;
    hash?: string;
  };

  const toString = (key: string, opts?: CallOpts): string => {
    const rawPath = buildPath(key, opts, prefix);
    const normalizedPath = normalizeSlashes(rawPath);

    if (normalizedPath !== rawPath && !warnedKeys.has(key)) {
      warnedKeys.add(key);
      pathWarn(
        `Collapsed consecutive slashes: "${rawPath}" → "${normalizedPath}" (path: "${key}")`,
      );
    }

    const query = buildQuery(opts?.query, querySer);
    const hash = buildHash(opts?.hash);

    return normalizedPath + query + hash;
  };

  const toUrl = (key: string, opts?: CallOpts): URL => {
    const str = toString(key, opts);
    if (/^https?:\/\//i.test(str)) {
      return new URL(str);
    }
    if (base === undefined) {
      throw pathError('URL_REQUIRES_BASE', { relativePath: str });
    }
    return new URL(str, base);
  };

  return Object.assign(toString, { url: toUrl }) as unknown as PathTo<Routes>;
}

function buildHash(hash: string | undefined): string {
  if (hash === undefined) return '';
  if (hash === '') {
    pathWarn('Empty string passed as hash — no fragment will be appended');
    return '';
  }
  return `#${encodeURIComponent(hash)}`;
}

/** Collapse `//+` to `/` in the path portion, preserving scheme `://`. */
function normalizeSlashes(url: string): string {
  const schemeMatch = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i.exec(url);
  if (schemeMatch) {
    return schemeMatch[1]! + schemeMatch[2]!.replace(/\/+/g, '/');
  }
  return url.replace(/\/+/g, '/');
}

function buildPath(
  key: string,
  opts:
    | {
        param?: Record<string, UrlPrimitive | ReadonlyArray<UrlPrimitive>>;
        query?: Record<string, QueryValue | undefined>;
      }
    | undefined,
  prefix: Record<string, PrefixResolver> | undefined,
): string {
  const withPrefixes = key.replace(/\[(\w+)\]/g, (_match, name: string) => {
    const resolver = prefix?.[name];
    if (resolver === undefined) {
      throw pathError('MISSING_PREFIX', { name, path: key });
    }
    const value = typeof resolver === 'function' ? resolver() : resolver;
    if (value === undefined) {
      throw pathError('PREFIX_RETURNED_UNDEFINED', { name, path: key });
    }
    const schemeMatch = SCHEME_PATTERN.exec(value);
    if (schemeMatch && !ALLOWED_SCHEMES.has(schemeMatch[1]!.toLowerCase())) {
      throw pathError('DISALLOWED_SCHEME', {
        name,
        value,
        scheme: schemeMatch[1]!,
        path: key,
      });
    }
    return value;
  });

  const withCatchAll = withPrefixes.replace(
    /\{\.\.\.(\w+)\}/g,
    (_match, name: string) => {
      const value = opts?.param?.[name];
      if (value === undefined) {
        throw pathError('MISSING_CATCH_ALL', { name, path: key });
      }
      if (!Array.isArray(value)) {
        throw pathError('CATCH_ALL_NOT_ARRAY', { name, value, path: key });
      }
      return value.map((v) => encodeURIComponent(String(v))).join('/');
    },
  );

  return withCatchAll.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = opts?.param?.[name];
    if (value === undefined) {
      throw pathError('MISSING_PARAM', { name, path: key });
    }
    if (typeof value === 'string' && value.includes('/')) {
      throw pathError('PARAM_CONTAINS_SLASH', { name, value });
    }
    return encodeURIComponent(String(value));
  });
}

function buildQuery(
  query: Record<string, QueryValue | undefined> | undefined,
  ser: QuerySerialization | undefined,
): string {
  if (!query) return '';

  const arrayStyle = ser?.array ?? 'repeat';
  const booleanStyle = ser?.boolean ?? 'string';
  const emptyStyle = ser?.empty ?? 'omit';

  const parts: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (arrayStyle === 'repeat') {
        for (const v of value) {
          const part = renderEntry(key, v, booleanStyle, emptyStyle);
          if (part !== null) parts.push(part);
        }
      } else {
        if (value.length === 0) continue;
        const segments: string[] = [];
        for (const v of value) {
          if (v === '' && emptyStyle === 'omit') continue;
          if (typeof v === 'boolean' && booleanStyle === 'flag') {
            if (v) segments.push('true');
          } else {
            segments.push(encodeURIComponent(String(v)));
          }
        }
        if (segments.length === 0) continue;
        parts.push(`${encodeURIComponent(key)}=${segments.join(',')}`);
      }
    } else {
      const part = renderEntry(
        key,
        value as UrlPrimitive,
        booleanStyle,
        emptyStyle,
      );
      if (part !== null) parts.push(part);
    }
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function renderEntry(
  key: string,
  value: UrlPrimitive,
  booleanStyle: 'string' | 'flag',
  emptyStyle: 'omit' | 'keep',
): string | null {
  if (value === '' && emptyStyle === 'omit') return null;
  if (typeof value === 'boolean' && booleanStyle === 'flag') {
    return value ? encodeURIComponent(key) : null;
  }
  return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

/**
 * Extract the union of declared route keys from a `pathTo` function.
 *
 * @example
 * ```ts
 * type Keys = RouteKeys<typeof pathTo>;
 * //   ^? '/users/{id}' | '/search' | ...
 * ```
 */
export type RouteKeys<F> = F extends { __routes?: infer R }
  ? keyof R & string
  : never;

/**
 * Extract the `param` shape for a given route key from a `pathTo` function.
 *
 * @example
 * ```ts
 * type P = ParamOf<typeof pathTo, '/users/{id}'>; // { id: number }
 * ```
 */
export type ParamOf<F, K extends RouteKeys<F>> = F extends {
  __routes?: infer R;
}
  ? K extends keyof R & string
    ? R[K] extends RouteDef
      ? ParamOfRoute<K, R[K]>
      : never
    : never
  : never;

/**
 * Extract the `query` shape (as `Partial`) for a given route key.
 *
 * @example
 * ```ts
 * type Q = QueryOf<typeof pathTo, '/search'>;
 * //   ^? Partial<{ q: string; page: number }>
 * ```
 */
export type QueryOf<F, K extends RouteKeys<F>> = F extends {
  __routes?: infer R;
}
  ? K extends keyof R & string
    ? R[K] extends RouteDef
      ? QueryOfDef<R[K]>
      : never
    : never
  : never;

/**
 * Extract the `hash` literal union for a given route key.
 *
 * @example
 * ```ts
 * type H = HashOf<typeof pathTo, '/settings'>;
 * //   ^? 'account' | 'privacy'
 * ```
 */
export type HashOf<F, K extends RouteKeys<F>> = F extends {
  __routes?: infer R;
}
  ? K extends keyof R & string
    ? R[K] extends RouteDef
      ? HashOfDef<R[K]>
      : never
    : never
  : never;
