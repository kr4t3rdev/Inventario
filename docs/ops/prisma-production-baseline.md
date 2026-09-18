# Prisma production baseline

## Verified facts

- Production DB has `tenant_licenses`.
- Production DB does **not** have `_prisma_migrations`.
- `pnpm prisma migrate status` reports historical migrations as pending because history is empty.
- `tenant_licenses.featureOverrides` already exists in production.

## Rollback note

Do **not** run `pnpm prisma migrate deploy` against this DB until baseline is complete, or Prisma may attempt to replay historical DDL on existing tables.

## Production sequence

1. Take a Railway/Postgres backup and store the backup identifier.
2. Export `DATABASE_URL` for the production database.
3. Run the helper in dry-run mode:

```bash
pnpm tsx scripts/ops/baseline-prisma-production.ts --dry-run
```

4. Execute every generated command:

```bash
pnpm prisma migrate resolve --applied <migration_name>
```

5. Verify Prisma history:

```bash
pnpm prisma migrate status
```

6. Verify `_prisma_migrations` has rows:

```bash
psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY migration_name LIMIT 5;'
```

7. Only after the baseline is healthy, use `pnpm prisma migrate deploy` for future migrations.

## Current production findings

- `_prisma_migrations` row count: `0`
- Baseline strategy required: `prisma migrate resolve --applied`
