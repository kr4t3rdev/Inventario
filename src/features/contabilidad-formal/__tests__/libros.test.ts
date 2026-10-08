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
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';

const TENANT = 'tenant-libros';
const PERIODO = 'periodo-2026-09';

const prismaMock = vi.hoisted(() => ({
	$transaction: vi.fn(),
	asiento: { findMany: vi.fn(), count: vi.fn() },
	asientoLinea: { findMany: vi.fn(), groupBy: vi.fn() },
	cuentaContable: { findMany: vi.fn(), findFirst: vi.fn() },
	cuentaRolTenant: { findMany: vi.fn() },
	cuentaBancaria: { findMany: vi.fn() },
	cuentaPorCobrar: { findMany: vi.fn() },
	cuentaPorPagar: { findMany: vi.fn() },
	pagoCuentaPorPagar: { findMany: vi.fn() },
	factura: { findMany: vi.fn() },
	reconciliacionVenta: { findMany: vi.fn() },
	reconciliacionServicio: { findMany: vi.fn() },
	ventaServicios: { findMany: vi.fn() },
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
	prismaMock.$transaction.mockImplementation(
		(callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
	);
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
		prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
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
			{ saldoPendiente: 390, montoDeuda: 390, montoPagado: 0, moneda: 'CUP' },
		]);
		prismaMock.pagoCuentaPorPagar.findMany.mockResolvedValue([]);
		prismaMock.factura.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);
	});

	it('compara saldo por libros contra saldo operativo por rubro', async () => {
		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const rubros = Object.fromEntries(resultado.rubros.map((r) => [r.clave, r]));
		// Tesorería: libros 900 (400 caja + 500 bancos) vs operativo 900
		expect(rubros.TESORERIA.saldoLibros).toBe('900');
		expect(rubros.TESORERIA.saldoOperativo).toBe('900');
		expect(rubros.TESORERIA.diferencia).toBe('0');
		// CxC: libros 600 vs operativo 600
		expect(rubros.CXC.saldoLibros).toBe('600');
		expect(rubros.CXC.saldoOperativo).toBeNull();
		expect(rubros.CXC.estado).toBe('NO_EVALUABLE');
		// CxP: libros 390 (acreedor) vs operativo 390
		expect(rubros.CXP.saldoLibros).toBe('390');
		expect(rubros.CXP.saldoOperativo).toBe('390');
		expect(rubros.CXP.estado).toBe('OK');
		expect(typeof resultado.generadoAt).toBe('string');
		expect(prismaMock.cuentaPorPagar.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				select: { cuentaPorPagarId: true, saldoPendiente: true, moneda: true, montoDeuda: true, montoPagado: true },
			}),
		);
		expect(prismaMock.$transaction).toHaveBeenCalledWith(
			expect.any(Function),
			{ isolationLevel: 'RepeatableRead' },
		);
	});

	it('marca DIFERENCIA cuando los lados no coinciden', async () => {
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: 777, moneda: 'CUP', isActive: true },
		]);
		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;
		expect(tesoreria.estado).toBe('DIFERENCIA');
		expect(tesoreria.diferencia).not.toBe('0');
	});

	it('marca NO_EVALUABLE y bloquea enforce-ready para un corte parcial', async () => {
		const resultado = await obtenerConciliacionCruzada(TENANT, {
			fechaHasta: new Date('2026-09-15T23:59:59Z'),
		});

		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
		expect(resultado.rubros.every((r) => r.estado === 'NO_EVALUABLE')).toBe(true);
		expect(resultado.rubros.every((r) =>
			r.saldoLibros === null && r.saldoOperativo === null && r.diferencia === null,
	)).toBe(true);
	});

	it('marca NO_EVALUABLE y bloquea enforce-ready si un rubro carece de fuente comparable', async () => {
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const cxp = resultado.rubros.find((r) => r.clave === 'CXP')!;
		expect(cxp.estado).toBe('NO_EVALUABLE');
		expect(cxp.nota).toMatch(/fuente comparable/i);
		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
	});

	it('no declara conforme cuando falta la cuenta contable comparable aunque ambos saldos den cero', async () => {
		prismaMock.cuentaRolTenant.findMany.mockResolvedValue([
			{ rol: 'CAJA_PRINCIPAL', cuentaId: 'cta-caja' },
			{ rol: 'BANCOS', cuentaId: 'cta-bancos' },
			{ rol: 'CXC_CLIENTES', cuentaId: 'cta-cxc' },
		]);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const cxp = resultado.rubros.find((r) => r.clave === 'CXP')!;
		expect(cxp.estado).toBe('NO_EVALUABLE');
		expect(cxp.diferencia).toBeNull();
		expect(resultado.enforceReady).toBe(false);
	});

	it('no declara TESORERIA evaluable si falta uno de sus roles requeridos', async () => {
		prismaMock.cuentaRolTenant.findMany.mockResolvedValue([
			{ rol: 'CAJA_PRINCIPAL', cuentaId: 'cta-caja' },
			{ rol: 'CXC_CLIENTES', cuentaId: 'cta-cxc' },
			{ rol: 'CXP_PROVEEDORES', cuentaId: 'cta-cxp' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;
		expect(tesoreria.estado).toBe('NO_EVALUABLE');
		expect(tesoreria.nota).toMatch(/fuente comparable/i);
		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
	});

	it('marca saldos sin valoración comparable como NO_EVALUABLE aunque los totales coincidan', async () => {
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
			{ montoDeuda: 800, montoPagado: 200 },
		]);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: 390, montoDeuda: 390, montoPagado: 0, moneda: 'USD' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const rubros = Object.fromEntries(resultado.rubros.map((r) => [r.clave, r]));
		expect(rubros.CXC.diferencia).toBeNull();
		expect(rubros.CXC.estado).toBe('NO_EVALUABLE');
		expect(rubros.CXP.diferencia).toBeNull();
		expect(rubros.CXP.estado).toBe('NO_EVALUABLE');
		expect(rubros.CXC.nota).toMatch(/valoración funcional completa/i);
		expect(rubros.CXP.nota).toMatch(/moneda no comparable|pagos sin moneda verificable/i);
		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
	});

	it('no evalúa CxP liquidada cuando existen pagos sin moneda verificable', async () => {
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ cuentaPorPagarId: 'cxp-open', saldoPendiente: 390, montoDeuda: 390, montoPagado: 0, moneda: 'CUP' },
			{ cuentaPorPagarId: 'cxp-paid', saldoPendiente: 0, montoDeuda: 10, montoPagado: 10, moneda: 'USD' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		const cxp = resultado.rubros.find((r) => r.clave === 'CXP')!;
		expect(cxp.saldoOperativo).toBeNull();
		expect(cxp.diferencia).toBeNull();
		expect(cxp.estado).toBe('NO_EVALUABLE');
	});

	it('reconcilia CxC con el valor libro restante, no con pagos recibidos a otra tasa', async () => {
		const fxEvidence = buildAppliedFxEvidenceExact({
			originalAmount: '100', originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: '25', convertedAmount: '2500',
			rateEffectiveAt: new Date('2026-09-01T12:00:00.000Z'),
			source: 'unit-fixture', fxProvenanceKind: 'MANUAL_GOVERNED',
		});
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
			{
				montoDeuda: '100', montoPagado: '40', monedaOriginal: 'USD', montoOriginal: '100',
				montoDeudaFuncional: '2500', montoPagadoFuncional: '1200', monedaFuncional: 'CUP',
				tasaCambio: '25',
				rateEffectiveAt: fxEvidence.rateEffectiveAt,
				fxProvenanceKind: fxEvidence.evidence.fxProvenanceKind,
				fxProvenanceSource: fxEvidence.evidence.fxProvenanceSource,
				fxCatalogRateId: fxEvidence.evidence.fxCatalogRateId,
				fxEvidenceFingerprint: fxEvidence.evidence.fxEvidenceFingerprint,
				fxEvidenceVersion: fxEvidence.evidence.fxEvidenceVersion,
				fxEvidenceJson: fxEvidence.evidence,
				// A canonical fingerprint must not conceal altered monetary payload fields.
			},
		]);
		prismaMock.asientoLinea.groupBy.mockImplementation(
			async (args: { where?: { cuentaId?: { in?: string[] } } }) => {
				const todos = [
					{ cuentaId: 'cta-caja', _sum: { debe: 1000, haber: 600 } },
					{ cuentaId: 'cta-bancos', _sum: { debe: 500, haber: 0 } },
					{ cuentaId: 'cta-cxc', _sum: { debe: '1700', haber: '200' } },
					{ cuentaId: 'cta-cxp', _sum: { debe: 100, haber: 490 } },
				];
				const filtro = args?.where?.cuentaId?.in;
				return filtro ? todos.filter((t) => filtro.includes(t.cuentaId)) : todos;
			},
		);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: 390, montoDeuda: 390, montoPagado: 0, moneda: 'CUP' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const cxc = resultado.rubros.find((r) => r.clave === 'CXC')!;

		// 2,500 original functional value less 1,000 carrying value discharged.
		// Actual receipts of 1,200 contain realized FX and must not be subtracted.
		expect(cxc).toMatchObject({
			saldoLibros: '1500', saldoOperativo: '1500', diferencia: '0', estado: 'OK',
		});
	});

	it('no evalúa una CxC cerrada enlazada con cobros fuera de la valoración agregada', async () => {
		const fxEvidence = buildAppliedFxEvidenceExact({
			originalAmount: '100', originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: '25', convertedAmount: '2500',
			rateEffectiveAt: new Date('2026-09-01T12:00:00.000Z'),
			source: 'unit-fixture', fxProvenanceKind: 'MANUAL_GOVERNED',
		});
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
			montoDeuda: '100', montoPagado: '100', monedaOriginal: 'USD', montoOriginal: '100',
			montoDeudaFuncional: '2500', montoPagadoFuncional: '2400', monedaFuncional: 'CUP',
			tasaCambio: '25', rateEffectiveAt: fxEvidence.rateEffectiveAt,
			fxProvenanceKind: fxEvidence.evidence.fxProvenanceKind,
			fxProvenanceSource: fxEvidence.evidence.fxProvenanceSource,
			fxCatalogRateId: fxEvidence.evidence.fxCatalogRateId,
			fxEvidenceFingerprint: fxEvidence.evidence.fxEvidenceFingerprint,
			fxEvidenceVersion: fxEvidence.evidence.fxEvidenceVersion,
			fxEvidenceJson: fxEvidence.evidence,
			facturaId: 'invoice-1', ventaServicioId: null,
		}]);
		prismaMock.factura.findMany.mockResolvedValue([{ idFactura: 'invoice-1', ventaId: 'sale-1' }]);
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([{ ventaId: 'sale-1' }]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const cxc = resultado.rubros.find((r) => r.clave === 'CXC')!;

		expect(cxc.estado).toBe('NO_EVALUABLE');
		expect(cxc.saldoOperativo).toBeNull();
		expect(cxc.nota).toMatch(/valoración funcional/i);
	});

	it('no evalúa una CxC extranjera liquidada sin evidencia FX canónica', async () => {
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
			montoDeuda: '100', montoPagado: '100', monedaOriginal: 'USD', montoOriginal: '100',
			montoDeudaFuncional: '2500', montoPagadoFuncional: '2500', monedaFuncional: 'CUP',
			tasaCambio: '25', fxEvidenceFingerprint: 'fingerprint-only', fxEvidenceVersion: 2,
			fxEvidenceJson: null, rateEffectiveAt: null, fxProvenanceKind: null, fxProvenanceSource: null,
		}]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const cxc = resultado.rubros.find((r) => r.clave === 'CXC')!;

		expect(cxc.estado).toBe('NO_EVALUABLE');
		expect(cxc.saldoOperativo).toBeNull();
	});

	it('no evalúa FX si el JSON canónico tiene funcional currency alterada', async () => {
		const fxEvidence = buildAppliedFxEvidenceExact({
			originalAmount: '100', originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: '25', convertedAmount: '2500',
			rateEffectiveAt: new Date('2026-09-01T12:00:00.000Z'),
			source: 'unit-fixture', fxProvenanceKind: 'MANUAL_GOVERNED',
		});
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
			montoDeuda: '100', montoPagado: '0', monedaOriginal: 'USD', montoOriginal: '100',
			montoDeudaFuncional: '2500', montoPagadoFuncional: '0', monedaFuncional: 'CUP',
			tasaCambio: '25', rateEffectiveAt: fxEvidence.rateEffectiveAt,
			fxProvenanceKind: fxEvidence.evidence.fxProvenanceKind,
			fxProvenanceSource: fxEvidence.evidence.fxProvenanceSource,
			fxCatalogRateId: fxEvidence.evidence.fxCatalogRateId,
			fxEvidenceFingerprint: fxEvidence.evidence.fxEvidenceFingerprint,
			fxEvidenceVersion: fxEvidence.evidence.fxEvidenceVersion,
			fxEvidenceJson: { ...fxEvidence.evidence, functionalCurrency: 'XXX' },
		}]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		expect(resultado.rubros.find((r) => r.clave === 'CXC')?.estado).toBe('NO_EVALUABLE');
	});

	it('no evalúa FX si el JSON canónico referencia otro catalog rate', async () => {
		const fxEvidence = buildAppliedFxEvidenceExact({
			originalAmount: '100', originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: '25', convertedAmount: '2500',
			rateEffectiveAt: new Date('2026-09-01T12:00:00.000Z'),
			source: 'unit-fixture', fxProvenanceKind: 'CATALOG_RATE', fxCatalogRateId: 'rate-1',
		});
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
			montoDeuda: '100', montoPagado: '0', monedaOriginal: 'USD', montoOriginal: '100',
			montoDeudaFuncional: '2500', montoPagadoFuncional: '0', monedaFuncional: 'CUP',
			tasaCambio: '25', rateEffectiveAt: fxEvidence.rateEffectiveAt,
			fxProvenanceKind: fxEvidence.evidence.fxProvenanceKind,
			fxProvenanceSource: fxEvidence.evidence.fxProvenanceSource,
			fxCatalogRateId: fxEvidence.evidence.fxCatalogRateId,
			fxEvidenceFingerprint: fxEvidence.evidence.fxEvidenceFingerprint,
			fxEvidenceVersion: fxEvidence.evidence.fxEvidenceVersion,
			fxEvidenceJson: { ...fxEvidence.evidence, fxCatalogRateId: 'rate-2' },
		}]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		expect(resultado.rubros.find((r) => r.clave === 'CXC')?.estado).toBe('NO_EVALUABLE');
	});

	it('no evalúa CxC enlazada a una factura que no resuelve en el tenant', async () => {
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
			montoDeuda: '100', montoPagado: '0', monedaOriginal: 'CUP', montoOriginal: '100',
			montoDeudaFuncional: '100', montoPagadoFuncional: '0', monedaFuncional: 'CUP',
			tasaCambio: '1', facturaId: 'invoice-other-tenant', ventaServicioId: null,
		}]);
		prismaMock.factura.findMany.mockResolvedValue([]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		expect(resultado.rubros.find((r) => r.clave === 'CXC')?.estado).toBe('NO_EVALUABLE');
	});

	it('bloquea CxP si el aggregate pagado está en cero pero hay filas de pago', async () => {
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([{
			cuentaPorPagarId: 'cxp-with-orphan-payment',
			saldoPendiente: '390', montoDeuda: '390', montoPagado: '0', moneda: 'CUP',
		}]);
		prismaMock.pagoCuentaPorPagar.findMany.mockResolvedValue([
			{ cuentaPorPagarId: 'cxp-with-orphan-payment' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const cxp = resultado.rubros.find((r) => r.clave === 'CXP')!;

		expect(cxp.estado).toBe('NO_EVALUABLE');
		expect(cxp.saldoOperativo).toBeNull();
	});

	it('rechaza el mapeo de rol a cuenta inactiva o ajena al tenant', async () => {
		prismaMock.cuentaContable.findMany.mockResolvedValue([]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		expect(resultado.rubros.every((r) => r.estado === 'NO_EVALUABLE')).toBe(true);
		expect(prismaMock.cuentaContable.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ tenantId: TENANT, activa: true, aceptaMovimiento: true }),
		}));
	});

	it('mantiene CxP no evaluable si una cuenta CUP tiene pagos sin moneda verificable', async () => {
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: '390', montoDeuda: '500', montoPagado: '110', moneda: 'CUP' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const cxp = resultado.rubros.find((r) => r.clave === 'CXP')!;

		expect(cxp.estado).toBe('NO_EVALUABLE');
		expect(cxp.saldoOperativo).toBeNull();
		expect(cxp.nota).toMatch(/pagos.*moneda|moneda.*pagos/i);
	});

	it('no asume CUP si falta la política de moneda funcional', async () => {
		prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});

		expect(resultado.monedaFuncional).toBe('XXX');
		expect(resultado.estado).toBe('NO_EVALUABLE');
		expect(resultado.enforceReady).toBe(false);
		expect(resultado.rubros.every((r) => r.estado === 'NO_EVALUABLE')).toBe(true);
	});

	it('marca tesorería NO_EVALUABLE si una cuenta activa extranjera tiene saldo pendiente', async () => {
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: 900, moneda: 'CUP', isActive: true },
			{ saldo: 10, moneda: 'USD', isActive: true },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;

		expect(tesoreria.saldoOperativo).toBe('900');
		expect(tesoreria.estado).toBe('NO_EVALUABLE');
		expect(tesoreria.nota).toMatch(/moneda distinta de la funcional/i);
		expect(prismaMock.cuentaBancaria.findMany).toHaveBeenCalledWith({
			where: { tenantId: TENANT, isActive: true },
			select: { saldo: true, moneda: true },
		});
	});

	it('compara decimales exactos sin introducir una diferencia binaria', async () => {
		prismaMock.asientoLinea.groupBy.mockImplementation(
			async (args: { where?: { cuentaId?: { in?: string[] } } }) => {
				const todos = [
					{ cuentaId: 'cta-caja', _sum: { debe: '0.10', haber: '0' } },
					{ cuentaId: 'cta-bancos', _sum: { debe: '0.20', haber: '0' } },
					{ cuentaId: 'cta-cxc', _sum: { debe: '0.30', haber: '0' } },
					{ cuentaId: 'cta-cxp', _sum: { debe: '0', haber: '0.30' } },
				];
				const filtro = args?.where?.cuentaId?.in;
				return filtro ? todos.filter((t) => filtro.includes(t.cuentaId)) : todos;
			},
		);
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: '0.30', moneda: 'CUP', isActive: true },
		]);
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
			{ montoDeuda: '0.30', montoPagado: '0' },
		]);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: '0.30', montoDeuda: '0.30', montoPagado: '0', moneda: 'CUP' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;

		expect(tesoreria.saldoLibros).toBe('0.3');
		expect(tesoreria.saldoOperativo).toBe('0.3');
		expect(tesoreria.diferencia).toBe('0');
		expect(tesoreria.estado).toBe('OK');
	});

	it('preserva importes grandes con cuatro decimales sin convertirlos a Number', async () => {
		const importe = '123456789012345.6789';
		prismaMock.asientoLinea.groupBy.mockImplementation(
			async (args: { where?: { cuentaId?: { in?: string[] } } }) => {
				const todos = [
					{ cuentaId: 'cta-caja', _sum: { debe: importe, haber: '0' } },
					{ cuentaId: 'cta-bancos', _sum: { debe: '0', haber: '0' } },
					{ cuentaId: 'cta-cxc', _sum: { debe: '0', haber: '0' } },
					{ cuentaId: 'cta-cxp', _sum: { debe: '0', haber: '0' } },
				];
				const filtro = args?.where?.cuentaId?.in;
				return filtro ? todos.filter((t) => filtro.includes(t.cuentaId)) : todos;
			},
		);
		prismaMock.cuentaBancaria.findMany.mockResolvedValue([
			{ saldo: importe, moneda: 'CUP', isActive: true },
		]);
		prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
			{ montoDeuda: '0', montoPagado: '0' },
		]);
		prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
			{ saldoPendiente: '0', montoDeuda: '0', montoPagado: '0', moneda: 'CUP' },
		]);

		const resultado = await obtenerConciliacionCruzada(TENANT, {});
		const tesoreria = resultado.rubros.find((r) => r.clave === 'TESORERIA')!;

		expect(tesoreria.saldoLibros).toBe(importe);
		expect(tesoreria.saldoOperativo).toBe(importe);
		expect(tesoreria.diferencia).toBe('0');
		expect(tesoreria.estado).toBe('OK');
	});
});
