import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(`${process.cwd()}/prisma/schema.prisma`, 'utf8');
const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations');
const reportMigrations = readdirSync(migrationsDirectory)
  .filter((name) => /^202609020540(?:0[1-9]|1[0-2])_add_accounting_report_read_index_/.test(name))
  .sort();

/**
 * @description Obtiene un bloque de modelo Prisma para validar índices locales al modelo.
 * @param {string} modelName - Nombre exacto del modelo Prisma.
 * @returns {string} Contenido completo del bloque del modelo.
 */
function getModelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Modelo Prisma no encontrado: ${modelName}`);
  return match[0];
}

describe('accounting movement report indexes', () => {
  it.each([
    ['ReconciliacionVenta', '@@index([tenantId, fechaReconciliacion])'],
    ['ReconciliacionVenta', '@@index([tenantId, cuentaId, fechaReconciliacion])'],
    ['ReconciliacionServicio', '@@index([tenantId, fechaReconciliacion])'],
    ['ReconciliacionServicio', '@@index([tenantId, cuentaId, fechaReconciliacion])'],
    ['ReconciliacionGasto', '@@index([tenantId, fechaReconciliacion])'],
    ['ReconciliacionGasto', '@@index([tenantId, cuentaId, fechaReconciliacion])'],
    ['TransferenciaBancaria', '@@index([tenantId, fechaTransferencia])'],
    ['TransferenciaBancaria', '@@index([tenantId, cuentaOrigenId, fechaTransferencia])'],
    ['TransferenciaBancaria', '@@index([tenantId, cuentaDestinoId, fechaTransferencia])'],
    ['AjusteBancario', '@@index([tenantId, cuentaId, fechaOperacion])'],
    ['InyeccionCapital', '@@index([cuentaId, createdAt])'],
    ['PagoDeuda', '@@index([cuentaId, fechaPago])'],
  ])('%s includes %s', (modelName, expectedIndex) => {
    expect(getModelBlock(modelName)).toContain(expectedIndex);
  });

  it('keeps each Prisma-compatible report index migration to one DDL statement', () => {
    expect(reportMigrations).toHaveLength(12);

    for (const migrationName of reportMigrations) {
      const migration = readFileSync(
        join(migrationsDirectory, migrationName, 'migration.sql'),
        'utf8',
      );
      const indexStatements = migration
        .replace(/--.*$/gm, '')
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement.includes('CREATE INDEX'));

      expect(indexStatements, migrationName).toHaveLength(1);
      expect(indexStatements[0], migrationName).toContain('CREATE INDEX IF NOT EXISTS ');
      expect(indexStatements[0], migrationName).not.toContain('CREATE INDEX CONCURRENTLY');
      expect(migration, migrationName).toContain('Lock risk:');
    }
  });
});
