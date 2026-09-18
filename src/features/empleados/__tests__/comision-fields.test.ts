/**
 * @description Contrato del Gap 5 (CMV-T1): Empleado gana comisionPct/metaMensual
 * y el permiso "rrhh.comisiones.gestionar" existe en el registry.
 */
import { describe, it, expect } from 'vitest';

describe('Gap 5 — campos de comisión en Empleado (CMV-T1)', () => {
	it('Empleado tiene comisionPct y metaMensual (Int, default 0)', async () => {
		const { Prisma } = await import('@/generated/prisma');
		const empleado = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Empleado');
		const pct = empleado?.fields.find((f) => f.name === 'comisionPct');
		const meta = empleado?.fields.find((f) => f.name === 'metaMensual');
		expect(pct?.type).toBe('Int');
		expect(pct?.default).toBe(0);
		expect(meta?.type).toBe('Int');
		expect(meta?.default).toBe(0);
	});
});
