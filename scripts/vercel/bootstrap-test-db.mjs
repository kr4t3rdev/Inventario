import { spawnSync } from 'node:child_process';
import pg from 'pg';

/**
 * @description Orquestador de verificación del staging en el host de Vercel.
 *
 * 1. Deriva (sin exponer secretos) la URL de la base de pruebas a partir de
 *    DATABASE_URL: misma creds, base `<nombre>_verify_test`.
 * 2. Crea la base si no existe vía la URL admin (pathname /postgres).
 * 3. Aplica el schema Prisma a la base de pruebas.
 * 4. Ejecuta: openapi lint + paridad + smoke, suite unitaria completa e
 *    integración PostgreSQL contra la base de pruebas.
 * 5. Compila la app (el runtime de la instancia usa su propio entorno).
 *
 * El valor real de DATABASE_URL solo vive en memoria del proceso de build.
 * @returns {Promise<void>}
 */
async function main() {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL no definida en el entorno de build.');

  const sourceUrl = new URL(source);
  const originalDb = decodeURIComponent(sourceUrl.pathname.replace(/^\//, '')) || 'neondb';
  const testDb = `${originalDb.replace(/-/g, '_')}_verify_test`;

  const testUrl = new URL(source);
  testUrl.pathname = `/${testDb}`;
  if (!testUrl.searchParams.has('sslmode')) testUrl.searchParams.set('sslmode', 'require');

  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  if (!adminUrl.searchParams.has('sslmode')) adminUrl.searchParams.set('sslmode', 'require');

  const isNeon = adminUrl.hostname.includes('neon.tech');
  console.log(`[staging-db] host=${adminUrl.hostname.split('.')[0]}… esNeon=${isNeon} bdPruebas=${testDb}`);

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${testDb.replace(/"/g, '""')}"`);
      console.log(`[staging-db] base "${testDb}" creada.`);
    } else {
      console.log(`[staging-db] base "${testDb}" ya existía (se reutiliza).`);
    }
  } finally {
    await client.end();
  }

  const testEnv = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    DATABASE_URL_TEST: testUrl.toString(),
  };

  const steps = [
    { label: 'Prisma db push (base de pruebas)', cmd: ['pnpm', 'exec', 'prisma', 'db', 'push', '--skip-generate'] },
    { label: 'OpenAPI lint (Redocly)', cmd: ['pnpm', 'run', 'openapi:lint'] },
    { label: 'OpenAPI paridad + smoke', cmd: ['pnpm', 'run', 'openapi:parity'] },
    { label: 'SDK smoke móvil', cmd: ['pnpm', 'run', 'mobile:smoke'] },
    { label: 'Suite unitaria completa', cmd: ['pnpm', 'test:run'] },
    { label: 'Integración PostgreSQL (Neon pruebas)', cmd: ['pnpm', 'test:integration'] },
    { label: 'Build Next.js', cmd: ['pnpm', 'build'] },
  ];

  for (const step of steps) {
    console.log(`\n[staging-verify] ▶ ${step.label}`);
    const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
      stdio: 'inherit',
      env: testEnv,
      cwd: process.cwd(),
    });
    if (result.status !== 0) {
      console.error(`[staging-verify] ✗ FALLÓ: ${step.label} (código ${result.status})`);
      process.exitCode = result.status ?? 1;
      return;
    }
    console.log(`[staging-verify] ✓ ${step.label}`);
  }

  console.log('\n[staging-verify] TODAS las etapas pasaron.');
}

main().catch((error) => {
  console.error(`[staging-verify] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
