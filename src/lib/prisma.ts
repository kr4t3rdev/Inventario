import { basePrisma } from './db/base-prisma'
import { buildScopedClient } from './db/scoped-prisma'

/**
 * @description Cliente Prisma con enforcement sistémico de tenant (AS-02).
 * Mismo nombre y tipo público que antes: la extensión solo intercepta
 * argumentos, no añade métodos, por lo que los call sites y los mocks de
 * `@/lib/prisma` siguen funcionando. El cliente sin escopar vive en
 * `./db/platform-prisma` (uso restringido a la allowlist).
 */
const prisma = buildScopedClient(basePrisma)

export { prisma }
export default prisma
