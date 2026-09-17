/**
 * @description Contrato del modelo fiscal del Gap 4 (FE-T1): enum, documento,
 * evento y campos del emisor en Tenant. Mismo patrón que venta-estado-types.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Capa fiscal — modelos (FE-T1)', () => {
	it('el enum EstadoFiscalDocumento expone los cinco estados', async () => {
		const { EstadoFiscalDocumento } = await import('@/generated/prisma');
		expect(Object.values(EstadoFiscalDocumento).sort()).toEqual([
			'CANCELADA',
			'PENDIENTE',
			'PROCESANDO',
			'RECHAZADA',
			'TIMBRADA',
		]);
	});

	it('Venta sigue intacta y el FiscalDocument apunta a Factura', async () => {
		const { Prisma } = await import('@/generated/prisma');
		const models = Prisma.dmmf.datamodel.models;
		const doc = models.find((m) => m.name === 'FiscalDocument');
		expect(doc).toBeTruthy();
		expect(doc?.fields.find((f) => f.name === 'facturaId')?.isUnique).toBe(true);
		expect(doc?.fields.find((f) => f.name === 'factura')).toBeTruthy();
	});

	it('la migración crea las tablas fiscales y los campos de Tenant/Cliente', () => {
		const dir = join(__dirname, '../../../../prisma/migrations');
		const folder = readdirSync(dir).find((d) => d.includes('add_fiscal_documents'));
		expect(folder, 'debe existir la migración add_fiscal_documents').toBeTruthy();
		const sql = readFileSync(join(dir, folder as string, 'migration.sql'), 'utf8');
		expect(sql).toContain('CREATE TYPE "EstadoFiscalDocumento"');
		expect(sql).toContain('CREATE TABLE "fiscal_documents"');
		expect(sql).toContain('ALTER TABLE "tenants" ADD COLUMN');
		expect(sql).toContain('ALTER TABLE "Cliente" ADD COLUMN');
	});
});
