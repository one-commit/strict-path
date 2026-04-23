# strict-path

<p align="center">
  <img src="./assets/strict-path-icon.png" width="100px" align="center" alt="strict-path logo" />
  <h1 align="center">strict-path</h1>
  <p align="center">
    Type-safe path builder for TypeScript
  </p>
</p>

<div align="center">
  <a href="https://www.npmjs.com/package/strict-path">
    <img src="https://img.shields.io/npm/v/strict-path" alt="npm version" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  </a>
  <p>
Type-safe path builder for TypeScript page routes, API endpoints, CDN assets, public paths, and more. Zero codegen, zero runtime dependencies.
  </p>
</div>

```ts
const pathTo = createPaths<{
  '/users/{id}': { param: { id: number } };
  '/search': { query: { q: string; page: number } };
  '/[tenant]/dashboard': {};
}>({ prefix: { tenant: 'acme' } });

pathTo('/users/{id}', { param: { id: 1 } }); // '/users/1'
pathTo('/search', { query: { q: 'ts', page: 2 } }); // '/search?q=ts&page=2'
pathTo('/[tenant]/dashboard'); // '/acme/dashboard'
```

---

## Contents

- [Why strict-path?](#why-strict-path)
- [Install](#install)
- [Quick start](#quick-start)
  - [Starter template](#starter-template)
- [Core concepts](#core-concepts)
  - [Path templates](#path-templates)
  - [Required vs optional](#required-vs-optional)
  - [URL instance output](#url-instance-output)
  - [Query serialization](#query-serialization)
- [Runtime support](#runtime-support)
- [Framework examples](#framework-examples)
  - [Next.js App Router](#nextjs-app-router)
  - [React + context](#react--context)
  - [Typed API client](#typed-api-client)
  - [CDN / versioned assets](#cdn--versioned-assets)
  - [Public / static paths](#public--static-paths)
- [API reference](#api-reference)
- [Error handling](#error-handling)
- [FAQ](#faq)
  - [Why no async prefix resolvers?](#why-no-async-prefix-resolvers)
  - [What about pre-encoded values?](#what-about-pre-encoded-values)
  - [Why is `param` enforced at the declaration site?](#why-is-param-enforced-at-the-declaration-site)
  - [Why forbid `/` inside a single-segment `{name}`?](#why-forbid--inside-a-single-segment-name)
  - [Why are protocol-relative URLs (`//`) not supported?](#why-are-protocol-relative-urls--not-supported)
  - [What makes `strict-path` different?](#what-makes-strict-path-different)
- [Comparison](#comparison)
- [License](#license)

---

## Why strict-path?

Whenever you string-concat a path — a page route, an API endpoint, a CDN asset URL, a file path — you're one typo away from a silent runtime bug:

- Path typos (`/user/` vs `/users/`) are never caught
- Param names drift when routes are renamed — compiler stays silent
- Encoding is easy to forget (`#`, `/`, `&`, Unicode)
- Tenant/locale/CDN prefixes get duplicated by hand at every call site

`strict-path` lets you declare **any kind of path** as TypeScript types and gives you an autocomplete-friendly builder in return. One package for routes, endpoints, assets, and beyond.

---

## Install

```bash
npm install strict-path
```

Requirements: TypeScript ≥ 5.0 (uses `const` type parameters).

---

## Quick start

```ts
import { createPaths } from 'strict-path';

const pathTo = createPaths<{
  '/users/{id}': { param: { id: number } };
  '/search': { query: { q: string; page: number } };
  '/settings': { hash: 'account' | 'privacy' };
}>();

pathTo('/users/{id}', { param: { id: 1 } });
// '/users/1'

pathTo('/search', { query: { q: 'typescript', page: 2 } });
// '/search?q=typescript&page=2'

pathTo('/settings', { hash: 'account' });
// '/settings#account'
```

TypeScript catches mistakes before they run:

```ts
pathTo('/users/{id}', { param: { id: 1 } }); // ✅ '/users/1'

pathTo('/user/{id}', { param: { id: 1 } }); // ❌ '/user/{id}' is not declared
pathTo('/users/{id}'); // ❌ required param missing
pathTo('/users/{id}', { param: { id: 'abc' } }); // ❌ id must be number
pathTo('/settings', { hash: 'unknown' }); // ❌ literal not in declared union

// Declarations are also strictly checked:
createPaths<{ '/users/{id}': {} }>(); // ❌ path has {id} but no param declared
```

---

### Starter template

Paste this into `src/lib/paths.ts` (or wherever your project puts shared modules):

```ts
import {
  createPaths,
  type ParamOf,
  type QueryOf,
  type HashOf,
  type RouteKeys,
} from 'strict-path';

export const pathTo = createPaths<{
  // Declare routes here. Examples:
  // '/users/{id}':     { param: { id: number } };
  // '/search':         { query: { q: string; page?: number } };
  // '/settings':       { hash?: 'account' | 'privacy' };
}>();

// Pre-bound type utilities — reuse across your forms, fetchers, tests, etc.
export type PathKey = RouteKeys<typeof pathTo>;
export type PathParamOf<K extends PathKey> = ParamOf<typeof pathTo, K>;
export type PathQueryOf<K extends PathKey> = QueryOf<typeof pathTo, K>;
export type PathHashOf<K extends PathKey> = HashOf<typeof pathTo, K>;
```

Then anywhere in your app:

```ts
// Any file, any runtime
import { pathTo, type PathParamOf } from '@/lib/paths';

function fetchUser(args: PathParamOf<'/users/{id}'>) {
  return fetch(pathTo('/users/{id}', { param: args }));
}
```

---

## Core concepts

### Path templates

Three placeholder syntaxes in the URL template key:

| Syntax      | Name                    | Runtime value                   | Example           |
| ----------- | ----------------------- | ------------------------------- | ----------------- |
| `{name}`    | single-segment param    | `string` / `number` / `boolean` | `/users/{id}`     |
| `{...name}` | catch-all param         | `ReadonlyArray<…primitive>`     | `/docs/{...path}` |
| `[name]`    | runtime-resolved prefix | static value or sync resolver   | `/[tenant]/…`     |

```ts
createPaths<{
  '/users/{id}': { param: { id: number } };
  '/docs/{...path}': { param: { path: string[] } };
  '/[cc]/profile': {};
  '[api]/v1/users/{id}': { param: { id: string } };
}>({ prefix: { cc: 'acme', api: () => process.env.API_URL! } });
```

Notes:

- A `/` inside a single-segment `{name}` throws — use `{...name}` for multi-segment.
- Prefix resolved values with a URL scheme must be `http:` or `https:` (prevents `javascript:` injection).
- Protocol-relative URLs (`//cdn.example.com`) are **not supported** — `//` is collapsed to `/`. Use `https://` explicitly.
- Prefix names declared in your templates must all appear in `prefix` — missing keys are compile errors.

### Required vs optional

`strict-path` respects your declaration — **no silent auto-optionality**.

**Param** is required whenever the path contains `{name}` or `{...name}` (enforced at declaration time):

```ts
createPaths<{ '/users/{id}': {} }>(); // ❌ param missing for {id}
createPaths<{ '/users/{id}': { param: { id: number } } }>(); // ✅
```

**Query & hash** mirror their declaration exactly:

```ts
{ query: { q: string } }       // query required (q required inside)
{ query: { q?: string } }      // query omitable (all inner optional)
{ query?: { q: string } }      // query omitable (inner still required when provided)

{ hash: 'a' | 'b' }            // hash required
{ hash?: 'a' | 'b' }           // hash omitable
```

No automatic `Partial<>` wrapping. What you declare is what the call site sees.

> **Note:** passing `hash: ''` emits a `[strict-path]` console warning and produces no `#` fragment. Express "no hash" by omitting the field or declaring it optional — not by passing an empty string.

### URL instance output

`pathTo.url(...)` returns a WHATWG `URL` instance. The result must be absolute — either via a prefix resolving to `https://…`, or via the `base` option:

```ts
const pathTo = createPaths<{ '/users/{id}': { param: { id: number } } }>({
  base: 'http://localhost:3000',
});

const url = pathTo.url('/users/{id}', { param: { id: 1 } });
// URL { href: 'http://localhost:3000/users/1', pathname: '/users/1', ... }
```

Useful when you need `url.searchParams.append(...)` or want to hand a `URL` to `fetch`.

### Query serialization

Tune how arrays/booleans/empty strings are emitted per builder:

```ts
createPaths<{ '/api/search': { query: { tags: string[]; active: boolean } } }>({
  querySerialization: {
    array: 'comma', // 'repeat' (default) → ?t=a&t=b ; 'comma' → ?t=a,b
    boolean: 'flag', // 'string' (default) → ?active=true ; 'flag' → ?active (true only)
    empty: 'omit', // 'omit' (default) drops empty strings ; 'keep' → ?q=
  },
});
```

---

## Runtime support

`strict-path` has zero runtime dependencies and uses only standard Web/JS platform features (`URL`, `encodeURIComponent`). It runs unchanged in:

- Node ≥ 18
- Any modern browser (ES2022)
- Deno, Bun
- Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy)

Same import, same API, anywhere:

```ts
import { createPaths } from 'strict-path';

const pathTo = createPaths<{
  '/users/{id}': { param: { id: number } };
  '[api]/v1/{resource}': { param: { resource: string } };
}>({
  prefix: { api: 'https://api.example.com' },
});

// Browser — inside an anchor
linkEl.href = pathTo('/users/{id}', { param: { id: 1 } });

// Node — inside fetch
await fetch(pathTo('[api]/v1/{resource}', { param: { resource: 'users' } }));
```

---

## Framework examples

### Next.js App Router

```ts
// src/lib/paths.ts — shared factory
import { createPaths } from 'strict-path';

export const createAppPaths = (getLocale: () => string) =>
  createPaths<{
    '/[locale]/posts/{id}': { param: { id: string } };
    '/[locale]/settings': { hash?: 'account' | 'privacy' };
  }>({ prefix: { locale: getLocale } });
```

```ts
// src/lib/paths.server.ts
import { createAppPaths } from './paths';
import { getServerLocale } from './locale.server'; // reads from request context (AsyncLocalStorage, React cache, etc.)

export const pathTo = createAppPaths(getServerLocale);
```

```ts
// src/lib/paths.client.ts
import { createAppPaths } from './paths';
import { getClientLocale } from './locale.client'; // reads from React context or global store

export const pathTo = createAppPaths(getClientLocale);
```

```tsx
// Server component — import from paths.server
import { pathTo } from '@/lib/paths.server';
<Link href={pathTo('/[locale]/posts/{id}', { param: { id: 'abc' } })}>Read more</Link>

// Client component — import from paths.client
import { pathTo } from '@/lib/paths.client';
<Link href={pathTo('/[locale]/settings')}>Settings</Link>
```

Same factory, different locale resolvers. `pathTo` is always synchronous — plug it directly into JSX or any synchronous context.

### React + context

```tsx
// TenantPathProvider.tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createPaths } from 'strict-path';

const build = (prefix: { tenant: string }) =>
  createPaths<{
    '/[tenant]/dashboard': {};
    '/[tenant]/users/{id}': { param: { id: number } };
  }>({ prefix });

const Ctx = createContext<ReturnType<typeof build> | null>(null);

export function TenantPathProvider({
  tenant,
  children,
}: {
  tenant: string;
  children: ReactNode;
}) {
  const pathTo = useMemo(() => build({ tenant }), [tenant]);
  return <Ctx.Provider value={pathTo}>{children}</Ctx.Provider>;
}

export function usePathTo() {
  const pathTo = useContext(Ctx);
  if (!pathTo) throw new Error('TenantPathProvider missing');
  return pathTo;
}
```

### Typed API client

```ts
import { createPaths } from 'strict-path';

const api = createPaths<{
  '[base]/v1/users/{id}': { param: { id: string } };
  '[base]/v1/users': { query: { role?: 'admin' | 'user' } };
  '[base]/v1/posts': {};
}>({
  prefix: { base: () => process.env.API_URL! },
});

// GET with path param
const user = await fetch(api('[base]/v1/users/{id}', { param: { id: 'u_1' } }));

// GET with query
const admins = await fetch(api('[base]/v1/users', { query: { role: 'admin' } }));

// POST — strict-path builds the URL; the request body is your concern
await fetch(api('[base]/v1/posts'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Hello', content: '...' }),
});
```

`strict-path` builds the URL. Combine with `ky`, `ofetch`, or plain `fetch` for the rest.

### CDN / versioned assets

```ts
const asset = createPaths<{
  '[cdn]/[version]/avatars/{userId}.png': { param: { userId: number } };
}>({
  prefix: {
    cdn: 'https://cdn.example.com',
    version: 'v2',
  },
});

asset('[cdn]/[version]/avatars/{userId}.png', { param: { userId: 42 } });
// 'https://cdn.example.com/v2/avatars/42.png'
```

### Public / static paths

Not just URLs — `strict-path` works for any path your code constructs. Here it manages a Next.js `public/` directory layout:

```ts
const publicPath = createPaths<{
  '/icon/logo.svg': {};
  '/images/{name}': { param: { name: string } };
  '/fonts/{family}.woff2': { param: { family: string } };
  '/favicon.ico': {};
}>();

publicPath('/icon/logo.svg');
// '/icon/logo.svg'
publicPath('/images/{name}', { param: { name: 'hero.webp' } });
// '/images/hero.webp'
publicPath('/fonts/{family}.woff2', { param: { family: 'inter' } });
// '/fonts/inter.woff2'
```

The same approach works for Node.js file serving paths, Electron asset paths, or any context where paths are strings you build by hand today.

---

## API reference

### `createPaths<Routes>(options?)`

Creates a URL builder.

**Type parameter**: `Routes` — object map where keys are URL templates and values are `{ param?, query?, hash? }` shapes. The type system enforces that every `{name}` / `{...name}` in a key has a matching declaration in `param`.

**Options**:

| Field                | Type                                                | When                       | Notes                                                                                                            |
| -------------------- | --------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prefix`             | `Record<name, string \| () => string \| undefined>` | Any `[name]` in a template | TS requires every declared prefix name. Resolved values must be `http:` or `https:` if they start with a scheme. |
| `querySerialization` | see below                                           | Optional                   | Controls how arrays/booleans/empty strings are emitted.                                                          |
| `base`               | `string`                                            | Optional                   | Fallback base URL for `pathTo.url()` when the output is a relative path.                                         |

Returns a `pathTo` function with a `.url()` method.

### `pathTo(key, opts?)` → `string`

Substitutes `{name}`, `{...name}`, `[name]` in `key`, then appends query and hash. Throws [`StrictPathError`](#error-handling) if substitution fails.

### `pathTo.url(key, opts?)` → `URL`

Same call signature; returns a `URL` instance. Throws `StrictPathError` with code `URL_REQUIRES_BASE` if the result is relative and no `base` was configured.

### `querySerialization` options

| Option    | Values                  | Default    | Effect                                                     |
| --------- | ----------------------- | ---------- | ---------------------------------------------------------- |
| `array`   | `'repeat'` \| `'comma'` | `'repeat'` | `?t=a&t=b` or `?t=a,b`                                     |
| `boolean` | `'string'` \| `'flag'`  | `'string'` | `?active=true` or `?active` (`true` only; `false` omitted) |
| `empty`   | `'omit'` \| `'keep'`    | `'omit'`   | Drop or keep empty-string values                           |

### Type utilities

```ts
import type { ParamOf, QueryOf, HashOf, RouteKeys } from 'strict-path';

type UserParam = ParamOf<typeof pathTo, '/users/{id}'>; // { id: number }
type SearchQuery = QueryOf<typeof pathTo, '/search'>; // { q: string; page: number }
type SettingsHash = HashOf<typeof pathTo, '/settings'>; // 'account' | 'privacy'
type AllKeys = RouteKeys<typeof pathTo>; // union of declared keys
```

`QueryOf` / `HashOf` return the declared shape as-is — no automatic `Partial<>`.

---

## Error handling

All runtime failures throw `StrictPathError` with a stable `code`:

```ts
import { StrictPathError } from 'strict-path';
import type { ErrorCode } from 'strict-path';

try {
  pathTo('/users/{id}', { param: { id: 1 } });
} catch (e) {
  if (e instanceof StrictPathError && e.code === 'DISALLOWED_SCHEME') {
    // handle disallowed-scheme case
  }
}
```

Possible `ErrorCode` values:

| Code                        | When                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `MISSING_PARAM`             | Single-segment `{name}` param missing at runtime (TS normally blocks this) |
| `PARAM_CONTAINS_SLASH`      | Single-segment value contains `/` — use catch-all instead                  |
| `MISSING_CATCH_ALL`         | Catch-all `{...name}` value missing at runtime                             |
| `CATCH_ALL_NOT_ARRAY`       | Catch-all value is not an array                                            |
| `MISSING_PREFIX`            | Prefix config does not cover a declared `[name]` (TS normally blocks this) |
| `PREFIX_RETURNED_UNDEFINED` | Prefix resolver function returned `undefined`                              |
| `DISALLOWED_SCHEME`         | Prefix resolved to a URL with non-http/https scheme                        |
| `URL_REQUIRES_BASE`         | `pathTo.url()` called on a relative path without a `base` option           |

Every message is prefixed with `[strict-path]`.

---

## FAQ

### ❗️ Why no async prefix resolvers?

Resolving a prefix asynchronously (e.g. Next.js 15 `cookies()` in server components) is common. `strict-path`'s answer: resolve async data upstream, then pass a sync accessor into `createPaths` — often via a factory:

```ts
// ❌ async resolvers are not supported
createPaths<{ '/[locale]/posts/{id}': { param: { id: string } } }>({
  prefix: { locale: async () => await fetchLocale() },
});

// ✅ build a factory — pass a sync resolver per environment
const createLocalePaths = (getLocale: () => string) => createPaths<{
  '/[locale]/posts/{id}': { param: { id: string } };
  '/[locale]/settings': { hash?: 'account' | 'privacy' };
}>({
  prefix: {
    locale: getLocale
  }
});

// Server: resolver reads from AsyncLocalStorage (populated by middleware)
export const pathTo = createLocalePaths(() => localeStorage.getStore()!);

// Client: resolver reads from React context or a global store
export const pathTo = createLocalePaths(() => useLocaleStore.getState().locale);
```

This keeps `pathTo` synchronous — it can appear directly in JSX attributes, template literals, and any synchronous context. Making it async would break this ergonomic property for every call site to handle one edge case.

### What about pre-encoded values?

`strict-path` always encodes what you pass. If your data is already URL-encoded (e.g. stored that way in a database), `decodeURIComponent` it before passing — normalize at the boundary.

### Why is `param` enforced at the declaration site?

With auto-inference, `'/users/{id}': {}` would silently accept anything. Enforcing an explicit `param: { id: ... }` at declaration time:

- Surfaces the missing declaration as a compile error with a clear message
- Lets you pick the exact value type (`number` vs `string` vs `'admin' | 'guest'`) instead of defaulting to `string | number | boolean`
- Keeps the declaration a faithful contract of what the URL requires

### Why forbid `/` inside a single-segment `{name}`?

Single segments stay single. Use a catch-all `{...name}` when your value spans multiple segments:

```ts
// ❌ throws PARAM_CONTAINS_SLASH at runtime
createPaths<{ '/docs/{path}': { param: { path: string } } }>();
pathTo('/docs/{path}', { param: { path: 'guide/intro' } });

// ✅ catch-all for multi-segment values
createPaths<{ '/docs/{...path}': { param: { path: string[] } } }>();
pathTo('/docs/{...path}', { param: { path: ['guide', 'intro'] } });
// '/docs/guide/intro'
```

This makes the intent explicit in the type and prevents accidental path injection via a string that happens to contain `/`.

### Why are protocol-relative URLs (`//`) not supported?

`//cdn.example.com` is collapsed to `/cdn.example.com` by the internal slash-normalizer. Protocol-relative URLs are a legacy pattern — HTTPS is universal today, so there's no need to inherit the page scheme. Use `https://cdn.example.com` in your prefix value.

### What makes `strict-path` different?

`strict-path` is a zero-runtime, zero-dependency path builder. It has no opinion on your router, your fetch client, or your framework — it composes cleanly with whatever you already use. And it's not limited to page routes: the same API covers API endpoints, CDN asset URLs, public static paths, and any other path your code constructs by hand. One package, any runtime, any kind of path.

---

## License

MIT
