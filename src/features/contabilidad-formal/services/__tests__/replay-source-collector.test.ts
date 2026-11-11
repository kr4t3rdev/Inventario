/**
 * @description Test focal del recolector de candidatos del replay.
 *
 * El recolector decide que evento formal corresponde a cada operacion
 * historica. Las reglas son conservadoras: una fuente ambigua o no valorable
 * se omite con su causa en lugar de contabilizar un asiento que el writer no
 * habria emitido.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolverValuacionOperativa = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		monedaFuncional: 'CUP',
		montoFuncional: 100,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
	}),
);
const getCostoFifoVentaValorado = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/lib/functional-valuation-resolver', () => ({
	resolverValuacionOperativa,
}));
vi.mock('@/lib/services/fifo-allocation', () => ({ getCostoFifoVentaValorado }));

import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { cashPaymentAllocationFingerprint } from '../../lib/cash-payment-allocation-fingerprint';
import { REPLAY_COLLECTOR_QUERY_IDS } from '../replay-source-manifest';
import { recolectarCandidatos } from '../replay-source-collector';

describe('recolectarCandidatos', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCostoFifoVentaValorado.mockResolvedValue(null);
		resolverValuacionOperativa.mockResolvedValue({
			monedaFuncional: 'CUP',
			montoFuncional: 100,
			tasaCambio: null,
			fxEvidenceFingerprint: null,
		});
	});

	function crearClient(overrides: Record<string, unknown> = {}) {
		return {
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([]) },
			reconciliacionServicio: { findMany: vi.fn().mockResolvedValue([]) },
			factura: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaBancaria: {
				findMany: vi.fn().mockResolvedValue([
					{ cuentaId: 'cuenta-1', tipoCuenta: 'EFECTIVO' },
				]),
			},
			transferenciaBancaria: { findMany: vi.fn().mockResolvedValue([]) },
			reconciliacionGasto: { findMany: vi.fn().mockResolvedValue([]) },
			compraDocumento: { findMany: vi.fn().mockResolvedValue([]) },
			compraServicio: { findMany: vi.fn().mockResolvedValue([]) },
			ventaServicios: { findMany: vi.fn().mockResolvedValue([]) },
			venta: { findMany: vi.fn().mockResolvedValue([]) },
			anticipoMovimiento: { findMany: vi.fn().mockResolvedValue([]) },
			devolucionVenta: { findMany: vi.fn().mockResolvedValue([]) },
			ajusteBancario: { findMany: vi.fn().mockResolvedValue([]) },
			inyeccionCapital: { findMany: vi.fn().mockResolvedValue([]) },
			deudaCash: { findMany: vi.fn().mockResolvedValue([]) },
			prestamoCash: { findMany: vi.fn().mockResolvedValue([]) },
			ajusteInventario: { findMany: vi.fn().mockResolvedValue([]) },
			ordenProduccion: { findMany: vi.fn().mockResolvedValue([]) },
			asiento: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaRolTenant: { findMany: vi.fn().mockResolvedValue([]) },
			fxEvidence: { findMany: vi.fn().mockResolvedValue([]) },
			tasaCambio: { findFirst: vi.fn().mockResolvedValue(null) },
			tenantAccountingPolicy: {
				findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
			},
			...overrides,
		};
	}

	it('reconstruye costo FIFO histórico solo con asignaciones persistidas y venta sin cambios', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ venta: { findMany: vi.fn().mockResolvedValue([{
			ventaId: 'venta-fifo', estado: 'ENTREGADA', deletedAt: null,
			createdAt: fecha, updatedAt: fecha,
			items: [{ cantidad: 2, productoId: 'producto-1', allocations: [{ cantidad: 2, compraDocumentoItemId: 'linea-compra',
				recepcionItemId: null, purchaseReceiptInvoiceAllocationId: null,
				costoUnitarioSnapshot: 50, fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha,
				fifoMonedaFuncional: 'CUP', fifoCostoFuncional: new Prisma.Decimal(100),
				fifoEvidenciaFx: '{"evidence":"persisted"}', compraDocumentoItem: {
					compraDocumentoItemId: 'linea-compra', tenantId: 'tenant-1', productoId: 'producto-1',
					compraDocumento: { tenantId: 'tenant-1', estado: 'PAGADA', deletedAt: null },
				} }] }],
		}]) } });
		getCostoFifoVentaValorado.mockResolvedValue({ montoFuncional: 100, monedaFuncional: 'CUP',
			cantidad: 2, fuentesSinTasa: [] });

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toContainEqual(expect.objectContaining({
			origenTipo: 'venta_costo', origenId: 'venta-fifo', fecha,
			evento: expect.objectContaining({ tipo: 'COSTO_VENTA_DEVENGADO', monto: 100,
				moneda: 'CUP', montoFuncional: 100, monedaFuncional: 'CUP' }),
		}));
	});

	it('expone solo las consultas fuente que el collector ejecutó en esta pasada', async () => {
		const executedQueryIds = new Set<string>();

		await recolectarCandidatos('tenant-1', crearClient() as never, (queryId) => {
			executedQueryIds.add(queryId);
		});

		expect([...executedQueryIds].sort()).toEqual([...REPLAY_COLLECTOR_QUERY_IDS].sort());
	});

	it('reconstruye produccion con la fecha efectiva persistida y el costo registrado', async () => {
		const fechaContabilizacion = new Date('2026-11-09T14:25:36.789Z');
		const client = crearClient({
			ordenProduccion: { findMany: vi.fn().mockResolvedValue([{
				ordenProduccionId: 'orden-produccion-1',
				tenantId: 'tenant-1',
				estado: 'COMPLETADA',
				fechaContabilizacion,
				costoMateriales: 250,
			}]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toContainEqual(expect.objectContaining({
			origenTipo: 'orden_produccion',
			origenId: 'orden-produccion-1',
			fecha: fechaContabilizacion,
			evento: expect.objectContaining({
				tipo: 'PRODUCCION_SALIDA',
				fecha: fechaContabilizacion,
				monto: 250,
				moneda: 'CUP',
			}),
		}));
		expect(resolverValuacionOperativa).toHaveBeenCalledWith(expect.objectContaining({
			monto: 250,
			moneda: 'CUP',
			fechaOperacion: fechaContabilizacion,
			source: 'inventory-adjustment-posting-service',
	}));
	});

	it('no reconstruye producción histórica sin fecha efectiva persistida', async () => {
		const client = crearClient({
			ordenProduccion: { findMany: vi.fn().mockResolvedValue([{
				ordenProduccionId: 'orden-produccion-legacy',
				tenantId: 'tenant-1',
				estado: 'COMPLETADA',
				fechaContabilizacion: null,
				costoMateriales: 250,
			}]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).not.toEqual(expect.arrayContaining([
			expect.objectContaining({ origenTipo: 'orden_produccion' }),
		]));
		expect(resolverValuacionOperativa).not.toHaveBeenCalled();
	});

	it('omite producción si la valoración funcional no puede verificarse', async () => {
		resolverValuacionOperativa.mockResolvedValue({
			monedaFuncional: 'USD',
			montoFuncional: null,
			tasaCambio: null,
			fxEvidenceFingerprint: null,
		});
		const client = crearClient({
			ordenProduccion: { findMany: vi.fn().mockResolvedValue([{
				ordenProduccionId: 'orden-produccion-sin-fx',
				tenantId: 'tenant-1',
				estado: 'COMPLETADA',
				fechaContabilizacion: new Date('2026-11-09T14:25:36.789Z'),
				costoMateriales: 250,
			}]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toContainEqual(expect.objectContaining({
			origenTipo: 'orden_produccion',
			causaOmision: 'VALORACION_FUNCIONAL_NO_VERIFICABLE',
			evento: expect.objectContaining({ montoFuncional: null, monedaFuncional: 'USD' }),
		}));
	});

	it('reconstruye costo FIFO desde una asignación verificable de recepción y factura', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const layer = {
			id: 'capa-factura-recepcion', tenantId: 'tenant-1',
			compraDocumentoItemId: 'linea-factura', recepcionItemId: 'recepcion-1', cantidad: 2,
			costoUnitarioSnapshot: 50, fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: new Prisma.Decimal(100),
			fifoEvidenciaFx: '{"evidence":"persisted"}',
			compraDocumentoItem: { compraDocumentoItemId: 'linea-factura', tenantId: 'tenant-1',
				productoId: 'producto-1', compraDocumento: { tenantId: 'tenant-1', estado: 'PAGADA',
					deletedAt: null } },
		};
		const client = crearClient({ venta: { findMany: vi.fn().mockResolvedValue([{
			ventaId: 'venta-recepcion-fifo', estado: 'ENTREGADA', deletedAt: null,
			createdAt: fecha, updatedAt: fecha,
			items: [{ cantidad: 2, productoId: 'producto-1', allocations: [{
				cantidad: 2, compraDocumentoItemId: null, recepcionItemId: 'recepcion-1',
				purchaseReceiptInvoiceAllocationId: layer.id, costoUnitarioSnapshot: 50,
				fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP',
				fifoCostoFuncional: new Prisma.Decimal(100), fifoEvidenciaFx: '{"evidence":"persisted"}',
				purchaseReceiptInvoiceAllocation: layer,
			}] }],
		}]) } });
		getCostoFifoVentaValorado.mockResolvedValue({ montoFuncional: 100, monedaFuncional: 'CUP',
			cantidad: 2, fuentesSinTasa: [] });

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		const costosVenta = candidatos.filter((item) => item.origenTipo === 'venta_costo');
		expect(costosVenta).toHaveLength(1);
		expect(costosVenta[0]).toMatchObject({
			origenId: 'venta-recepcion-fifo',
			evento: expect.objectContaining({ tipo: 'COSTO_VENTA_DEVENGADO', monto: 100,
				montoFuncional: 100, monedaFuncional: 'CUP' }),
		});
		expect(costosVenta[0]).not.toHaveProperty('causaOmision');
		expect(getCostoFifoVentaValorado).toHaveBeenCalledWith(client, 'tenant-1', 'venta-recepcion-fifo');
	});

	it('omite costo FIFO histórico cuando hay devoluciones que alteraron las asignaciones', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({
			venta: { findMany: vi.fn().mockResolvedValue([{
				ventaId: 'venta-devuelta', estado: 'ENTREGADA', deletedAt: null,
				createdAt: fecha, updatedAt: fecha, items: [{ cantidad: 2, allocations: [] }],
			}]) },
			devolucionVenta: { findMany: vi.fn().mockResolvedValue([devolucion({ ventaId: 'venta-devuelta' })]) },
		});

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'venta_costo');

		expect(candidato?.causaOmision).toBe('DEVOLUCION_FIFO_NO_RECONSTRUIBLE');
		expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
	});

	it('omite costo FIFO cuando la fecha de entrega no quedó persistida con la venta', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ venta: { findMany: vi.fn().mockResolvedValue([{
			ventaId: 'venta-entregada-despues', estado: 'ENTREGADA', deletedAt: null,
			createdAt: fecha, updatedAt: new Date('2026-10-13T12:00:00.000Z'), items: [],
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'venta_costo');

		expect(candidato?.causaOmision).toBe('FECHA_COSTO_FIFO_NO_PERSISTIDA');
		expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
	});

	it('omite costo FIFO si falta evidencia FX persistida en alguna asignación', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ venta: { findMany: vi.fn().mockResolvedValue([{
			ventaId: 'venta-fx-incompleto', estado: 'ENTREGADA', deletedAt: null,
			createdAt: fecha, updatedAt: fecha,
			items: [{ cantidad: 1, allocations: [{ cantidad: 1, compraDocumentoItemId: 'linea-compra',
				recepcionItemId: null, purchaseReceiptInvoiceAllocationId: null,
				costoUnitarioSnapshot: 50, fifoMonedaOrigen: 'USD', fifoFechaFuente: fecha,
				fifoMonedaFuncional: 'CUP', fifoCostoFuncional: new Prisma.Decimal(1250),
				fifoEvidenciaFx: null }] }],
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'venta_costo');

		expect(candidato?.causaOmision).toBe('ASIGNACION_FIFO_NO_VERIFICABLE');
		expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
	});

	it('omite costo FIFO si la factura directa de una asignación quedó anulada', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ venta: { findMany: vi.fn().mockResolvedValue([{
			ventaId: 'venta-factura-anulada', estado: 'ENTREGADA', deletedAt: null,
			createdAt: fecha, updatedAt: fecha,
			items: [{ cantidad: 1, productoId: 'producto-1', allocations: [{
				cantidad: 1, compraDocumentoItemId: 'linea-anulada', recepcionItemId: null,
				purchaseReceiptInvoiceAllocationId: null, costoUnitarioSnapshot: 50,
				fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP',
				fifoCostoFuncional: new Prisma.Decimal(50), fifoEvidenciaFx: '{"evidence":"persisted"}',
				compraDocumentoItem: { compraDocumentoItemId: 'linea-anulada', tenantId: 'tenant-1',
					productoId: 'producto-1',
					compraDocumento: { tenantId: 'tenant-1', estado: 'ANULADA', deletedAt: null } },
			}] }],
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'venta_costo');

		expect(candidato?.causaOmision).toBe('ASIGNACION_FIFO_NO_VERIFICABLE');
		expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
	});

	it('no crea evento de costo FIFO para una venta sin líneas de producto', async () => {
		const findVentas = vi.fn().mockResolvedValue([]);
		const client = crearClient({ venta: { findMany: findVentas } });

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.some((item) => item.origenTipo === 'venta_costo')).toBe(false);
		expect(findVentas).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ items: { some: {} } }),
		}));
		expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
	});

	it('reconstruye una merma aplicada en CUP y omite versiones no verificables', async () => {
		const fecha = new Date('2026-10-10T00:00:00.000Z');
		const ajuste = { id: 'ajuste-1', tenantId: 'tenant-1', origenMermaId: 'merma-1',
			estado: 'APLICADO', costoTotal: -25, createdAt: fecha };
		const client = crearClient({ ajusteInventario: { findMany: vi.fn().mockResolvedValue([ajuste]) } });
		const buscar = async () => (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'ajuste_merma' && item.origenId === ajuste.id);
		expect(await buscar()).toMatchObject({ fecha, evento: { tipo: 'MERMA_INVENTARIO',
			origen: { tipo: 'ajuste_merma', id: ajuste.id }, monto: 25, moneda: 'CUP', montoFuncional: 25 },
		});
		client.ajusteInventario.findMany.mockResolvedValue([{ ...ajuste, estado: 'ANULADO' }]);
		expect((await buscar())?.causaOmision).toBe('DOCUMENTO_ANULADO');
		client.ajusteInventario.findMany.mockResolvedValue([{ ...ajuste, costoTotal: 0 }]);
		expect((await buscar())?.causaOmision).toBe('MONTO_NO_POSITIVO');
		client.ajusteInventario.findMany.mockResolvedValue([ajuste, { ...ajuste, id: 'ajuste-2' }]);
		expect((await buscar())?.causaOmision).toBe('IDENTIDAD_AMBIGUA');
		client.ajusteInventario.findMany.mockResolvedValue([ajuste]);
		client.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		expect((await buscar())?.causaOmision).toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
	});

	it('reconstruye el reverso de merma con fecha y asiento original verificables', async () => {
		const creada = new Date('2026-10-10T00:00:00.000Z');
		const revertida = new Date('2026-11-10T00:00:00.000Z');
		const ajuste = { id: 'ajuste-1', tenantId: 'tenant-1', origenMermaId: 'merma-1',
			estado: 'ANULADO', costoTotal: -25, createdAt: creada,
			mermaReversionFecha: revertida, mermaReversionRegistradaAt: revertida };
		const linea = (cuentaId: string, debe: number, haber: number) => ({ cuentaId,
			debe: new Prisma.Decimal(debe), haber: new Prisma.Decimal(haber), monedaOriginal: 'CUP',
			montoOriginal: new Prisma.Decimal(25), tasaCambio: new Prisma.Decimal(1) });
		const client = crearClient({ ajusteInventario: { findMany: vi.fn().mockResolvedValue([ajuste]) },
			asiento: { findMany: vi.fn().mockResolvedValue([{ origenId: ajuste.id, fecha: creada, estado: 'CONTABILIZADO',
				lineas: [linea('mermas', 25, 0), linea('inventario', 0, 25)] }]) },
			cuentaRolTenant: { findMany: vi.fn().mockResolvedValue([
				{ rol: 'MERMAS', cuentaId: 'mermas' }, { rol: 'INVENTARIOS', cuentaId: 'inventario' },
			]) },
		});
		const buscar = async () => (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'ajuste_merma_reversado' && item.origenId === ajuste.id);
		expect(await buscar()).toMatchObject({ fecha: revertida, evento: { tipo: 'MERMA_INVENTARIO_REVERSADA',
			monto: 25, montoFuncional: 25, moneda: 'CUP' } });
		expect((await buscar())?.causaOmision).toBeUndefined();
		client.ajusteInventario.findMany.mockResolvedValue([{ ...ajuste,
			mermaReversionRegistradaAt: new Date('2026-11-11T00:00:00.000Z') }]);
		expect((await buscar())?.causaOmision).toBe('REVERSION_NO_VERIFICABLE');
		client.ajusteInventario.findMany.mockResolvedValue([ajuste]);
		client.asiento.findMany.mockResolvedValue([]);
		expect((await buscar())?.causaOmision).toBe('ORIGINAL_NO_VERIFICABLE');
	});

	it('reconstruye reverso de merma USD con evidencia FX persistida y omite huella alterada', async () => {
		const creada = new Date('2026-10-10T00:00:00.000Z');
		const revertida = new Date('2026-11-10T00:00:00.000Z');
		const fx = buildAppliedFxEvidence({ originalAmount: 25, originalCurrency: 'CUP',
			functionalCurrency: 'USD', exchangeRate: 0.04, convertedAmount: 1, rateEffectiveAt: creada,
			fxCatalogRateId: 'rate-1', source: 'inventory-adjustment-posting-service' });
		const evidencia = { sourceId: 'ajuste-1', tenantId: 'tenant-1', originalAmount: new Prisma.Decimal(25),
			originalCurrency: 'CUP', functionalAmount: new Prisma.Decimal(1), functionalCurrency: 'USD',
			exchangeRate: new Prisma.Decimal(0.04), rateEffectiveAt: creada, cutoffAt: creada,
			fxCatalogRateId: 'rate-1', provenance: fx.fxProvenanceKind, source: fx.fxProvenanceSource,
			evidenceFingerprint: fx.fxEvidenceFingerprint, evidenceVersion: fx.fxEvidenceVersion,
			evidence: { ...fx, rawConvertedAmount: 1, rawExchangeRate: 0.04 } };
		const linea = (cuentaId: string, debe: number, haber: number) => ({ cuentaId,
			debe: new Prisma.Decimal(debe), haber: new Prisma.Decimal(haber), monedaOriginal: 'CUP',
			montoOriginal: new Prisma.Decimal(25), tasaCambio: new Prisma.Decimal(0.04),
			fxEvidenceFingerprint: fx.fxEvidenceFingerprint });
		const client = crearClient({ ajusteInventario: { findMany: vi.fn().mockResolvedValue([{
			id: 'ajuste-1', tenantId: 'tenant-1', origenMermaId: 'merma-1', estado: 'ANULADO',
			costoTotal: -25, createdAt: creada, mermaReversionFecha: revertida, mermaReversionRegistradaAt: revertida,
		}]) }, asiento: { findMany: vi.fn().mockResolvedValue([{ origenId: 'ajuste-1', fecha: creada,
			estado: 'CONTABILIZADO', lineas: [linea('mermas', 1, 0), linea('inventario', 0, 1)] }]) },
			cuentaRolTenant: { findMany: vi.fn().mockResolvedValue([
				{ rol: 'MERMAS', cuentaId: 'mermas' }, { rol: 'INVENTARIOS', cuentaId: 'inventario' },
			]) }, fxEvidence: { findMany: vi.fn().mockResolvedValue([evidencia]) },
			tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'USD' }) } });
		const buscar = async () => (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'ajuste_merma_reversado' && item.origenId === 'ajuste-1');
		expect(await buscar()).toMatchObject({ evento: { montoFuncional: 1, monedaFuncional: 'USD',
			fxEvidenceFingerprint: fx.fxEvidenceFingerprint } });
		expect((await buscar())?.causaOmision).toBeUndefined();
		expect((await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'ajuste_merma')?.evento)
			.toMatchObject({ montoFuncional: 1, monedaFuncional: 'USD', fxEvidenceFingerprint: fx.fxEvidenceFingerprint });
		const tasaPrecisa = 0.04000000001;
		const montoPreciso = 25 * tasaPrecisa;
		const fxPreciso = buildAppliedFxEvidence({ originalAmount: 25, originalCurrency: 'CUP',
			functionalCurrency: 'USD', exchangeRate: tasaPrecisa, convertedAmount: montoPreciso, rateEffectiveAt: creada,
			fxCatalogRateId: 'rate-1', source: 'inventory-adjustment-posting-service' });
		client.fxEvidence.findMany.mockResolvedValue([{ ...evidencia, functionalAmount: new Prisma.Decimal(1),
			exchangeRate: new Prisma.Decimal(0.04), evidenceFingerprint: fxPreciso.fxEvidenceFingerprint,
			evidence: { ...fxPreciso, rawConvertedAmount: montoPreciso, rawExchangeRate: tasaPrecisa } }]);
		client.asiento.findMany.mockResolvedValue([{ origenId: 'ajuste-1', fecha: creada, estado: 'CONTABILIZADO',
			lineas: [linea('mermas', 1, 0), linea('inventario', 0, 1)].map((item) => ({ ...item,
				fxEvidenceFingerprint: fxPreciso.fxEvidenceFingerprint })) }]);
		expect((await buscar())?.evento.montoFuncional).toBe(montoPreciso);
		expect((await buscar())?.causaOmision).toBeUndefined();
		client.fxEvidence.findMany.mockResolvedValue([{ ...evidencia, evidenceFingerprint: 'alterada' }]);
		expect((await buscar())?.causaOmision).toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
	});

	function conciliacion(overrides: Record<string, unknown> = {}) {
		return {
			reconciliacionId: 'rec-1',
			ventaId: 'venta-1',
			cuentaId: 'cuenta-1',
			monto: new Prisma.Decimal(100),
			moneda: 'CUP',
			montoConvertido: new Prisma.Decimal(100),
			functionalCurrency: 'CUP',
			tasaCambio: null,
			fxEvidenceFingerprint: null,
			fechaReconciliacion: new Date('2026-10-10T00:00:00.000Z'),
			observaciones: 'Cobro de venta',
			idTransferencia: 'AUTO-factura1',
			venta: {
				ventaId: 'venta-1',
				deletedAt: null,
				factura: { idFactura: 'factura-1' },
			},
			...overrides,
		};
	}

	function factura(overrides: Record<string, unknown> = {}) {
		return {
			idFactura: 'factura-1',
			ventaId: 'venta-1',
			total: new Prisma.Decimal(100),
			estado: 'PENDIENTE',
			fechaEmision: new Date('2026-10-05T00:00:00.000Z'),
			...overrides,
		};
	}

	it('reconstruye el desembolso de deuda cash desde la evidencia persistida', async () => {
		const deuda = {
			id: 'deuda-1', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: 'Descripción editada',
			deletedAt: null, cashInterestGrantDate: new Date('2026-10-10'),
			createdAt: new Date('2026-10-10'),
		};
		const client = crearClient({
			deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([
				conciliacion({ ventaId: null, venta: null, deudaCashId: deuda.id,
					observaciones: 'Descripción original',
					...buildAppliedFxEvidence({ originalAmount: 100, originalCurrency: 'CUP',
						functionalCurrency: 'CUP', source: 'cash-debt-obligation' }),
					rateEffectiveAt: new Date('2026-10-10'), tasaCambio: new Prisma.Decimal(1),
					tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' }),
			]) },
		});
		const candidatos = await recolectarCandidatos('tenant-1', client as never);
		expect(candidatos).toHaveLength(1);
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'deuda_cash', origenId: 'deuda-1',
			evento: { tipo: 'DEUDA_RECIBIDA', medioCobro: 'BANCOS',
				descripcion: 'Descripción original',
				origen: { tipo: 'deuda_cash', id: 'deuda-1' } },
		});
		expect(candidatos[0].causaOmision).toBeUndefined();
	});

	it('reconstruye un préstamo Cash vinculado a su desembolso verificado', async () => {
		const prestamo = { id: 'prestamo-1', tenantId: 'tenant-1', clienteId: 'cliente-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: 'editada', deletedAt: null,
			cashInterestGrantDate: new Date('2026-10-10'), fechaOtorgamiento: new Date('2026-10-10') };
		const fx = buildAppliedFxEvidence({ originalAmount: 100, originalCurrency: 'CUP',
			functionalCurrency: 'CUP', source: 'cash-loan-obligation' });
		const client = crearClient({ prestamoCash: { findMany: vi.fn().mockResolvedValue([prestamo]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([
				conciliacion({ ventaId: null, venta: null, prestamoCashId: prestamo.id,
					tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', observaciones: 'Préstamo original',
					idempotencyKey: 'clave-1', ...fx, rateEffectiveAt: new Date('2026-10-10'), tasaCambio: new Prisma.Decimal(1) }),
			]) } });
		const [candidato] = await recolectarCandidatos('tenant-1', client as never);
		expect(candidato).toMatchObject({ origenTipo: 'prestamo_cash', origenId: prestamo.id,
			evento: { tipo: 'PRESTAMO_OTORGADO', descripcion: 'Préstamo original', referencia: 'clave-1',
				medioCobro: 'BANCOS' } });
		expect(candidato.causaOmision).toBeUndefined();
		client.reconciliacionVenta.findMany.mockResolvedValue([
			conciliacion({ ventaId: null, venta: null, prestamoCashId: prestamo.id,
				tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', observaciones: 'Préstamo original',
				idempotencyKey: null, ...fx, rateEffectiveAt: new Date('2026-10-10'),
				tasaCambio: new Prisma.Decimal(1) }),
		]);
		const [sinClave] = await recolectarCandidatos('tenant-1', client as never);
		expect(sinClave.evento.referencia).toBe('rec-1');
		expect(sinClave.causaOmision).toBeUndefined();
	});

	it('omite un préstamo sin vínculo de desembolso', async () => {
		const prestamo = { id: 'prestamo-1', tenantId: 'tenant-1', clienteId: 'cliente-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: null, deletedAt: null,
			cashInterestGrantDate: new Date('2026-10-10'), fechaOtorgamiento: new Date('2026-10-10') };
		const client = crearClient({ prestamoCash: { findMany: vi.fn().mockResolvedValue([prestamo]) } });
		const [candidato] = await recolectarCandidatos('tenant-1', client as never);
		expect(candidato).toMatchObject({ origenTipo: 'prestamo_cash', origenId: prestamo.id,
			causaOmision: 'DESEMBOLSO_NO_VERIFICABLE' });
	});

	it('omite una descripción por defecto que no puede distinguirse de una observación explícita', async () => {
		const deuda = { id: 'deuda-1', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: null,
			deletedAt: null, cashInterestGrantDate: new Date('2026-10-10'), createdAt: new Date('2026-10-10') };
		const client = crearClient({ deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([
				conciliacion({ ventaId: null, venta: null, deudaCashId: deuda.id,
					tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
					observaciones: 'Desembolso de deuda cash para proveedor proveedor-1',
					...buildAppliedFxEvidence({ originalAmount: 100, originalCurrency: 'CUP',
						functionalCurrency: 'CUP', source: 'cash-debt-obligation' }),
					rateEffectiveAt: new Date('2026-10-10'), tasaCambio: new Prisma.Decimal(1) }),
			]) } });
		const candidatos = await recolectarCandidatos('tenant-1', client as never);
		expect(candidatos[0].causaOmision).toBe('DESCRIPCION_NO_VERIFICABLE');
	});

	it('no acredita un desembolso sin deuda del mismo tenant', async () => {
		const client = crearClient({ reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([
			conciliacion({ ventaId: null, venta: null, deudaCashId: 'ajena',
				tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' }),
		]) } });
		const candidatos = await recolectarCandidatos('tenant-1', client as never);
		expect(candidatos).toHaveLength(1);
		expect(candidatos[0]).toMatchObject({ origenTipo: 'desembolso_deuda_no_verificado',
			origenId: 'rec-1', causaOmision: 'DESEMBOLSO_NO_VERIFICABLE' });
	});

	it('exige una huella FX válida para un desembolso en otra moneda', async () => {
		const deuda = { id: 'deuda-usd', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'USD', observaciones: 'Deuda original',
			deletedAt: null, cashInterestGrantDate: new Date('2026-10-10'), createdAt: new Date('2026-10-10') };
		const fecha = new Date('2026-10-10T00:00:00.000Z');
		const fx = buildAppliedFxEvidence({ originalAmount: 100, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 24, convertedAmount: 2400,
			rateEffectiveAt: fecha, source: 'cash-debt-obligation' });
		const row = conciliacion({ ventaId: null, venta: null, deudaCashId: deuda.id,
			tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', observaciones: 'Deuda original',
			moneda: 'USD', montoConvertido: new Prisma.Decimal(2400), tasaCambio: new Prisma.Decimal(24),
			...fx, rateEffectiveAt: fecha });
		const client = crearClient({ deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([row]) } });
		const [valido] = await recolectarCandidatos('tenant-1', client as never);
		expect(valido.causaOmision).toBeUndefined();
		expect(valido.evento).toMatchObject({ moneda: 'USD', monedaFuncional: 'CUP',
			fxEvidenceFingerprint: fx.fxEvidenceFingerprint });
		client.reconciliacionVenta.findMany.mockResolvedValue([{ ...row, fxEvidenceFingerprint: 'alterada' }]);
		const [invalido] = await recolectarCandidatos('tenant-1', client as never);
		expect(invalido.causaOmision).toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
	});

	it('omite un desembolso duplicado sin escoger una conciliación arbitraria', async () => {
		const deuda = { id: 'deuda-1', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: null,
			deletedAt: null, cashInterestGrantDate: new Date('2026-10-10'), createdAt: new Date('2026-10-10') };
		const row = conciliacion({ ventaId: null, venta: null, deudaCashId: deuda.id,
			tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' });
		const client = crearClient({ deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([row, { ...row, reconciliacionId: 'rec-2' }]) } });
		const [resultado] = await recolectarCandidatos('tenant-1', client as never);
		expect(resultado.causaOmision).toBe('IDENTIDAD_AMBIGUA');
	});

	it('omite pagos Cash si falta o cambia la asignación acreditada', async () => {
		const fecha = new Date('2026-10-10T00:00:00.000Z');
		const deuda = { id: 'deuda-1', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: 'original',
			deletedAt: null, cashInterestGrantDate: fecha, createdAt: fecha };
		const fx = buildAppliedFxEvidence({ originalAmount: 100, originalCurrency: 'CUP',
			functionalCurrency: 'CUP', source: 'cash-debt-payment' });
		const base = {
			tenantId: 'tenant-1', reconciliacionId: 'rec-1', obligationType: 'debt', policyVersion: 1,
			paymentDate: fecha, principalBefore: new Prisma.Decimal(100),
			ordinaryAnnualRate: new Prisma.Decimal(0), moratoryAnnualRate: new Prisma.Decimal(0),
			ordinaryCarryBefore: new Prisma.Decimal(0), moratoryCarryBefore: new Prisma.Decimal(0),
			paymentAmount: new Prisma.Decimal(100), functionalAmount: new Prisma.Decimal(100),
			fxEvidenceFingerprint: fx.fxEvidenceFingerprint, ordinaryAllocated: new Prisma.Decimal(0),
			moratoryAllocated: new Prisma.Decimal(0), principalAllocated: new Prisma.Decimal(100),
			ordinaryFunctional: new Prisma.Decimal(0), moratoryFunctional: new Prisma.Decimal(0),
			principalFunctional: new Prisma.Decimal(100), functionalCurrency: 'CUP', asientoId: null, asiento: null,
		};
		const asignacion = { ...base, eventFingerprint: cashPaymentAllocationFingerprint(base) };
		const pago = conciliacion({ ventaId: null, venta: null, deudaCashId: deuda.id,
			tipoReconciliacion: 'DEUDA_CASH', idempotencyKey: null, ...fx,
			rateEffectiveAt: fecha, tasaCambio: new Prisma.Decimal(1), cashInterestAllocation: asignacion });
		const client = crearClient({ deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([pago]) } });
		const encontrar = async () => (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenTipo === 'reconciliacion_gasto' && item.origenId === 'rec-1');
		expect((await encontrar())?.causaOmision).toBeUndefined();
		for (const invalid of [null, { ...asignacion, eventFingerprint: 'alterada' },
			{ ...asignacion, principalFunctional: new Prisma.Decimal(99) },
			{ ...asignacion, ordinaryFunctional: new Prisma.Decimal(1), principalFunctional: new Prisma.Decimal(99) }]) {
			client.reconciliacionVenta.findMany.mockResolvedValue([{ ...pago, cashInterestAllocation: invalid }]);
			expect((await encontrar())?.causaOmision).toBe('ASIGNACION_NO_VERIFICABLE');
		}
	});

	it('omite la deuda cash si falta o se contradice su evidencia de desembolso', async () => {
		const deuda = {
			id: 'deuda-1', tenantId: 'tenant-1', proveedorId: 'proveedor-1',
			montoCapital: new Prisma.Decimal(100), moneda: 'CUP', observaciones: null,
			deletedAt: null, cashInterestGrantDate: new Date('2026-10-10'),
			createdAt: new Date('2026-10-10'),
		};
		for (const reconciliaciones of [[], [conciliacion({ ventaId: null, venta: null,
			deudaCashId: deuda.id, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', monto: new Prisma.Decimal(99) })]]) {
			const client = crearClient({ deudaCash: { findMany: vi.fn().mockResolvedValue([deuda]) },
				reconciliacionVenta: { findMany: vi.fn().mockResolvedValue(reconciliaciones) } });
			const candidatos = await recolectarCandidatos('tenant-1', client as never);
			expect(candidatos).toHaveLength(1);
			expect(candidatos[0]).toMatchObject({ origenTipo: 'deuda_cash', origenId: deuda.id,
				causaOmision: 'DESEMBOLSO_NO_VERIFICABLE' });
		}
	});

	it('reconoce la venta a credito y el cobro de su cuenta por cobrar', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([conciliacion()]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura()]) },
			cuentaPorCobrar: {
				findMany: vi.fn().mockResolvedValue([
					{ id: 'cx-1', facturaId: 'factura-1', estado: 'PENDIENTE' },
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(2);
		const credito = candidatos.find((c) => c.origenTipo === 'factura');
		expect(credito?.causaOmision).toBeUndefined();
		expect(credito).toMatchObject({
			origenId: 'factura-1',
			evento: {
				tipo: 'VENTA_CREDITO',
				origen: { tipo: 'factura', id: 'factura-1' },
				moneda: 'CUP',
			},
		});
		const cobro = candidatos.find((c) => c.origenTipo === 'reconciliacion_venta');
		expect(cobro?.causaOmision).toBeUndefined();
		expect(cobro).toMatchObject({
			origenId: 'rec-1',
			evento: {
				tipo: 'COBRO_CXC',
				origen: { tipo: 'reconciliacion_venta', id: 'rec-1' },
				medioCobro: 'CAJA',
			},
		});
	});

	it('reconoce la venta cobrada al contado con la valoracion persistida', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({ observaciones: 'Cobro total por contra pago' }),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura({ estado: 'PAGADA' })]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'reconciliacion_venta',
			origenId: 'rec-1',
			evento: {
				tipo: 'VENTA_CONTADO',
				montoFuncional: new Prisma.Decimal(100),
				monedaFuncional: 'CUP',
				referencia: 'AUTO-factura1',
			},
		});
	});

	it('omite la venta cobrada al contado cuando tiene mas de una conciliacion', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion(),
					conciliacion({ reconciliacionId: 'rec-2' }),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura({ estado: 'PAGADA' })]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(2);
		expect(candidatos.every((c) => c.causaOmision === 'IDENTIDAD_AMBIGUA')).toBe(true);
	});

	it('omite la venta anulada', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({
						venta: {
							ventaId: 'venta-1',
							deletedAt: new Date('2026-10-11T00:00:00.000Z'),
							factura: { idFactura: 'factura-1' },
						},
					}),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura()]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.every((c) => c.causaOmision === 'VENTA_ANULADA')).toBe(true);
	});

	it('no inventa un asiento para la venta directa sin factura', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({ venta: { ventaId: 'venta-1', deletedAt: null, factura: null } }),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	function devolucion(overrides: Record<string, unknown> = {}) {
		return {
			devolucionId: 'dev-1',
			ventaId: 'venta-1',
			estado: 'REGISTRADA',
			total: 1000,
			moneda: 'CUP',
			tasaCambio: new Prisma.Decimal(1),
			montoAplicadoCxc: 600,
			montoSaldoFavor: 250,
			montoReembolsado: 150,
			costoFifoFuncional: new Prisma.Decimal(400),
			idempotencyKey: 'dev-key-1',
			createdAt: new Date('2026-10-12T00:00:00.000Z'),
			...overrides,
		};
	}

	it('reconoce la devolucion de venta con el desglose que el writer persistio', async () => {
		const client = crearClient({
			devolucionVenta: { findMany: vi.fn().mockResolvedValue([devolucion()]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'devolucion_venta',
			origenId: 'dev-1',
			evento: {
				tipo: 'DEVOLUCION_VENTA',
				origen: { tipo: 'devolucion_venta', id: 'dev-1' },
				monto: 1000,
				moneda: 'CUP',
				montoFuncional: 1000,
				monedaFuncional: 'CUP',
				descripcion: 'Devolucion de la venta venta-1',
				referencia: 'dev-key-1',
				auxiliares: {
					montoAplicadoCxc: 600,
					montoSaldoFavor: 250,
					montoReembolsado: 150,
					costoFifo: 400,
				},
			},
		});
	});

	it('omite la devolucion anulada', async () => {
		const client = crearClient({
			devolucionVenta: {
				findMany: vi.fn().mockResolvedValue([devolucion({ estado: 'ANULADA' })]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('DOCUMENTO_ANULADO');
	});

	it('omite la devolucion en moneda extranjera sin tasa persistida', async () => {
		const client = crearClient({
			devolucionVenta: {
				findMany: vi.fn().mockResolvedValue([devolucion({ moneda: 'USD', tasaCambio: null })]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('TASA_CAMBIO_NO_PERSISTIDA');
	});

	it('reconoce el ajuste bancario con la tasa persistida', async () => {
		const client = crearClient({
			ajusteBancario: {
				findMany: vi.fn().mockResolvedValue([
					{
						ajusteId: 'ajuste-1',
						tipo: 'ingreso',
						monto: new Prisma.Decimal(100),
						moneda: 'CUP',
						tasaCambio: new Prisma.Decimal(1),
						descripcion: 'Ajuste de banco',
						idempotencyKey: 'ajuste-key-1',
						fechaOperacion: new Date('2026-10-14T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'ajuste_bancario',
			origenId: 'ajuste-1',
			evento: {
				tipo: 'AJUSTE_BANCARIO_ABONO',
				origen: { tipo: 'ajuste_bancario', id: 'ajuste-1' },
				monto: 100,
				moneda: 'CUP',
				montoFuncional: 100,
				medioCobro: 'BANCOS',
				referencia: 'ajuste-key-1',
			},
		});
	});

	it('reconoce la inyeccion de capital con la tasa y el importe persistidos', async () => {
		const client = crearClient({
			inyeccionCapital: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 'inyeccion-1',
						tipo: 'DEUDA_EXTERNA',
						montoRecibido: new Prisma.Decimal(120),
						moneda: 'USD',
						tasaCambio: new Prisma.Decimal(250),
						descripcion: 'Deuda en dolares',
						idempotencyKey: 'inyeccion-key-1',
						fechaRegistro: new Date('2026-10-15T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'inyeccion_capital',
			origenId: 'inyeccion-1',
			evento: {
				tipo: 'DEUDA_RECIBIDA',
				origen: { tipo: 'inyeccion_capital', id: 'inyeccion-1' },
				monto: 120,
				moneda: 'USD',
				montoFuncional: 30000,
				tasaCambio: 250,
				medioCobro: 'BANCOS',
			},
		});
		expect(candidatos[0].evento.fxEvidenceFingerprint).toBeTruthy();
	});

	it('omite el ajuste en moneda extranjera sin tasa persistida', async () => {
		const client = crearClient({
			ajusteBancario: {
				findMany: vi.fn().mockResolvedValue([
					{
						ajusteId: 'ajuste-2',
						tipo: 'egreso',
						monto: new Prisma.Decimal(50),
						moneda: 'USD',
						tasaCambio: null,
						descripcion: 'Ajuste sin tasa',
						idempotencyKey: 'ajuste-key-2',
						fechaOperacion: new Date('2026-10-16T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('TASA_CAMBIO_NO_PERSISTIDA');
	});

	it('ordena los candidatos por fecha de negocio', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({
						fechaReconciliacion: new Date('2026-10-20T00:00:00.000Z'),
					}),
				]),
			},
			factura: {
				findMany: vi.fn().mockResolvedValue([
					factura({ fechaEmision: new Date('2026-10-01T00:00:00.000Z') }),
				]),
			},
			cuentaPorCobrar: {
				findMany: vi.fn().mockResolvedValue([
					{ id: 'cx-1', facturaId: 'factura-1', estado: 'PENDIENTE' },
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.map((c) => c.evento.tipo)).toEqual(['VENTA_CREDITO', 'COBRO_CXC']);
	});

	it('reconoce el pago de un gasto con la valoracion persistida', async () => {
		const client = crearClient({
			reconciliacionGasto: {
				findMany: vi.fn().mockResolvedValue([
					{
						reconciliacionId: 'rec-gasto-1',
						cuentaId: 'cuenta-1',
						monto: new Prisma.Decimal(50),
						moneda: 'CUP',
						montoConvertido: new Prisma.Decimal(50),
						functionalCurrency: 'CUP',
						tasaCambio: null,
						fxEvidenceFingerprint: null,
						fechaReconciliacion: new Date('2026-10-12T00:00:00.000Z'),
						descripcion: 'Pago de gasto #1',
						estado: 'PAGADA',
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'reconciliacion_gasto',
			origenId: 'rec-gasto-1',
			evento: {
				tipo: 'PAGO_CXP',
				origen: { tipo: 'reconciliacion_gasto', id: 'rec-gasto-1' },
				descripcion: 'Pago de gasto #1',
			},
		});
	});

	it('no propone asiento para la conciliacion de gasto pendiente', async () => {
		const client = crearClient({
			reconciliacionGasto: {
				findMany: vi.fn().mockResolvedValue([
					{
						reconciliacionId: 'rec-gasto-1',
						cuentaId: 'cuenta-1',
						monto: new Prisma.Decimal(50),
						moneda: 'CUP',
						montoConvertido: new Prisma.Decimal(50),
						functionalCurrency: 'CUP',
						tasaCambio: null,
						fxEvidenceFingerprint: null,
						fechaReconciliacion: new Date('2026-10-12T00:00:00.000Z'),
						descripcion: 'Pago de gasto #1',
						estado: 'PENDIENTE',
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	it('reconoce la compra a plazo en la moneda funcional', async () => {
		const client = crearClient({
			compraDocumento: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraDocumentoId: 'compra-1',
						fechaCompra: new Date('2026-10-03T00:00:00.000Z'),
						total: 300,
						moneda: 'CUP',
						formaPago: 'PAGO_PARCIAL',
						deletedAt: null,
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'compra_documento',
			origenId: 'compra-1',
			evento: {
				tipo: 'COMPRA_CREDITO',
				monto: 300,
				moneda: 'CUP',
				montoFuncional: 300,
				monedaFuncional: 'CUP',
			},
		});
	});

	it('omite la compra pagada al contado porque no genera reconocimiento', async () => {
		const client = crearClient({
			compraDocumento: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraDocumentoId: 'compra-1',
						fechaCompra: new Date('2026-10-03T00:00:00.000Z'),
						total: 300,
						moneda: 'CUP',
						formaPago: 'CONTADO',
						deletedAt: null,
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	it('omite la compra en moneda extranjera porque su tasa no quedo persistida', async () => {
		const client = crearClient({
			compraDocumento: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraDocumentoId: 'compra-1',
						fechaCompra: new Date('2026-10-03T00:00:00.000Z'),
						total: 300,
						moneda: 'USD',
						formaPago: 'PAGO_PARCIAL',
						deletedAt: null,
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('TASA_CAMBIO_NO_PERSISTIDA');
	});

	it('omite la compra anulada', async () => {
		const client = crearClient({
			compraDocumento: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraDocumentoId: 'compra-1',
						fechaCompra: new Date('2026-10-03T00:00:00.000Z'),
						total: 300,
						moneda: 'CUP',
						formaPago: 'PAGO_PARCIAL',
						deletedAt: new Date('2026-10-08T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('DOCUMENTO_ANULADO');
	});

	it('reconoce la compra de servicio con la moneda del catalogo', async () => {
		const client = crearClient({
			compraServicio: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraServicioId: 'servicio-1',
						fechaServicio: new Date('2026-10-04T00:00:00.000Z'),
						total: 80,
						moneda: null,
						servicio: { moneda: 'CUP' },
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'compra_servicio',
			origenId: 'servicio-1',
			evento: {
				tipo: 'GASTO_CREDITO',
				monto: 80,
				moneda: 'CUP',
				montoFuncional: 80,
			},
		});
	});

	it('omite la compra de servicio en moneda extranjera sin tasa publicada', async () => {
		const client = crearClient({
			compraServicio: {
				findMany: vi.fn().mockResolvedValue([
					{
						compraServicioId: 'servicio-1',
						fechaServicio: new Date('2026-10-04T00:00:00.000Z'),
						total: 80,
						moneda: 'USD',
						servicio: { moneda: 'USD' },
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
	});

	it('reconoce la venta de servicio', async () => {
		const client = crearClient({
			ventaServicios: {
				findMany: vi.fn().mockResolvedValue([
					{
						ventaServicioId: 'venta-servicio-1',
						total: 120,
						moneda: 'CUP',
						createdAt: new Date('2026-10-06T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'venta_servicio',
			origenId: 'venta-servicio-1',
			evento: {
				tipo: 'VENTA_SERVICIO_CREDITO',
				monto: 120,
				moneda: 'CUP',
			},
		});
	});

	it('reconstruye cada cobro de servicio desde la reconciliacion persistida', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ reconciliacionServicio: { findMany: vi.fn().mockResolvedValue([{
			reconciliacionId: 'reconciliacion-servicio-1', ventaServicioId: 'venta-servicio-1',
			cuentaId: 'cuenta-1', monto: 75, moneda: 'CUP', montoConvertido: 75,
			functionalCurrency: 'CUP', tasaCambio: null, fxEvidenceFingerprint: null,
			fechaReconciliacion: fecha, observaciones: 'Cobro servicio',
		}]) } });

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		const candidato = candidatos.find((item) => item.origenId === 'reconciliacion-servicio-1');
		expect(candidato).toMatchObject({
			origenTipo: 'reconciliacion_servicio', origenId: 'reconciliacion-servicio-1', fecha,
			evento: expect.objectContaining({ tipo: 'COBRO_SERVICIO', moneda: 'CUP',
				monedaFuncional: 'CUP' }),
		});
		expect(candidato?.evento.monto).toEqual(new Prisma.Decimal(75));
		expect(candidato?.evento.montoFuncional).toEqual(new Prisma.Decimal(75));
		expect(candidato).not.toHaveProperty('causaOmision');
	});

	it('omite el cobro de servicio extranjero si falta evidencia FX persistida', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const client = crearClient({ reconciliacionServicio: { findMany: vi.fn().mockResolvedValue([{
			reconciliacionId: 'reconciliacion-servicio-sin-fx', ventaServicioId: 'venta-servicio-1',
			cuentaId: 'cuenta-1', monto: 10, moneda: 'USD', montoConvertido: 1500,
			functionalCurrency: 'CUP', tasaCambio: null, fxEvidenceFingerprint: null,
			rateEffectiveAt: null, fxProvenanceKind: null, fxProvenanceSource: null,
			fxCatalogRateId: null, fxEvidenceVersion: null,
			fechaReconciliacion: fecha, observaciones: null,
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenId === 'reconciliacion-servicio-sin-fx');

		expect(candidato?.causaOmision).toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
	});

	it('acepta el cobro de servicio extranjero con evidencia FX canónica completa', async () => {
		const fecha = new Date('2026-10-12T12:00:00.000Z');
		const fechaTasa = new Date('2026-10-11T12:00:00.000Z');
		const fx = buildAppliedFxEvidence({
			originalAmount: 10,
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: 150,
			convertedAmount: 1500,
			rateEffectiveAt: fechaTasa,
			fxCatalogRateId: 'service-rate-1',
			source: 'service-reconciliation',
		});
		const client = crearClient({ reconciliacionServicio: { findMany: vi.fn().mockResolvedValue([{
			reconciliacionId: 'reconciliacion-servicio-usd', ventaServicioId: 'venta-servicio-1',
			cuentaId: 'cuenta-1', monto: 10, moneda: 'USD', montoConvertido: 1500,
			functionalCurrency: 'CUP', tasaCambio: 150,
			rateEffectiveAt: new Date(fx.rateEffectiveAt),
			fxProvenanceKind: fx.fxProvenanceKind,
			fxProvenanceSource: fx.fxProvenanceSource,
			fxCatalogRateId: fx.fxCatalogRateId,
			fxEvidenceFingerprint: fx.fxEvidenceFingerprint,
			fxEvidenceVersion: fx.fxEvidenceVersion,
			fechaReconciliacion: fecha, observaciones: 'Cobro USD',
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenId === 'reconciliacion-servicio-usd');

		expect(candidato?.evento.montoFuncional).toEqual(new Prisma.Decimal(1500));
		expect(candidato?.evento.fxEvidenceFingerprint).toBe(fx.fxEvidenceFingerprint);
		expect(candidato).not.toHaveProperty('causaOmision');
	});

	it('reconstruye transferencias en moneda funcional con importes iguales y cuentas del tenant', async () => {
		const fecha = new Date('2026-10-13T12:00:00.000Z');
		const client = crearClient({ transferenciaBancaria: { findMany: vi.fn().mockResolvedValue([{
			transferenciaId: 'transferencia-1', tenantId: 'tenant-1', numeroComprobante: 'TRF-1',
			cuentaOrigenId: 'cuenta-1', cuentaDestinoId: 'cuenta-2', montoOrigen: 90,
			monedaOrigen: 'CUP', montoDestino: 90, monedaDestino: 'CUP', tasaCambio: null,
			motivo: 'Movimiento interno', descripcion: null, fechaTransferencia: fecha, existe: true,
			cuentaOrigen: { cuentaId: 'cuenta-1', tenantId: 'tenant-1', moneda: 'CUP' },
			cuentaDestino: { cuentaId: 'cuenta-2', tenantId: 'tenant-1', moneda: 'CUP' },
		}]) } });

		const candidato = (await recolectarCandidatos('tenant-1', client as never))
			.find((item) => item.origenId === 'transferencia-1');

		expect(candidato).toMatchObject({
			origenTipo: 'transferencia_bancaria', origenId: 'transferencia-1', fecha,
			evento: expect.objectContaining({ tipo: 'TRANSFERENCIA_BANCARIA', moneda: 'CUP',
				monedaFuncional: 'CUP' }),
		});
		expect(candidato?.evento.monto).toEqual(new Prisma.Decimal(90));
		expect(candidato?.evento.montoFuncional).toEqual(new Prisma.Decimal(90));
		expect(candidato).not.toHaveProperty('causaOmision');
	});

	it('omite transferencias FX y con cuenta de otro tenant', async () => {
		const fecha = new Date('2026-10-13T12:00:00.000Z');
		const client = crearClient({ transferenciaBancaria: { findMany: vi.fn().mockResolvedValue([
			{
				transferenciaId: 'transferencia-fx', tenantId: 'tenant-1', numeroComprobante: 'TRF-2',
				cuentaOrigenId: 'cuenta-1', cuentaDestinoId: 'cuenta-2', montoOrigen: 10,
				monedaOrigen: 'USD', montoDestino: 1500, monedaDestino: 'CUP', tasaCambio: 150,
				motivo: 'Cambio', descripcion: null, fechaTransferencia: fecha, existe: true,
				cuentaOrigen: { cuentaId: 'cuenta-1', tenantId: 'tenant-1', moneda: 'USD' },
				cuentaDestino: { cuentaId: 'cuenta-2', tenantId: 'tenant-1', moneda: 'CUP' },
			},
			{
				transferenciaId: 'transferencia-ajena', tenantId: 'tenant-1', numeroComprobante: 'TRF-3',
				cuentaOrigenId: 'cuenta-1', cuentaDestinoId: 'cuenta-ajena', montoOrigen: 20,
				monedaOrigen: 'CUP', montoDestino: 20, monedaDestino: 'CUP', tasaCambio: null,
				motivo: 'Cruce', descripcion: null, fechaTransferencia: fecha, existe: true,
				cuentaOrigen: { cuentaId: 'cuenta-1', tenantId: 'tenant-1', moneda: 'CUP' },
				cuentaDestino: { cuentaId: 'cuenta-ajena', tenantId: 'tenant-2', moneda: 'CUP' },
			},
			{
				transferenciaId: 'transferencia-misma-cuenta', tenantId: 'tenant-1', numeroComprobante: 'TRF-4',
				cuentaOrigenId: 'cuenta-1', cuentaDestinoId: 'cuenta-1', montoOrigen: 20,
				monedaOrigen: 'CUP', montoDestino: 20, monedaDestino: 'CUP', tasaCambio: null,
				motivo: 'Cuenta repetida', descripcion: null, fechaTransferencia: fecha, existe: true,
				cuentaOrigen: { cuentaId: 'cuenta-1', tenantId: 'tenant-1', moneda: 'CUP' },
				cuentaDestino: { cuentaId: 'cuenta-1', tenantId: 'tenant-1', moneda: 'CUP' },
			},
		]) } });

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.find((item) => item.origenId === 'transferencia-fx')?.causaOmision)
			.toBe('VALORACION_FUNCIONAL_NO_VERIFICABLE');
		expect(candidatos.find((item) => item.origenId === 'transferencia-ajena')?.causaOmision)
			.toBe('TRANSFERENCIA_CUENTA_TENANT_NO_COINCIDE');
		expect(candidatos.find((item) => item.origenId === 'transferencia-misma-cuenta')?.causaOmision)
			.toBe('TRANSFERENCIA_CUENTAS_IGUALES');
	});

	it('no propone asiento para la venta de servicio sin monto', async () => {
		const client = crearClient({
			ventaServicios: {
				findMany: vi.fn().mockResolvedValue([
					{
						ventaServicioId: 'venta-servicio-1',
						total: 0,
						moneda: 'CUP',
						createdAt: new Date('2026-10-06T00:00:00.000Z'),
					},
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	function movimiento(overrides: Record<string, unknown> = {}) {
		return {
			movimientoId: 'mov-1',
			tipoMovimiento: 'RECEPCION',
			cuentaId: 'cuenta-1',
			monto: new Prisma.Decimal(70),
			moneda: 'CUP',
			tasaAplicada: null,
			montoFuncional: new Prisma.Decimal(70),
			functionalCurrency: 'CUP',
			fxEvidenceFingerprint: null,
			valorAnticipoFuncional: null,
			valorTesoreriaFuncional: null,
			createdAt: new Date('2026-10-07T00:00:00.000Z'),
			anticipo: { tipo: 'COBRO', referenciaExterna: null },
			...overrides,
		};
	}

	it('reconoce la recepcion de un anticipo de cliente', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([movimiento()]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'anticipo_movimiento',
			origenId: 'mov-1',
			evento: {
				tipo: 'ANTICIPO_CLIENTE_RECIBIDO',
				origen: { tipo: 'anticipo_movimiento', id: 'mov-1' },
				monto: 70,
				monedaFuncional: 'CUP',
				medioCobro: 'CAJA',
			},
		});
	});

	it('reconoce la entrega de un anticipo a proveedor', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({
						tipoMovimiento: 'ENTREGA',
						anticipo: { tipo: 'PAGO', referenciaExterna: null },
					}),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].evento.tipo).toBe('ANTICIPO_PROVEEDOR_ENTREGADO');
	});

	it('reconoce la aplicacion de un anticipo', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({ tipoMovimiento: 'EJECUCION', cuentaId: null }),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0].evento.tipo).toBe('ANTICIPO_CLIENTE_APLICADO');
	});

	it('no propone asiento para la aplicacion de un anticipo nacido de nota de credito', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({
						tipoMovimiento: 'EJECUCION',
						cuentaId: null,
						anticipo: { tipo: 'COBRO', referenciaExterna: 'NC:factura-9' },
					}),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	it('reconoce el reverso de la aplicacion de un anticipo', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({
						tipoMovimiento: 'REVERSO',
						cuentaId: null,
						moneda: 'USD',
					}),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].evento.tipo).toBe('ANTICIPO_CLIENTE_APLICACION_REVERSADA');
		// El writer del reverso fija la moneda original en CUP.
		expect(candidatos[0].evento.moneda).toBe('CUP');
	});

	it('reconoce la devolucion de un anticipo con su diferencia de cambio', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({
						tipoMovimiento: 'DEVOLUCION',
						valorAnticipoFuncional: new Prisma.Decimal(60),
						valorTesoreriaFuncional: new Prisma.Decimal(65),
					}),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].evento.tipo).toBe('ANTICIPO_CLIENTE_DEVUELTO');
		expect(candidatos[0].evento.auxiliares?.diferenciaFx).toBe(5);
	});

	it('no propone asiento para la reserva de un anticipo', async () => {
		const client = crearClient({
			anticipoMovimiento: {
				findMany: vi.fn().mockResolvedValue([
					movimiento({ tipoMovimiento: 'CREACION_RESERVA' }),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});
});
