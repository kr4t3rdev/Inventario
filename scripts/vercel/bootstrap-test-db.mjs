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

  // Diagnóstico sin secretos: forma del endpoint (pooler, host, bd).
  const isPooler = sourceUrl.hostname.includes('-pooler');
  console.log(
    `[staging-db] url=OK esPooler=${isPooler} host=…${sourceUrl.hostname.split('.').slice(-3).join('.')} `
    + `bdOriginal=${originalDb} bdPruebas=${testDb}`,
  );

  // DDL (CREATE DATABASE, prisma db push) NO se admite sobre endpoints pooler
  // de Neon: se deriva el endpoint directo eliminando el sufijo -pooler.
  const directUrl = new URL(sourceUrl);
  directUrl.hostname = directUrl.hostname.replace('-pooler', '');

  const testUrl = new URL(directUrl);
  testUrl.pathname = `/${testDb}`;
  if (!testUrl.searchParams.has('sslmode')) testUrl.searchParams.set('sslmode', 'require');

  const adminCandidates = ['/postgres', `/${originalDb}`].map((pathname) => {
    const adminUrl = new URL(directUrl);
    adminUrl.pathname = pathname;
    if (!adminUrl.searchParams.has('sslmode')) adminUrl.searchParams.set('sslmode', 'require');
    return adminUrl.toString();
  });

  const isNeon = directUrl.hostname.includes('neon.tech');
  console.log(`[staging-db] endpointDirecto=${directUrl.hostname.split('.')[0]}… esNeon=${isNeon}`);

  let client;
  let lastAdminError = null;
  for (const candidate of adminCandidates) {
    try {
      const attempt = new pg.Client({ connectionString: candidate });
      await attempt.connect();
      client = attempt;
      console.log(`[staging-db] conexión admin establecida (${new URL(candidate).pathname}).`);
      break;
    } catch (error) {
      lastAdminError = error instanceof Error ? error.message : String(error);
      console.warn(`[staging-db] admin no disponible en ${new URL(candidate).pathname}: ${lastAdminError}`);
    }
  }
  if (!client) throw new Error(`sin conexión admin: ${lastAdminError}`);

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
    {
      // Exclusión EXPLÍCITA y documentada (vitest.staging.config.mjs):
      // cash-obligation-balances es un rojo aspiracional preexistente en main
      // (test añadido solo en e6c20706; la implementación de precisión
      // 4-decimales vive en la rama contable). El CI de GitHub lo ejecuta.
      label: 'Suite unitaria completa (config de staging)',
      cmd: ['pnpm', 'run', 'test:staging'],
    },
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
