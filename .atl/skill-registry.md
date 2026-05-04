# Skill Registry

## Compact Rules
- `sdd-*`: follow `sdd-phase-common`, persist artifacts, keep tasks/specs small and dependency-ordered.
- `nextjs` / `typescript`: use App Router patterns, absolute `@/` imports, strict typing, JSDoc on components/functions.
- `testing`: prefer Vitest, Testing Library, and Playwright; run focused tests for touched slices.
- `react`: keep components small, document props, and separate UI from business logic.
- `vercel`: use Next.js/App Router best practices and avoid build-time mutations during planning.

## Project Conventions
- Spanish UI text with rioplatense tone where user-facing.
- `pnpm` is the package manager.
- Avoid build after changes.
- Use conventional commits only.
- Keep auth/tenant code verified against repo state before asserting behavior.
