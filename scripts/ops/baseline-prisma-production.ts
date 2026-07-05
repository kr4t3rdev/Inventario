import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @description Obtiene los nombres de migración presentes en el directorio de Prisma.
 * @param {string} migrationsDir - Ruta al directorio `prisma/migrations`.
 * @returns {string[]} Lista ordenada de carpetas de migración.
 */
export function getAllMigrationNames(migrationsDir: string): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * @description Retorna la lista de migraciones que deben marcarse como aplicadas
 * durante el baseline inicial.
 * @param {string[]} names - Nombres de migraciones detectadas.
 * @returns {string[]} Lista ordenada de migraciones a baselinear.
 */
export function getBaselineMigrationNames(names: string[]): string[] {
  return [...names].sort();
}

/**
 * @description Construye los comandos de `prisma migrate resolve --applied`
 * para marcar el historial existente como aplicado.
 * @param {string[]} names - Migraciones a baselinear.
 * @returns {string[]} Comandos listos para ejecutar.
 */
export function buildResolveCommands(names: string[]): string[] {
  return names.map((name) => `pnpm prisma migrate resolve --applied ${name}`);
}

async function main(): Promise<void> {
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
  const migrationNames = getBaselineMigrationNames(
    getAllMigrationNames(migrationsDir),
  );
  const resolveCommands = buildResolveCommands(migrationNames);
  const isDryRun = process.argv.includes('--dry-run');

  console.log('1. Verify DB backup exists');
  console.log('2. Create _prisma_migrations history via prisma migrate resolve');
  console.log('3. Mark every existing migration as applied');
  console.log('4. Run prisma migrate status');
  console.log('5. Run prisma migrate deploy only for future migrations');

  if (isDryRun) {
    console.log('\n# Dry run');
    resolveCommands.forEach((command) => console.log(command));
    return;
  }

  console.log('\n# Suggested commands');
  resolveCommands.forEach((command) => console.log(command));
}

const entryUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entryUrl && import.meta.url === entryUrl) {
  void main();
}
