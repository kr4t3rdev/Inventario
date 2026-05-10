# Design: Adopt Next.js Cache Components with PPR

## Technical Approach

The implementation will move the app toward a server-first rendering model only where it provides measurable benefit. The root idea is to separate **shell rendering** from **data-heavy content**, then cache the stable server reads that are repeatedly requested across routes.

The change is intentionally incremental: server layouts first, then cacheable loaders, then pilot routes. Client components remain for forms, mutations, uploads, and interactive widgets.

## Architecture Decisions

### Decision: PPR is applied at shell boundaries, not globally

**Choice**: Convert `src/app/layout.tsx`, `src/app/busy/layout.tsx`, and `src/app/admin/layout.tsx` into the main server-owned shells for the affected areas.

**Alternatives considered**:
- Make every page server-first immediately
- Leave everything client-side and only add cache helpers

**Rationale**: The repo is currently client-heavy, so the safe win comes from rendering the shell earlier while preserving the current interaction model deeper in the tree.

### Decision: Cache only deterministic server reads

**Choice**: Introduce `use cache` only inside helper modules that return stable results for the same inputs.

**Alternatives considered**:
- Cache every fetch by default
- Rely on route-level caching only

**Rationale**: Broad caching would risk stale or incorrect tenant/user data. The repo already has highly dynamic flows, so cache boundaries must be explicit.

### Decision: Pilot on read-heavy routes first

**Choice**: Start with admin and reporting routes before touching transactional screens.

**Alternatives considered**:
- Start with forms and mutation flows
- Rewrite the whole app at once

**Rationale**: Dashboards and reports have the highest chance of repeat reads and the clearest user-facing performance gain.

### Decision: Keep client islands small and intentional

**Choice**: Any interactive widgets stay below a server shell as isolated client components.

**Alternatives considered**:
- Make the page client to avoid boundary issues
- Use client everywhere for consistency

**Rationale**: The app already uses client-heavy pages; the goal is to shrink those boundaries, not spread them.

## Data Flow

```text
Request
  -> Server shell/layout renders immediately
  -> Deferred sections call cacheable loaders when eligible
  -> Cached stable reads return fast on repeated inputs
  -> Interactive islands hydrate only where needed
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/layout.tsx` | Modify | Root shell becomes compatible with server-first streaming |
| `src/app/busy/layout.tsx` | Modify | Busy shell owns the chrome and hosts deferred sections |
| `src/app/admin/layout.tsx` | Modify | Admin shell becomes a stable rendering boundary |
| `src/app/admin/page.tsx` | Modify | First pilot route for cache-aware server rendering |
| `src/app/busy/reportes/page.tsx` | Modify | Pilot route for deferred reporting data |
| `src/app/busy/contabilidad/page.tsx` | Modify | Pilot route for cached summaries |
| `src/lib/server/cache/tenant-context.ts` | Create | Cacheable tenant/context loader |
| `src/lib/server/cache/dashboard-stats.ts` | Create | Cacheable dashboard-style summary loader |
| `src/lib/server/cache/catalogs.ts` | Create | Cacheable catalogs / shared lookups loader |
| `src/lib/server/cache/finance.ts` | Create | Cacheable finance summary loader |

## Interfaces / Contracts

```ts
export interface CacheableRead<TInput, TOutput> {
  readonly key: string
  readonly resolve: (input: TInput) => Promise<TOutput>
}
```

The contract is conceptual: cacheable reads must be deterministic, serializable, and safe to reuse for the same input tuple.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | cache helpers return consistent results for the same inputs | Vitest on server helper functions |
| Unit | dynamic flows remain uncached | tests asserting the helper is not used for mutation routes |
| Integration | shell renders before deferred content | Testing Library around server/client boundary composition |
| Integration | loading fallbacks appear for deferred sections | render tests for Suspense fallback behavior |
| E2E | pilot routes stay functional after the boundary split | Playwright on admin/reporting routes |

## Migration / Rollout

1. Add cache helpers without wiring them into every route.
2. Migrate the root/admin/busy shells to server-first structure.
3. Pilot one admin route and one reporting route.
4. Expand only after validating that data remains correct and the shell renders earlier.

## Open Questions

- [ ] Which report route gives the best first benchmark for perceived speed?
- [ ] Which shared lookups should be centralized first: tenant context, catalogs, or finance summaries?
