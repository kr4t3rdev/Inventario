/**
 * @description Contratos del cierre y apertura formales (CTA-3 T1): el cierre
 * aprobado genera el asiento de cierre (cuentas de resultado a cero, contraparte
 * en resultado del período); la apertura crea el asiento desde los saldos de
 * AperturaPeriodo más el traspaso del resultado a resultados acumulados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	isImmediatelyPrecedingPeriod,
	generarAsientoApertura,
	generarAsientoCierre,
} from '@/features/contabilidad-formal/services/cierre-formal-service';

const TENANT = 'tenant-cierre';

describe('isImmediatelyPrecedingPeriod', () => {
	it.each([
		['period ending at UTC midnight', '2025-12-31T00:00:00.000Z', true],
		['period ending at UTC end-of-day', '2025-12-31T23:59:59.999Z', true],
		['period with a civil-day gap', '2025-12-30T23:59:59.999Z', false],
		['period overlapping current start', '2026-01-01T00:00:00.000Z', false],
	])('%s', (_label, priorEnd, expected) => {
		expect(isImmediatelyPrecedingPeriod(
			new Date(priorEnd),
			new Date('2026-01-01T00:00:00.000Z'),
		)).toBe(expected);
	});

	it('rejects invalid dates', () => {
		expect(isImmediatelyPrecedingPeriod(new Date(Number.NaN), new Date())).toBe(false);
	});
});

const prismaMock = vi.hoisted(() => ({
	asiento: {
		findFirst: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		aggregate: vi.fn(),
		create: vi.fn(),
		count: vi.fn(),
	},
	asientoLinea: { findMany: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
	cuentaRolTenant: { findMany: vi.fn() },
	cuentaContable: { findMany: vi.fn() },
	diario: { findFirst: vi.fn() },
	aperturaPeriodo: { findFirst: vi.fn() },
	periodoContable: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
	$executeRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/periodo-contable-guard', () => ({
	PeriodoGuard: { assertWritable: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }) },
}));
vi.mock('@/lib/services/periodo-contable-service', () => ({
	PeriodoContableService: {
		resolverPeriodoActivo: vi.fn().mockResolvedValue({
			estado: 'ABIERTO',
			esWritable: true,
			periodo: { periodoId: 'per-cierre' },
		}),
	},
}));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
	withAccountingTenantLock: vi.fn(
		async (_tx: unknown, _t: string, op: () => Promise<unknown>) => op(),
	),
}));

const ROLES = {
	CAJA_PRINCIPAL: 'cta-caja',
	BANCOS: 'cta-bancos',
	CXC_CLIENTES: 'cta-cxc',
	CXP_PROVEEDORES: 'cta-cxp',
	INVENTARIOS: 'cta-inv',
	CAPITAL_SOCIAL: 'cta-cap',
	RESULTADOS_ACUMULADOS: 'cta-resacum',
	RESULTADO_PERIODO: 'cta-resperiodo',
	GASTOS_OPERATIVOS: 'cta-gastos',
	VENTAS_PRODUCTOS: 'cta-ventas',
	COSTO_VENTAS: 'cta-costo',
};

beforeEach(() => {
	vi.clearAllMocks();
	prismaMock.cuentaRolTenant.findMany.mockResolvedValue(
		Object.entries(ROLES).map(([rol, cuentaId]) => ({
			rol,
			cuenta: { cuentaContableId: cuentaId, aceptaMovimiento: true, activa: true },
		})),
	);
	prismaMock.diario.findFirst.mockResolvedValue({ diarioId: 'dia-ape' });
	prismaMock.asiento.aggregate.mockResolvedValue({ _max: { numero: null } });
	prismaMock.asiento.findFirst.mockResolvedValue(null);
	prismaMock.asiento.findUnique.mockResolvedValue(null);
	prismaMock.asiento.findMany.mockResolvedValue([]);
	prismaMock.asientoLinea.groupBy.mockResolvedValue([]);
	prismaMock.aperturaPeriodo.findFirst.mockResolvedValue(null);
	prismaMock.periodoContable.findUnique.mockResolvedValue(null);
	prismaMock.periodoContable.findFirst.mockResolvedValue(null);
	prismaMock.periodoContable.findMany.mockResolvedValue([]);
		prismaMock.asiento.create.mockResolvedValue({ asientoId: 'ast-cierre' });
	prismaMock.cuentaContable.findMany.mockResolvedValue([
		{ cuentaContableId: 'cta-ventas', tipo: 'INGRESO' },
		{ cuentaContableId: 'cta-gastos', tipo: 'GASTO' },
	]);
	process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
});

describe('generarAsientoCierre', () => {
	it('cero, utilidad y líneas en cuentas de resultado del período', async () => {
		prismaMock.asientoLinea.groupBy.mockResolvedValue([
			{ cuentaId: 'cta-ventas', _sum: { debe: 0, haber: 1000 } },
			{ cuentaId: 'cta-gastos', _sum: { debe: 300, haber: 0 } },
		]);
		prismaMock.cuentaRolTenant.findMany.mockResolvedValue(
			Object.entries(ROLES).map(([rol, cuentaId]) => ({
				rol,
				cuenta: { cuentaContableId: cuentaId, aceptaMovimiento: true, activa: true },
			})),
		);
		prismaMock.periodoContable.findUnique.mockResolvedValue({
			periodoId: 'per-1',
			tenantId: TENANT,
			tipo: 'MENSUAL',
			estado: 'APROBADO',
			fechaInicio: new Date('2026-09-01T00:00:00.000Z'),
			fechaFin: new Date('2026-09-30T23:59:59.999Z'),
		});

		const resultado = await generarAsientoCierre(prismaMock as never, {
			periodoId: 'per-1',
			tenantId: TENANT,
			actorId: 'u1',
		} as never);

		expect(resultado.estado).toBe('CONTABILIZADO');
		const lineas = prismaMock.asiento.create.mock.calls[0][0].data.lineas.create;
		const ventas = lineas.find((l: { cuentaId: string }) => l.cuentaId === 'cta-ventas');
		const gastos = lineas.find((l: { cuentaId: string }) => l.cuentaId === 'cta-gastos');
		const resultado_ = lineas.find((l: { cuentaId: string }) => l.cuentaId === 'cta-resperiodo');
		// Utilidad 700: carga ingresos, abona gastos y resultado del período
		expect(ventas.debe.toString()).toBe('1000');
		expect(gastos.haber.toString()).toBe('300');
		expect(resultado_.haber.toString()).toBe('700');
	});
});

describe('generarAsientoApertura', () => {
	it('construye líneas desde los saldos de AperturaPeriodo (solo ≠ 0)', async () => {
		prismaMock.aperturaPeriodo.findFirst.mockResolvedValue({
			periodoId: 'per-2',
			tenantId: TENANT,
			origenPeriodoId: 'per-1',
			saldoCajaInicial: 500,
			saldoBancoInicial: 200,
			saldoCuentasCobrarInicial: 150,
			saldoCuentasPagarInicial: 350,
			saldoInventarioInicial: 0,
			saldoCapitalInicial: 400,
			saldoResultadoAcumInicial: 100,
		});
		prismaMock.periodoContable.findUnique.mockResolvedValue({
			periodoId: 'per-2',
			tenantId: TENANT,
			tipo: 'MENSUAL',
			estado: 'ABIERTO',
			fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
			fechaFin: new Date('2026-10-31T23:59:59.999Z'),
		});
		prismaMock.periodoContable.findMany.mockResolvedValue([]);
		prismaMock.periodoContable.findFirst.mockResolvedValue({
			periodoId: 'per-1',
			tenantId: TENANT,
			tipo: 'MENSUAL',
			estado: 'APROBADO',
			fechaInicio: new Date('2026-09-01T00:00:00.000Z'),
			fechaFin: new Date('2026-09-30T23:59:59.999Z'),
		});

		const resultado = await generarAsientoApertura(prismaMock as never, {
			periodoId: 'per-2',
			tenantId: TENANT,
			actorId: 'u1',
			fecha: new Date('2026-10-01T00:00:00.000Z'),
		} as never);

		expect(resultado.estado).toBe('CONTABILIZADO');
		expect(prismaMock.aperturaPeriodo.findFirst).toHaveBeenCalledWith({
			where: { periodoId: 'per-2', tenantId: TENANT },
		});
		const lineas = prismaMock.asiento.create.mock.calls[0][0].data.lineas.create;
		const porCuenta = Object.fromEntries(
			lineas.map((l: { cuentaId: string; debe: number; haber: number }) => [l.cuentaId, l]),
		);
		expect(porCuenta['cta-caja'].debe.toString()).toBe('500');
		expect(porCuenta['cta-bancos'].debe.toString()).toBe('200');
		expect(porCuenta['cta-cxc'].debe.toString()).toBe('150');
		expect(porCuenta['cta-cxp'].haber.toString()).toBe('350');
		expect(porCuenta['cta-cap'].haber.toString()).toBe('400');
		expect(porCuenta['cta-resacum'].haber.toString()).toBe('100');
		expect(porCuenta['cta-inv']).toBeUndefined();
	});

	it('sin apertura previa no genera asiento (OMITIDO)', async () => {
		prismaMock.aperturaPeriodo.findFirst.mockResolvedValue(null);
		const resultado = await generarAsientoApertura(prismaMock as never, {
			periodoId: 'per-3',
			tenantId: TENANT,
			actorId: 'u1',
			fecha: new Date(),
		} as never);
		expect(resultado).toEqual({ estado: 'OMITIDO', motivo: 'SIN_APERTURA' });
	});
});
