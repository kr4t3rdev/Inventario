# Proposal: Adopt Next.js Cache Components with PPR

## Intent

The project is already on Next.js 16.2.4, but it is still mostly client-driven at the page level. That leaves performance on the table: shells render late, repeated server work is recomputed across routes, and there is no explicit cache boundary for stable data.

This change introduces a server-first foundation for the read-heavy parts of the app using Partial Pre-Rendering (PPR) and `use cache`, while keeping transactional and highly dynamic flows client-side.

## Scope

### In Scope
1. Convert selected app shells to server-rendered layouts that can participate in PPR.
2. Extract stable data loaders into reusable cacheable server helpers.
3. Introduce `use cache` only for deterministic, repeatable reads.
4. Apply the pattern first to dashboards, reporting, and other read-heavy routes.
5. Keep forms, uploads, auth, and mutation-heavy flows uncached.

### Out of Scope
- No global rewrite of every `page.tsx` to Server Components.
- No caching for login, onboarding, create/update, upload, or realtime flows.
- No Next.js Devtools MCP work in this change.
- No database schema or Prisma model changes.
- No build step as part of the change itself.

## Approach

The migration will be incremental:

1. Make the route shells server-owned so the app chrome can render earlier.
2. Move stable server reads into shared helper modules.
3. Wrap only the deferred parts in Suspense so the shell can stream before the data finishes.
4. Limit cache usage to inputs whose output is deterministic for a given tenant / context.

This is a targeted performance change, not a blanket optimization.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/layout.tsx` | Modified | Root shell can participate in PPR-friendly rendering |
| `src/app/busy/layout.tsx` | Modified | Busy-area shell becomes the primary owner of chrome and deferred content |
| `src/app/admin/layout.tsx` | Modified | Admin shell can expose stable structure earlier |
| `src/lib/server/cache/*` | New | Shared cacheable loaders for stable reads |
| `src/app/admin/page.tsx` | Modified | First pilot candidate for server-first cached reads |
| `src/app/busy/reportes/page.tsx` | Modified | Read-heavy route candidate for streaming and cache reuse |
| `src/app/busy/contabilidad/page.tsx` | Modified | Read-heavy route candidate for cacheable summaries |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Caching mutable or user-specific data incorrectly | High | Cache only deterministic reads and keep mutation-heavy routes dynamic |
| Mixing client components too high in the tree | Medium | Keep client islands small and isolated below server shells |
| Changing perceived UX while refactoring shells | Medium | Pilot on one dashboard/reporting path first and validate the layout manually |
| Over-caching stale dashboard data | Medium | Use cache only for inputs with stable meaning; leave real-time data uncached |

## Rollback Plan

1. Remove `use cache` from the affected server helpers.
2. Revert the touched layouts and pilot pages to the previous rendering boundaries.
3. Keep the shared helper modules, but call them without caching if needed.
4. Restore the prior client-side fetching path for the pilot routes.

## Dependencies

- Next.js 16.2.4 cache component support
- Existing App Router layouts and route structure
- Stable server data sources already used by dashboards and reports

## Success Criteria

- [ ] Selected shells render earlier without waiting for all page data.
- [ ] Stable data loaders are centralized and reused across routes.
- [ ] Read-heavy routes benefit from cache reuse and deferred rendering.
- [ ] Dynamic mutation-heavy flows remain uncached and function unchanged.
