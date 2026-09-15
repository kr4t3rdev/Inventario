import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contrato del ciclo de estados de Venta (PVE-T1).
 * Verifica el enum Prisma, el default del campo y la migración con backfill.
 */
describe('Venta.estado — ciclo de vida (PVE-T1)', () => {
	it('expone los cuatro estados del ciclo', async () => {
		const { EstadoVenta } = await import('@/generated/prisma');
		expect(Object.values(EstadoVenta).sort()).toEqual([
			'ANULADA',
			'ENTREGADA',
			'FACTURADA',
			'PEDIDO',
		]);
	});

	it('el default de Venta.estado es ENTREGADA según el datamodel', async () => {
		const { Prisma } = await import('@/generated/prisma');
		const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Venta');
		const field = model?.fields.find((f) => f.name === 'estado');
		expect(field?.default).toBe('ENTREGADA');
	});

	it('la migración aplica el backfill: ANULADA ← deletedAt, FACTURADA ← factura', () => {
		const migrationsDir = join(__dirname, '../../../../prisma/migrations');
		const dir = readdirSync(migrationsDir).find((d) =>
			d.includes('add_estado_ciclo_venta'),
		);
		expect(dir, 'debe existir la migración add_estado_ciclo_venta').toBeTruthy();
		const sql = readFileSync(join(migrationsDir, dir as string, 'migration.sql'), 'utf8');
		// Orden vinculante: primero anuladas (deletedAt), luego facturadas por vínculo a Factura.
		const idxAnulada = sql.indexOf("SET estado = 'ANULADA'");
		const idxFacturada = sql.indexOf("SET estado = 'FACTURADA'");
		expect(idxAnulada).toBeGreaterThan(-1);
		expect(idxFacturada).toBeGreaterThan(-1);
		expect(idxAnulada).toBeLessThan(idxFacturada);
		expect(sql).toContain('deletedAt');
	});
});
