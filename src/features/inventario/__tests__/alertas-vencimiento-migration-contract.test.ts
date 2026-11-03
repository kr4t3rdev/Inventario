/**
 * @description Contrato de la migración que permite configurar por tenant la
 * ventana de alerta de vencimiento de lotes (Mi Empresa).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = resolve(
  root,
  'prisma/migrations/20261110000000_add_dias_alerta_vencimiento_lotes/migration.sql',
);
const schemaPath = resolve(root, 'prisma/schema.prisma');

describe('migración de ventana de alerta de vencimiento', () => {
  it('agrega la columna configurable con valor por defecto de 30 días', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const schema = readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('diasAlertaVencimientoLotes Int');
    expect(migration).toMatch(
      /ALTER TABLE "MiEmpresa"\s+ADD COLUMN "diasAlertaVencimientoLotes" INTEGER NOT NULL DEFAULT 30/,
    );
  });

  it('limita la ventana configurada entre 1 y 30 días', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/CHECK \("diasAlertaVencimientoLotes" BETWEEN 1 AND 30\)/);
  });
});
