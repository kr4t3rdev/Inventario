/**
 * @description Setup para tests de integración (con DB real).
 *
 * Se ejecuta ANTES de cualquier test de integración. Requiere
 * DATABASE_URL_TEST apuntando a una base de datos de test (no producción),
 * vía variable de entorno o docker-compose local.
 *
 * @throws {Error} Si DATABASE_URL_TEST no está definida.
 */

const integrationUrl = process.env.DATABASE_URL_TEST;

if (!integrationUrl) {
  console.error(
    '⚠️ Tests de integración requieren DATABASE_URL_TEST.\n' +
    'Configura una base de datos de test, por ejemplo:\n' +
    '  docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test_db -p 5433:5432 postgres:16\n' +
    '  DATABASE_URL_TEST=postgresql://postgres:test@localhost:5433/test_db pnpm test:integration',
  );
  throw new Error('DATABASE_URL_TEST is required for integration tests');
}

// Sobrescribir para que prisma lea la URL de test, jamás la de producción.
process.env.DATABASE_URL = integrationUrl;

console.log(`[integration] Usando DATABASE_URL_TEST=${integrationUrl.split('@')[0]}@…`);
