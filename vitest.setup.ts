/**
 * @description Setup de tests de barrera (MM-B1).
 *
 * Garantiza que NINGÚN test unitario toque la base de datos real:
 * - Sustituye DATABASE_URL por una URL local inalcanzable (conexión
 *   instantáneamente rechazada, sin timeout).
 * - Imprime una advertencia clara para cualquier test que dependa de prisma
 *   real (el debug es trivial: buscar el "FAIL" con este mensaje).
 *
 * Para tests de integración reales contra una base de datos de test,
 * usas el runner separado: `pnpm test:integration` (ver
 * vitest.integration.config.mjs). Esos tests viven en `__integration__`
 * y dependen de `DATABASE_URL_TEST` (p. ej. `postgresql://localhost:5433/
 * test_db` levantado con docker-compose).
 *
 * @module vitest.setup
 */

// Solo aplica a tests unitarios (vitest.config.mjs); el config de integración
// (vitest.integration.config.mjs) no lo incluye.
const BARRIER_URL = 'postgresql://test:test@127.0.0.1:5114/test_db';

// Reasignar: cualquier test que use un prisma import SETUP-only o real
// se "conecta" a esta URL que falla inmediatamente.
process.env.DATABASE_URL = BARRIER_URL;

// Si el test intenta hacer algo que no esté en el mock y NO es unitario,
// el error deja claro qué pasó. En CI/development, DATABASE_URL sería una
// cadena vacía cuando no hay mocker; con esta URL inalcanzable, la falta
// es directamente obvia: falla rápido con "Connection refused".
if (process.env.CI_TIMEOUT_HOOK === 'true') {
  console.warn(
    '[test-barrier] DATABASE_URL sobreescrita para tests. '
    + 'Los tests de integración usan pnpm test:integration.',
  );
}
