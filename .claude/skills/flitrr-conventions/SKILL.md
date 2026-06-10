---
name: flitrr-conventions
description: "Flitrr engineering conventions — consult BEFORE writing or editing any code in this repo. Use whenever working on Flitrr / PULSE: adding pages, React components, auth flows, Supabase queries, SQL migrations, or styling. Flitrr is a Next.js 14 App Router SaaS written in PLAIN JavaScript (no TypeScript), styled with CSS Modules + design tokens (no Tailwind, no UI component libraries), backed by Supabase (auth + Postgres + Row Level Security). This skill encodes the Supabase browser/server client split, middleware auth gating, the RLS-first migration pattern, design-token styling, and the security guards. Apply it even when the user doesn't mention conventions — defaulting to TypeScript, shadcn/ui, Tailwind, or a service-role client would be wrong for this codebase."
metadata:
  author: flitrr
  version: "1.0.0"
---

# Flitrr / PULSE engineering conventions

Flitrr is an AI-assisted programme-management platform for SME real-estate
developers. **PULSE** is the first product (project initiation + stage-gate
lifecycle). This repo started as a landing page and grew into the product app,
so the same conventions cover marketing pages and the authenticated app.

Read this before touching code. The point is consistency: the codebase is
deliberately small-surface (no TypeScript, no UI library, no CSS framework) so
that everything stays legible and dependency-light. Match what's here rather
than reaching for the tools you'd use by default elsewhere.

## Stack snapshot

- **Next.js 14.2, App Router** — Server Components by default; `'use client'`
  only where interactivity demands it.
- **Plain JavaScript, never TypeScript.** No `.ts`/`.tsx`, no type annotations,
  no `tsconfig`. If you're about to write `: string`, stop.
- **CSS Modules + design tokens.** Co-located `*.module.css` per route/component.
  No Tailwind, no styled-components, no MUI/Chakra/shadcn. Brand colours and
  scale live as CSS custom properties in `app/globals.css`.
- **Supabase** via `@supabase/ssr` for auth + Postgres. Security boundary is
  **Row Level Security**, not app code.
- **Vercel** for hosting; `sharp` + `scripts/build-og.js` for OG images.
- Fonts via `next/font/google` exposed as CSS variables (`--font-heading`,
  `--font-body`). (These are wired in `app/layout.js` — the README's font names
  are stale; trust the code.)

## Golden rules (the defaults that would be wrong here)

- ❌ TypeScript → ✅ plain JS with JSDoc block comments for the "why".
- ❌ Tailwind / utility classes / inline style objects for layout → ✅ CSS
  Modules + token variables.
- ❌ shadcn/ui or any component library → ✅ hand-written small components.
- ❌ A single shared Supabase client → ✅ the **browser vs server split** below.
- ❌ Service-role key anywhere reachable by the browser, or `NEXT_PUBLIC_`
  service keys → ✅ publishable key + RLS; service role only in trusted
  server-only scripts if ever.
- ❌ Filtering data by user in JS (`.eq('user_id', …)` as the *only* guard) →
  ✅ rely on RLS; the query filter is convenience, RLS is the wall.

## Supabase: the client split

There are **three** Supabase entry points. Pick by execution context.

**1. Browser — `lib/supabase/client.js`** (synchronous). Use in Client
Components (`'use client'`).

```js
import { createClient } from '@/lib/supabase/client'; // relative paths in this repo
const supabase = createClient();
```

**2. Server — `lib/supabase/server.js`** (async, reads cookies). Use in Server
Components, Route Handlers, and Server Actions. **Must be awaited** — Next 14.2+
requires `await cookies()`.

```js
import { createClient } from '../../lib/supabase/server';
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

**3. Middleware — `middleware.js`.** Already wired. It refreshes the session
cookie on every request and gates `PROTECTED_PREFIXES` (`/dashboard`,
`/pulse/app`). Add new authed sections by extending that array — don't
re-implement gating per page.

Env vars (note the **publishable** key naming, not "anon"):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both must
also be set in Vercel for production.

## Auth patterns

**Protect a Server Component page** — fetch the user, redirect if absent:

```js
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // ...query owned data; RLS scopes it to this user automatically
}
```

**Route handlers** live at `app/<path>/route.js` and export HTTP verbs. See
`app/auth/callback/route.js` for the canonical shape: exchange the `?code` for a
session, then redirect.

**Open-redirect guard** — any `next`/return-path param from the URL must be
validated before redirecting to it: in-app only (`startsWith('/')` and
`!startsWith('//')`), else fall back to a safe default. Copy the `safeNext`
pattern; never redirect to a raw user-supplied URL.

## Database & migrations

Migrations are sequential, hand-written SQL in `supabase/migrations/`, named
`NNN_description.sql`. Apply in order; never edit a migration that's already
been run — add a new one.

**Three-file-per-feature pattern.** Each feature ships as a trio so concerns
stay separable (see PULSE projects: `004_…_schema.sql`, `005_…_rls.sql`,
`006_…_indexes.sql`):

1. **schema** — tables, enums, triggers.
2. **rls** — `ENABLE ROW LEVEL SECURITY` + per-action policies.
3. **indexes** — covering the columns RLS and queries filter on.

**Schema conventions:**
- Primary keys: `gen_random_uuid()` (built-in; no extension).
- Fixed-domain columns: native Postgres `ENUM` types (not `TEXT + CHECK`).
- `updated_at`: reuse the `update_updated_at()` trigger from
  `001_initial_schema.sql`.

**RLS is mandatory on every table.** The owner is `auth.uid() = user_id`.
Write **one policy per action** (select / insert / update / delete), named in
plain English to match `002_rls_policies.sql`:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);
```

**Child tables** are reached only through an owned parent — gate with an
`EXISTS` subquery, don't denormalise `user_id` onto every table:

```sql
CREATE POLICY "Users can view own project objectives"
  ON project_objectives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_objectives.project_id
      AND projects.user_id = auth.uid()
  ));
```

When you add a table, you have not finished until it has RLS enabled, four
policies, and an index on its foreign keys. A table without RLS is a data leak.

## Styling

- **CSS Modules, co-located.** `foo/page.js` ↔ `foo/page.module.css`. Import as
  `import styles from './page.module.css'` and reference `styles.card`.
- **Compose classes** with template strings:
  `` className={`${styles.pill} ${styles.pillLive}`} ``.
- **Use tokens, not raw values.** Colours, spacing, container width, and section
  padding are CSS custom properties in `globals.css`. The palette is **layered**:
  raw brand colours → semantic tokens (`--color-text-primary`,
  `--color-surface-card`, `--color-button-primary-bg`, …). Reference the
  *semantic* token in components; only touch raw colours when defining a new
  semantic token. The brand palette is locked (`LANDING_ASSET_MAP.md` Part D) —
  don't introduce new hex values for product UI. The one bare hex is
  `--color-error` for validation.
- No global class soup; keep styles scoped to their module.

## Routes, components, file layout

- App Router tree under `app/`. Each route folder owns `page.js` +
  `page.module.css`; route handlers are `route.js`.
- Shared components in `app/components/`; product-specific ones nested with the
  product (`app/pulse/components/`, `app/pulse/app/components/`).
- Non-component logic (derivations, models, rulesets) sits beside its feature as
  plain `.js` modules (e.g. `pulseRead.js`, `briefModel.js`, `riskModel.js`) and
  is kept **deterministic and pure** where possible — easy to reason about and
  test, no hidden I/O.
- Small presentational sub-components (e.g. `StatusPill`) are defined in the same
  file as their page when only used there; promote to `components/` when shared.

## Code style

- **JSDoc block comments** above non-trivial functions, components, and modules,
  explaining *why* (intent, edge cases, framework quirks) — not restating the
  code. Match the density already in the repo.
- Small named helpers over inline complexity (`deriveFirstName`,
  `sortProducts`, `formatUpdated`).
- Defensive fallbacks with `??` and explicit final defaults so UI never renders
  blank (e.g. greeting falls back to "there").
- No new runtime dependencies without a clear reason — the lean dependency list
  is a feature.

## Before you finish a change — checklist

- [ ] No TypeScript syntax crept in; no new UI-library/Tailwind import.
- [ ] Right Supabase client for the context (browser sync vs server `await`).
- [ ] New tables: RLS enabled, per-action policies, FK indexes, in the
      schema/rls/indexes trio.
- [ ] Any redirect from a URL param passes the in-app open-redirect guard.
- [ ] Styling uses CSS Modules + semantic tokens, no raw hex for product UI.
- [ ] New protected sections added to `PROTECTED_PREFIXES` in `middleware.js`.
- [ ] `npm run lint` is clean.
