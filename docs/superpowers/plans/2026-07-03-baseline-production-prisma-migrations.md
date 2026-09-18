# Baseline production Prisma migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baselinear la base de producción para que Prisma Migrate deje de ver decenas de migraciones pendientes sin aplicar cambios destructivos sobre un schema ya vivo.

**Architecture:** La base productiva ya tiene tablas activas pero no tiene `_prisma_migrations`. El approach seguro es crear la tabla de historial, marcar como `resolved` solo las migraciones que corresponden al estado actual y dejar `migrate deploy` funcional para migraciones futuras, evitando re-ejecutar DDL histórico sobre tablas existentes.

**Tech Stack:** Prisma Migrate, PostgreSQL (Railway), TypeScript, shell scripts operativos.

---

## File Structure

**Create**
- `scripts/ops/baseline-prisma-production.ts` — script asistido para inspección y baseline controlado.
- `scripts/ops/__tests__/baseline-prisma-production.test.ts` — tests del mapeo de baseline.
- `docs/ops/prisma-production-baseline.md` — runbook operativo para producción.
- `docs/superpowers/plans/2026-07-03-baseline-production-prisma-migrations.md` — este plan.

**Modify**
- `prisma/migrations/` — no se cambian migraciones históricas; solo se lee metadata.
- `package.json` — agregar script operativo si conviene (`ops:baseline-prisma-production`).

---

### Task 1: Congelar evidencia del estado productivo actual

**Files:**
- Create: `docs/ops/prisma-production-baseline.md`

- [ ] **Step 1: Document the verified production facts**

```md
## Verified facts
- Production DB has `tenant_licenses`.
- Production DB does NOT have `_prisma_migrations`.
- `prisma migrate status` reports 46 migrations pending because history is empty.
- `tenant_licenses.featureOverrides` already exists in production.
```

- [ ] **Step 2: Capture current DB evidence with exact commands**

Run:
```bash
export DATABASE_URL='...'
pnpm prisma migrate status
```
Expected: pending migration list because no `_prisma_migrations` rows exist.

Run:
```bash
export DATABASE_URL='...'
psql "$DATABASE_URL" -c "\dt"
```
Expected: application tables exist, including `tenant_licenses`.

- [ ] **Step 3: Write the rollback note**

```md
## Rollback note
Do NOT run `prisma migrate deploy` against this DB until baseline is complete, or Prisma may attempt to replay historical DDL on existing tables.
```

- [ ] **Step 4: Save the runbook draft**

Run: no command, just save `docs/ops/prisma-production-baseline.md`.
Expected: file created.

- [ ] **Step 5: Commit**

```bash
git add docs/ops/prisma-production-baseline.md
git commit -m "docs: capture prisma production baseline facts"
```

---

### Task 2: Automatizar el mapa de migraciones a baselinear

**Files:**
- Create: `scripts/ops/baseline-prisma-production.ts`
- Test: `scripts/ops/__tests__/baseline-prisma-production.test.ts`

- [ ] **Step 1: Write the failing tests for migration grouping**

```ts
import { describe, expect, it } from 'vitest';
import { getBaselineMigrationNames } from '../baseline-prisma-production';

describe('getBaselineMigrationNames', () => {
  it('returns all historical migrations before live baseline cutover', () => {
    const names = getBaselineMigrationNames([
      '20250501000000_add_tenant_models',
      '20260703113000_add_feature_overrides_to_tenant_license',
    ]);

    expect(names).toEqual([
      '20250501000000_add_tenant_models',
      '20260703113000_add_feature_overrides_to_tenant_license',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run scripts/ops/__tests__/baseline-prisma-production.test.ts`
Expected: FAIL because script does not exist.

- [ ] **Step 3: Implement the migration inventory helper**

```ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function getAllMigrationNames(migrationsDir: string): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function getBaselineMigrationNames(names: string[]): string[] {
  return [...names].sort();
}
```

- [ ] **Step 4: Run the test again**

Run: `CI=1 pnpm exec vitest run scripts/ops/__tests__/baseline-prisma-production.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ops/baseline-prisma-production.ts scripts/ops/__tests__/baseline-prisma-production.test.ts
git commit -m "chore: add prisma production baseline helper"
```

---

### Task 3: Crear el flujo de baseline seguro

**Files:**
- Modify: `scripts/ops/baseline-prisma-production.ts`
- Modify: `docs/ops/prisma-production-baseline.md`

- [ ] **Step 1: Add a dry-run mode that prints resolve commands**

```ts
export function buildResolveCommands(names: string[]): string[] {
  return names.map(
    (name) => `pnpm prisma migrate resolve --applied ${name}`,
  );
}
```

- [ ] **Step 2: Print exact execution order in the script**

```ts
console.log('1. Verify DB backup exists');
console.log('2. Create _prisma_migrations table via prisma migrate resolve');
console.log('3. Mark every existing migration as applied');
console.log('4. Run prisma migrate status');
console.log('5. Run prisma migrate deploy only for future migrations');
```

- [ ] **Step 3: Document the exact production sequence**

```md
## Production sequence
1. Take Railway/Postgres backup.
2. Export `DATABASE_URL`.
3. Run dry-run helper.
4. Execute `prisma migrate resolve --applied <migration>` for each historical migration.
5. Run `pnpm prisma migrate status` and confirm no pending historical migrations remain.
6. Only then use `pnpm prisma migrate deploy` for new migrations.
```

- [ ] **Step 4: Verify the helper output locally**

Run: `pnpm tsx scripts/ops/baseline-prisma-production.ts --dry-run`
Expected: ordered list of `migrate resolve --applied ...` commands.

- [ ] **Step 5: Commit**

```bash
git add scripts/ops/baseline-prisma-production.ts docs/ops/prisma-production-baseline.md
git commit -m "docs: define safe prisma baseline sequence"
```

---

### Task 4: Ejecutar baseline controlado en producción

**Files:**
- Review: `docs/ops/prisma-production-baseline.md`
- Review: `scripts/ops/baseline-prisma-production.ts`

- [ ] **Step 1: Take and confirm a production backup**

Run:
```bash
# usar el mecanismo real de Railway/Postgres backup
```
Expected: confirmed backup identifier stored in ops notes.

- [ ] **Step 2: Run resolve for every historical migration**

Run example:
```bash
export DATABASE_URL='...'
pnpm prisma migrate resolve --applied 20250514033506_init
# repetir para cada migration folder existente
```
Expected: each migration registered as applied without replaying SQL.

- [ ] **Step 3: Verify status after baseline**

Run:
```bash
export DATABASE_URL='...'
pnpm prisma migrate status
```
Expected: no old historical migrations pending.

- [ ] **Step 4: Verify `_prisma_migrations` now exists and has rows**

Run:
```bash
psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY migration_name LIMIT 5;'
```
Expected: rows returned.

- [ ] **Step 5: Commit operational notes**

```bash
git add docs/ops/prisma-production-baseline.md
git commit -m "docs: record prisma production baseline runbook"
```

---

## Self-Review

- **Spec coverage:** cubre diagnóstico, helper, runbook y ejecución segura del baseline.
- **Placeholder scan:** no dejé TODO/TBD dentro del flujo principal.
- **Type consistency:** el plan usa siempre `baseline`, `_prisma_migrations` y `migrate resolve --applied` como contrato central.
