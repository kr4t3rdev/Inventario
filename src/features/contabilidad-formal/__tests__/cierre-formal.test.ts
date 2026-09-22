/**
 * @description Contratos del cierre y apertura formales (CTA-3 T1): el cierre
 * aprobado genera el asiento de cierre (cuentas de resultado a cero, contraparte
 * en resultado del período); la apertura crea el asiento desde los saldos de
 * AperturaPeriodo más el traspaso del resultado a resultados acumulados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	generarAsientoApertura,
	generarAsientoCierre,
} from '@/features/contabilidad-formal/services/cierre-formal-service';

const TENANT = 'tenant-cierre';

const prismaMock = vi.hoisted(() => ({
	asiento: {
		findFirst: vi.fn(),
		aggregate: vi.fn(),
		create: vi.fn(),
		count: vi.fn(),
	},
	asientoLinea: { findMany: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
	cuentaRolTenant: { findMany: vi.fn() },
	cuentaContable: { findMany: vi.fn() },
	diario: { findFirst: vi.fn() },
	aperturaPeriodo: { findUnique: vi.fn() },
	periodoContable: { findFirst: vi.fn(), update: vi.fn() },
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

		const resultado = await generarAsientoCierre(prismaMock, {
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
		expect(ventas.debe).toBe(1000);
		expect(gastos.haber).toBe(300);
		expect(resultado_.haber).toBe(700);
	});
});

describe('generarAsientoApertura', () => {
	it('construye líneas desde los saldos de AperturaPeriodo (solo ≠ 0)', async () => {
		prismaMock.aperturaPeriodo.findUnique.mockResolvedValue({
			periodoId: 'per-2',
			saldoCajaInicial: 500,
			saldoBancoInicial: 200,
			saldoCuentasCobrarInicial: 150,
			saldoCuentasPagarInicial: 350,
			saldoInventarioInicial: 0,
			saldoCapitalInicial: 400,
			saldoResultadoAcumInicial: 100,
		});

		const resultado = await generarAsientoApertura(prismaMock, {
			periodoId: 'per-2',
			tenantId: TENANT,
			actorId: 'u1',
			fecha: new Date('2026-10-01'),
		} as never);

		expect(resultado.estado).toBe('CONTABILIZADO');
		const lineas = prismaMock.asiento.create.mock.calls[0][0].data.lineas.create;
		const porCuenta = Object.fromEntries(
			lineas.map((l: { cuentaId: string; debe: number; haber: number }) => [l.cuentaId, l]),
		);
		expect(porCuenta['cta-caja'].debe).toBe(500);
		expect(porCuenta['cta-bancos'].debe).toBe(200);
		expect(porCuenta['cta-cxc'].debe).toBe(150);
		expect(porCuenta['cta-cxp'].haber).toBe(350);
		expect(porCuenta['cta-cap'].haber).toBe(400);
		expect(porCuenta['cta-resacum'].haber).toBe(100);
		expect(porCuenta['cta-inv']).toBeUndefined();
	});

	it('sin apertura previa no genera asiento (OMITIDO)', async () => {
		prismaMock.aperturaPeriodo.findUnique.mockResolvedValue(null);
		const resultado = await generarAsientoApertura(prismaMock, {
			periodoId: 'per-3',
			tenantId: TENANT,
			actorId: 'u1',
			fecha: new Date(),
		} as never);
		expect(resultado.estado).toBe('OMITIDO');
	});
});
