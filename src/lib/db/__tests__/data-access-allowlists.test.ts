/**
 * @description Contratos estáticos de los escape hatches de datos (AS-03).
 * Un import de prismaPlatform fuera de la lista cerrada o un uso raw SQL
 * nuevo/no inventariado rompe CI.
 * @module src/lib/db/__tests__/data-access-allowlists.test
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORM_PRISMA_ALLOWLIST } from '@/lib/db/platform-prisma-allowlist';
import { RAW_SQL_ALLOWLIST } from '@/lib/db/raw-sql-allowlist';

const CODE_EXTENSION = /\.(?:ts|tsx|js|mjs)$/;
const TEST_FILE = /(?:\.test\.|\.spec\.|__tests__|__integration__)/;
const PLATFORM_IMPORT = /(?:from\s*|import\s*\()\s*['"][^'"]*platform-prisma['"]/;
const BASE_IMPORT = /(?:from\s*|import\s*\()\s*['"][^'"]*db\/base-prisma['"]/;
const DIRECT_CLIENT = /new\s+PrismaClient\s*\(/;
const RAW_SQL_USAGE = /\.\$(?:queryRaw|executeRaw)(?:Unsafe)?/g;
const LINE_COMMENT = /\/\/.*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * @description Recorre archivos de código bajo un directorio.
 * @param {string} directory - Directorio absoluto a recorrer.
 * @returns {string[]} Rutas absolutas de archivos fuente.
 */
function walkCode(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated' || entry.name === 'node_modules') continue;
      files.push(...walkCode(path));
    } else if (CODE_EXTENSION.test(path)) {
      files.push(path);
    }
  }
  return files;
}

/**
 * @description Elimina comentarios para no contar menciones en docs.
 * @param {string} source - Código fuente.
 * @returns {string} Código sin comentarios de línea ni de bloque.
 */
function stripComments(source: string): string {
  return source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');
}

/**
 * @description Normaliza una ruta absoluta al formato repo/posix usado en allowlists.
 * @param {string} path - Ruta absoluta.
 * @returns {string} Ruta relativa normalizada.
 */
function repoPath(path: string): string {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

/**
 * @description Evalúa una ruta contra reglas exactas o prefijos terminados en /**.
 * @param {string} path - Ruta relativa al repositorio.
 * @param {readonly string[]} rules - Reglas permitidas.
 * @returns {boolean} true cuando la ruta está permitida.
 */
function isAllowed(path: string, rules: readonly string[]): boolean {
  return rules.some((rule) => {
    if (rule.endsWith('/**')) return path.startsWith(rule.slice(0, -3));
    return path === rule;
  });
}

describe('AS-03 allowlists de acceso a datos', () => {
  it('prismaPlatform solo se importa desde consumidores aprobados', () => {
    const files = [
      ...walkCode(join(process.cwd(), 'src')),
      ...walkCode(join(process.cwd(), 'scripts')),
      ...walkCode(join(process.cwd(), 'prisma')),
    ];
    const imports = files
      .filter((file) => PLATFORM_IMPORT.test(readFileSync(file, 'utf8')))
      .map(repoPath);
    const offenders = imports.filter((path) => !isAllowed(path, PLATFORM_PRISMA_ALLOWLIST));

    expect(
      offenders,
      `Imports de prismaPlatform fuera de allowlist:\n${offenders.join('\n')}`,
    ).toEqual([]);
  }, 30_000);

  it('sin clientes Prisma directos fuera de la fábrica (cierra el bypass base-prisma)', () => {
    // Alcance: runtime en src/. Los scripts/* y prisma/seed/* son tooling
    // offline con cliente propio, ya cubiertos por la allowlist de platform
    // y el inventario raw SQL.
    const files = walkCode(join(process.cwd(), 'src')).filter(
      (file) => !TEST_FILE.test(repoPath(file)),
    );
    const offenders = files
      .map((file) => ({ file, source: stripComments(readFileSync(file, 'utf8')) }))
      .filter(({ file, source }) => {
        const path = repoPath(file);
        const inFactory =
          path === 'src/lib/prisma.ts' || path.startsWith('src/lib/db/');
        if (!inFactory && BASE_IMPORT.test(source)) return true;
        if (!inFactory && DIRECT_CLIENT.test(source)) return true;
        return false;
      })
      .map(({ file }) => repoPath(file));

    expect(
      offenders,
      `Cliente Prisma directo o import de base-prisma fuera de la fábrica:\n${offenders.join('\n')}`,
    ).toEqual([]);
  }, 30_000);

  it('todo raw SQL de producción está inventariado con conteo estable', () => {
    const files = [
      ...walkCode(join(process.cwd(), 'src')),
      ...walkCode(join(process.cwd(), 'scripts')),
      ...walkCode(join(process.cwd(), 'prisma')),
    ].filter((file) => !TEST_FILE.test(repoPath(file)));

    const actual = new Map<string, number>();
    for (const file of files) {
      const path = repoPath(file);
      if (path === 'src/lib/db/raw-sql-allowlist.ts') continue;
      const count = stripComments(readFileSync(file, 'utf8')).match(RAW_SQL_USAGE)?.length ?? 0;
      if (count > 0) actual.set(path, count);
    }

    const expected = new Map(RAW_SQL_ALLOWLIST.map((entry) => [entry.file, entry.occurrences]));
    const missing = [...actual].filter(([path]) => !expected.has(path));
    const stale = [...expected].filter(([path]) => !actual.has(path));
    const drift = [...actual].filter(
      ([path, count]) => expected.has(path) && expected.get(path) !== count,
    );

    expect(missing, `Raw SQL nuevo sin allowlist:\n${JSON.stringify(missing, null, 2)}`).toEqual([]);
    expect(stale, `Entradas raw SQL obsoletas:\n${JSON.stringify(stale, null, 2)}`).toEqual([]);
    expect(drift, `Cambió el conteo raw SQL:\n${JSON.stringify(drift, null, 2)}`).toEqual([]);
    for (const entry of RAW_SQL_ALLOWLIST) {
      expect(entry.reason.trim(), `${entry.file}: falta motivo`).not.toBe('');
      expect(entry.tenantGuarantee.trim(), `${entry.file}: falta garantía tenant`).not.toBe('');
    }
  }, 30_000);
});
