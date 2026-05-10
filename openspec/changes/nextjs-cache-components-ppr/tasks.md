# Tasks: Adopt Next.js Cache Components with PPR

## Phase 1: Foundation / Rendering Boundaries

- [ ] 1.1 Refactor `src/app/layout.tsx` so the root shell can support server-first streaming without moving interactive flows into the page tree.
- [ ] 1.2 Refactor `src/app/busy/layout.tsx` to own the busy-area shell and prepare the tree for deferred sections.
- [ ] 1.3 Refactor `src/app/admin/layout.tsx` to follow the same server-shell pattern used by the busy area.
- [ ] 1.4 Add or update loading fallbacks where shell and deferred content are intentionally split.

## Phase 2: Cacheable Server Reads

- [ ] 2.1 Create `src/lib/server/cache/tenant-context.ts` with a deterministic tenant/context read helper.
- [ ] 2.2 Create `src/lib/server/cache/dashboard-stats.ts` with a cacheable read for stable dashboard summaries.
- [ ] 2.3 Create `src/lib/server/cache/catalogs.ts` for shared lookup data used across routes.
- [ ] 2.4 Create `src/lib/server/cache/finance.ts` for reusable financial summary reads.
- [ ] 2.5 Add tests for each helper in the nearest `*.test.ts` file using fixed fixtures and repeated inputs.

## Phase 3: Pilot Routes

- [ ] 3.1 Wire `src/app/admin/page.tsx` to consume the new server helpers instead of duplicating reads.
- [ ] 3.2 Wire `src/app/busy/reportes/page.tsx` to render with deferred data and explicit loading fallbacks.
- [ ] 3.3 Wire `src/app/busy/contabilidad/page.tsx` to reuse the shared cacheable finance reads.
- [ ] 3.4 Keep mutation-heavy or interactive subtrees in client islands only where needed.

## Phase 4: Dynamic Flow Safeguards

- [ ] 4.1 Verify that login, onboarding, uploads, and create/update flows remain outside cache boundaries.
- [ ] 4.2 Confirm that routes with `dynamic = 'force-dynamic'` continue to bypass cache reuse.
- [ ] 4.3 Ensure user- or tenant-scoped data produces distinct cache keys.

## Phase 5: Verification / Regression

- [ ] 5.1 Run `pnpm run typecheck` for the touched server/client boundaries.
- [ ] 5.2 Run `pnpm run lint` on the modified files.
- [ ] 5.3 Run `pnpm run test:run` for the cache helpers and pilot route tests.
- [ ] 5.4 Manually verify that the shell renders before deferred content on the pilot routes.
