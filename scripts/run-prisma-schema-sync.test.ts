import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const roots: string[] = [];
const script = join(process.cwd(), 'scripts/run-prisma-schema-sync.sh');

/** @description Crea un entorno aislado con un stub de pnpm. @returns {string} Directorio. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'prisma-schema-sync-'));
  roots.push(root);
  const pnpm = join(root, 'pnpm');
  writeFileSync(pnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PRISMA_SYNC_CALLS"\n');
  chmodSync(pnpm, 0o755);
  const node = join(root, 'node');
  writeFileSync(node, '#!/bin/sh\nprintf "node %s\\n" "$*" >> "$PRISMA_SYNC_CALLS"\n');
  chmodSync(node, 0o755);
  return root;
}

/** @description Ejecuta el script con variables controladas. @returns {ReturnType<typeof spawnSync>} Resultado. */
function run(root: string, nodeEnv: string, mode?: string) {
  return spawnSync('/bin/sh', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${root}:${process.env.PATH ?? ''}`,
      NODE_ENV: nodeEnv,
      PRISMA_MIGRATION_MODE: mode ?? '',
      PRISMA_SYNC_CALLS: join(root, 'calls.txt'),
    },
  });
}

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('run-prisma-schema-sync', () => {
  it('usa migraciones versionadas por defecto en producción', () => {
    const root = fixture();
    const result = run(root, 'production');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Modo: migrate-deploy');
    expect(readFileSync(join(root, 'calls.txt'), 'utf8'))
      .toContain('exec prisma migrate deploy');
    expect(readFileSync(join(root, 'calls.txt'), 'utf8'))
      .toContain('verify-accounting-sql-guards.mjs');
  });

  it('rechaza db-push explícito en producción sin invocar Prisma', () => {
    const root = fixture();
    const result = run(root, 'production', 'db-push');

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('db-push está deshabilitado en producción');
    expect(existsSync(join(root, 'calls.txt'))).toBe(false);
  });

  it('conserva db-push como valor por defecto fuera de producción', () => {
    const root = fixture();
    const result = run(root, 'development');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Modo: db-push');
    expect(readFileSync(join(root, 'calls.txt'), 'utf8'))
      .toContain('exec prisma db push --accept-data-loss');
  });
});
