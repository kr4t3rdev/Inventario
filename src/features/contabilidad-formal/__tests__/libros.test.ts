/**
 * @description Contratos de los servicios de libros formales (CTA-2 T1):
 * libro diario (paginado por página), libro mayor (saldo corrido por
 * naturaleza), balance de comprobación (4 columnas, totales cuadrados) y
 * conciliación cruzada contra la base operativa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { obtenerLibroDiario } from '@/features/contabilidad-formal/services/libro-diario-service';
import { obtenerLibroMayor } from '@/features/contabilidad-formal/services/libro-mayor-service';
import { obtenerBalanceComprobacion } from '@/features/contabilidad-formal/services/balance-comprobacion-service';
import { obtenerConciliacionCruzada } from '@/features/contabilidad-formal/services/conciliacion-cruzada-service';

const TENANT = 'tenant-libros';
const PERIODO = 'periodo-2026-09';

const prismaMock = vi.hoisted(() => ({
	asiento: { findMany: vi.fn(), count: vi.fn() },
	asientoLinea: { findMany: vi.fn(), groupBy: vi.fn() },
	cuentaContable: { findMany: vi.fn(), findFirst: vi.fn() },
	cuentaRolTenant: { findMany: vi.fn() },
	cuentaBancaria: { findMany: vi.fn() },
	cuentaPorCobrar: { findMany: vi.fn() },
	cuentaPorPagar: { findMany: vi.fn() },
	tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const CUENTA_CAJA = {
	cuentaContableId: 'cta-caja',
	codigo: '1.1.01',
	nombre: 'Caja general',
	naturaleza: 'DEUDORA',
	tipo: 'ACTIVO',
	aceptaMovimiento: true,
	activa: true,
};
const CUENTA_VENTAS = {
	cuentaContableId: 'cta-ventas',
	codigo: '4.1',
	nombre: 'Ventas de productos',
	naturaleza: 'ACREEDORA',
	tipo: 'INGRESO',
	aceptaMovimiento: true,
	activa: true,
};

function asientoRow(over: Record<string, unknown> = {}) {
	return {
		asientoId: 'ast-1',
		numero: 3,
		fecha: new Date('2026-09-15T12:00:00Z'),
		descripcion: 'Venta mostrador 42',
		estado: 'CONTABILIZADO',
		origenTipo: 'venta',
		origenId: 'venta-42',
		diario: { codigo: 'VTA', nombre: 'Diario de ventas' },
		lineas: [
			{ orden: 1, cuentaId: 'cta-caja', cuenta: CUENTA_CAJA, debe: 1000, haber: 0, monedaOriginal: 'CUP', montoOriginal: 1000, referencia: null },
			{ orden: 2, cuentaId: 'cta-ventas', cuenta: CUENTA_VENTAS, debe: 0, haber: 1000, monedaOriginal: 'CUP', montoOriginal: 1000, referencia: null },
		],
		...over,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	prismaMock.asiento.findMany.mockResolvedValue([asientoRow()]);
	prismaMock.asiento.count.mockResolvedValue(1);
});

describe('obtenerLibroDiario', () => {
	it('devuelve asientos ordenados con líneas y totales', async () => {
		const resultado = await obtenerLibroDiario(TENANT, { periodoId: PERIODO, page: 1, limit: 50 });

		expect(prismaMock.asiento.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: TENANT, periodoId: PERIODO }),
			}),
		);
		expect(resultado.asientos).toHaveLength(1);
		const fila = resultado.asientos[0];
		expect(fila.etiqueta).toBe('VTA-3');
		expect(fila.totalDebe).toBe(1000);
		expect(fila.totalHaber).toBe(1000);
		expect(fila.lineas).toHaveLength(2);
		expect(fila.lineas[0].cuentaCodigo).toBe('1.1.01');
		expect(resultado.total).toBe(1);
	});

	it('pagina por desplazamiento y calcula total de páginas', async () => {
		prismaMock.asiento.count.mockResolvedValue(230);
		prismaMock.asiento.findMany.mockResolvedValue([]);
		const resultado = await obtenerLibroDiario(TENANT, { periodoId: PERIODO, page: 3, limit: 50 });
		expect(resultado.paginas).toBe(5);
		expect(resultado.asientos).toHaveLength(0);
	});
});

describe('obtenerLibroMayor', () => {
	beforeEach(() => {
		prismaMock.cuentaContable.findFirst.mockResolvedValue(CUENTA_CAJA);
		prismaMock.asientoLinea.groupBy.mockResolvedValue([
			{ cuentaId: 'cta-caja', _sum: { debe: 2000, haber: 1500 } },
		]);
		prismaMock.asientoLinea.findMany.mockResolvedValue([
			{
				orden: 1, debe: 500, haber: 0, referencia: null, monedaOriginal: 'CUP',
				asiento: { asientoId: 'ast-2', numero: 5, fecha: new Date('2026-09-10T10:00:00Z'), descripcion: 'Venta contado', origenTipo: 'venta', origenId: 'v-2', diario: { codigo: 'VTA' } },
			},
			{
				orden: 1, debe: 0, haber: 300, referencia: null, monedaOriginal: 'CUP',
				asiento: { asientoId: 'ast-3', numero: 6, fecha: new Date('2026-09-11T10:00:00Z'), descripcion: 'Retiro banco', origenTipo: 'ajuste_bancario', origenId: 'a-1', diario: { codigo: 'BAN' } },
			},
		]);
	});

	it('calcula saldo inicial y saldo corrido por naturaleza deudora', async () => {
		const resultado = await obtenerLibroMayor(TENANT, {
			cuentaId: 'cta-caja',
			fechaDesde: '2026-09-01T00:00:00Z',
			fechaHasta: '2026-09-30T23:59:59Z',
		});

		expect(resultado.cuenta.codigo).toBe('1.1.01');
		// Deudora: saldo inicial = debe - haber previo al período
		expect(resultado.saldoInicial).toBe(500);
		expect(resultado.movimientos).toHaveLength(2);
		expect(resultado.movimientos[0].saldoCorrido).toBe(1000);
		expect(resultado.movimientos[1].saldoCorrido).toBe(700);
		expect(resultado.saldoFinal).toBe(700);
		expect(resultado.moneda).toBe('CUP');
	});

	it('rechaza cuentas inexistentes del tenant', async () => {
		prismaMock.cuentaContable.findFirst.mockResolvedValue(null);
		await expect(
			obtenerLibroMayor(TENANT, { cuentaId: 'nope', fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' }),
		).rejects.toThrow(/no encontrada/i);
	});
});

describe('obtenerBalanceComprobacion', () => {
	it('agrega sumas y saldos por cuenta con cuadre total', async () => {
		prismaMock.asientoLinea.groupBy.mockResolvedValue([
			{ cuentaId: 'cta-caja', _sum: { debe: 3000, haber: 2000 } },
			{ cuentaId: 'cta-ventas', _sum: { debe: 0, haber: 1000 } },
		]);
		prismaMock.cuentaContable.findMany.mockResolvedValue([CUENTA_CAJA, CUENTA_VENTAS]);

		const resultado = await obtenerBalanceComprobacion(TENANT, { periodoId: PERIODO });

		expect(resultado.filas).toHaveLength(2);
		const caja = resultado.filas.find((f) => f.codigo === '1.1.01')!;
		expect(caja.sumaDebe).toBe(3000);
		expect(caja.sumaHaber).toBe(2000);
		expect(caja.saldoDeudor).toBe(1000);
		expect(caja.saldoAcreedor).toBe(0);
		const ventas = resultado.filas.find((f) => f.codigo === '4.1')!;
		expect(ventas.saldoAcreedor).toBe(1000);
		// Totales cuadrados siempre
		expect(resultado.totales.debe).toBe(resultado.totales.haber);
		expect(resultado.totales.saldoDeudor).toBe(resultado.totales.saldoAcreedor);
	});
});

describe('obtenerConciliacionCruzada', () => {
	beforeEach(() => {
		prismaMock.cuentaRolTenant.findMany.mockResolvedValue([
			{ rol: 'CAJA_PRINCIPAL', cuentaId: 'cta-caja' },
			{ rol: 'BANCOS', cuentaId: 'cta-bancos' },
			{ rol: 'CXC_CLIENTES', cuentaId: 'cta-cxc' },
			{ rol: 'CXP_PROVEEDORES', cuentaId: 'cta-cxp' },
		]);
		prismaMock.cuentaContable.findMany.mockImplementation(
			async (args: { where?: { cuentaContableId?: { in?: string[] } } }) => {
				const todos: Record<string, { naturaleza: string }> = {
					'cta-caja': { naturaleza: 'DEUDORA' },
					'cta-bancos': { naturaleza: 'DEUDORA' },
					'cta-cxc': { naturaleza: 'DEUDORA' },
					'cta-cxp': { naturaleza: 'ACREEDORA' },
				};
				const filtro = args?.where?.cuentaContableId?.in;
				return (filtro ?? Object.keys(todos)).map((id) => ({ cuentaContableId: id, ...todos[id] }));
			},
		);
		prismaMock.asientoLinea.groupBy.mockImplementation(
			async (args: { where?: { cuentaId?: { in?: string[] } } }) => {
				const todos = [
					{ cuentaId: 'cta-caja', _sum: { debe: 1000, haber: 600 } },
					{ cuentaId: 'cta-bancos', _sum: { debe: 500, haber: 0 } },
					{ cuentaId: 'cta-cxc', _sum: { debe: 800, haber: 200 } },
					{ cuentaId: 'cta-cxp', _sum: { debe: 100, haber: 490 } },
				];
				const filtro = args?.where?.cuentaId?.in;
				return filtro ? todos.filter((t) => filtro.includes(t.cuentaId)) : todos;
			},
		);
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: 900, moneda: 'CUP', isActive: true },
		]);
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
			{ montoDeuda: 800, montoPagado: 200 },
		]);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: 390 },
		]);
	});

	it('compara saldo por libros contra saldo operativo por rubro', async () => {
		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const rubros = Object.fromEntries(resultado.rubros.map((r) => [r.clave, r]));
		// Tesorería: libros 900 (400 caja + 500 bancos) vs operativo 900
		expect(rubros.TESORERIA.saldoLibros).toBe(900);
		expect(rubros.TESORERIA.saldoOperativo).toBe(900);
		expect(rubros.TESORERIA.diferencia).toBe(0);
		// CxC: libros 600 vs operativo 600
		expect(rubros.CXC.saldoLibros).toBe(600);
		expect(rubros.CXC.saldoOperativo).toBe(600);
		// CxP: libros 390 (acreedor) vs operativo 390
		expect(rubros.CXP.saldoLibros).toBe(390);
		expect(rubros.CXP.saldoOperativo).toBe(390);
	});

	it('marca DIFERENCIA cuando los lados no coinciden', async () => {
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: 777, moneda: 'CUP', isActive: true },
		]);
		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;
		expect(tesoreria.estado).toBe('DIFERENCIA');
		expect(tesoreria.diferencia).not.toBe(0);
	});
});
