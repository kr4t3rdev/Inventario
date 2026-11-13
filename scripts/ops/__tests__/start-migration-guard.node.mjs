import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const startScript = path.join(projectRoot, 'start.sh');

/**
 * @description Ejecuta start.sh con sustitutos de pnpm/node para probar el guard.
 * @param {number} prismaStatus - Código de salida simulado de prisma migrate status.
 * @returns {Promise<{ status: number | null; appStarted: boolean; output: string }>}
 */
async function runStart(prismaStatus) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'start-migration-guard-'));
  const binDir = path.join(tempDir, 'bin');
  const appMarker = path.join(tempDir, 'app-started');
  await mkdir(binDir);
  await writeFile(
    path.join(binDir, 'pnpm'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\necho "pnpm $*"\nif [ "$PRISMA_STATUS_EXIT" -ne 0 ]; then echo "Error: migrations are not up to date" >&2; fi\nexit "$PRISMA_STATUS_EXIT"\n',
    { mode: 0o755 },
  );
  await writeFile(
    path.join(binDir, 'node'),
    '#!/bin/sh\ncase "$1" in\n  */check-prisma-migration-status.cjs) echo "migrate status"; echo guard >> "$COMMAND_LOG"; exit "$PRISMA_STATUS_EXIT" ;;\n  server.js) grep -qx guard "$COMMAND_LOG" || exit 91; touch "$APP_MARKER" ;;\n  *) exit 92 ;;\nesac\n',
    { mode: 0o755 },
  );

  try {
    const result = spawnSync('/bin/sh', [startScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        COMMAND_LOG: path.join(tempDir, 'commands'),
        APP_MARKER: appMarker,
        PRISMA_STATUS_EXIT: String(prismaStatus),
        PRISMA_SCHEMA_SYNC_ON_START: 'false',
      },
    });

    return {
      status: result.status,
      appStarted: await import('node:fs').then(({ existsSync }) => existsSync(appMarker)),
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('verifica las migraciones antes de iniciar el servidor', async () => {
  const result = await runStart(0);

  assert.equal(result.status, 0);
  assert.equal(result.appStarted, true);
  assert.match(result.output, /migrate status/);
});

test('bloquea el arranque si Prisma reporta migraciones pendientes', async () => {
  const result = await runStart(1);

  assert.notEqual(result.status, 0);
  assert.equal(result.appStarted, false);
  assert.match(result.output, /migrations are not up to date/i);
});
