/**
 * @description Verifica contra PostgreSQL desechable el ciclo completo del
 * replay historico: preflight → aprobación independiente → ejecución → verificación.
 *
 * El suite exige una base local desechable explicita (`ALLOW_DISPOSABLE_TEST_DB=1`
 * y una base `tcp_test_*`).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import {
	insertarAsientoConNumeracion,
	postEvento,
} from '@/features/contabilidad-formal/services/posting-engine';
import { getFormalFinancialReport } from '@/features/contabilidad-formal/services/formal-financial-report-service';
import { crearCheckpointFormal } from '@/features/contabilidad-formal/services/formal-checkpoint-service';
import { leerCheckpointFormal } from '@/features/contabilidad-formal/services/formal-checkpoint-reader';
import { recolectarCandidatos } from '@/features/contabilidad-formal/services/replay-source-collector';
import {
	emitirReconocimientoMerma,
	emitirReversionMermaSiContabilizada,
} from '@/features/contabilidad-formal/services/inventory-adjustment-posting-service';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
	aprobarPreflightBackfill,
	crearPreflightBackfill,
	ejecutarBackfillAutorizado,
	planBackfillContable,
} from '@/features/contabilidad-formal/services/replay-backfill-service';
import { aplicarBackfillVentaCostoFecha } from '@/features/contabilidad-formal/services/venta-costo-fecha-backfill';

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: vi.fn(async () => auth.user),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const FECHA_INICIO = new Date('2026-03-01T00:00:00.000Z');
const FECHA_FIN = new Date('2026-03-31T23:59:59.999Z');

/**
 * @description Modo formal global vigente antes del suite. El replay exige que
 * la capa formal contabilice los asientos de origen; el suite fija `enforce`
 * y restaura el valor previo al terminar.
 */
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

interface Fixture {
	tenantId: string;
	requesterId: string;
	approverId: string;
	periodoId: string;
	facturaId: string;
	reconciliacionId: string;
}

/**
 * @description Valida que la base de integracion sea un objetivo local
 * desechable autorizado de forma explicita.
 * @returns {URL} URL de la base validada.
 */
function assertDisposableTarget(): URL {
	expect(process.env.ALLOW_DISPOSABLE_TEST_DB).toBe('1');
	const url = new URL(process.env.DATABASE_URL ?? '');
	expect(['postgres:', 'postgresql:']).toContain(url.protocol);
	expect(['127.0.0.1', 'localhost', '[::1]']).toContain(url.hostname);
	expect(url.pathname).toMatch(/^\/tcp_test_[a-z0-9_]+$/);
	return url;
}

describe('replay historico — integración PostgreSQL', { timeout: 120_000 }, () => {
	const fixtures: Fixture[] = [];
	let creoMonedaCUP = false;

	beforeAll(async () => {
		assertDisposableTarget();
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const moneda = await prisma.moneda.findUnique({ where: { codigo: 'CUP' } });
		if (!moneda) {
			await prisma.moneda.create({
				data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
			});
			creoMonedaCUP = true;
		}
		await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
	});

	afterAll(async () => {
		for (const fixture of fixtures) {
			const evidenciaFxInmutable = await prisma.fxEvidence.count({
				where: { tenantId: fixture.tenantId },
			});
			if (evidenciaFxInmutable > 0) continue;
			await prisma.$transaction(async (tx) => {
				await tx.checkpointContableFormal.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.aperturaPeriodoSolicitud.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.aperturaPeriodo.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.asiento.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.ordenProduccion.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.recetaIngrediente.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.receta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.ajusteInventario.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayRun.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayApproval.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.replayPreflight.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.reconciliacionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.reconciliacionServicio.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.reconciliacionGasto.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.deudaCash.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.prestamoCash.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaPorPagar.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.compraDocumento.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.transferenciaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.ventaServicios.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.anticipo.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.servicios.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.vendor.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaPorCobrar.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.factura.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.devolucionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.ventaItem.deleteMany({ where: { venta: { tenantId: fixture.tenantId } } });
				await tx.venta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.serieFacturacion.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cliente.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tipoPago.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaBancaria.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.puntoDeVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.producto.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.categoria.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.almacen.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaRolTenant.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.cuentaContable.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.diario.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.periodoContable.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantAccountingPolicy.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantMembership.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.tenantLicense.deleteMany({ where: { tenantId: fixture.tenantId } });
				await tx.user.deleteMany({
					where: { userId: { in: [fixture.requesterId, fixture.approverId] } },
				});
				await tx.tenant.deleteMany({ where: { tenantId: fixture.tenantId } });
			});
		}
		if (creoMonedaCUP) {
			await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
		}
		if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
		else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
	});

	/**
	 * @description Crea el aislamiento del tenant con una venta a plazo, su
	 * factura, su cuenta por cobrar y el cobro conciliado.
	 * @returns {Promise<Fixture>} Identificadores de la fixture creada.
	 */
	async function crearFixture(): Promise<Fixture> {
		const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
		const tenant = await prisma.tenant.create({
			data: { nombre: `Replay ${suffix}`, slug: `replay-${suffix}` },
		});
		const fixture: Fixture = {
			tenantId: tenant.tenantId,
			requesterId: '',
			approverId: '',
			periodoId: '',
			facturaId: '',
			reconciliacionId: '',
		};
		fixtures.push(fixture);

		const [requester, approver] = await Promise.all([
			prisma.user.create({
				data: {
					name: `Solicitante ${suffix}`,
					email: `requester-${suffix}@replay.test`,
					password: 'hash-de-prueba',
				},
			}),
			prisma.user.create({
				data: {
					name: `Aprobador ${suffix}`,
					email: `approver-${suffix}@replay.test`,
					password: 'hash-de-prueba',
				},
			}),
		]);
		fixture.requesterId = requester.userId;
		fixture.approverId = approver.userId;
		await prisma.tenantMembership.createMany({
			data: [
				{ tenantId: tenant.tenantId, userId: requester.userId, tenantRole: 'manager' },
				{ tenantId: tenant.tenantId, userId: approver.userId, tenantRole: 'manager' },
			],
		});
		await prisma.tenantLicense.create({
			data: {
				tenantId: tenant.tenantId,
				activa: true,
				expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				features: { 'contabilidad-formal': true },
			},
		});
		await prisma.tenantAccountingPolicy.create({
			data: {
				tenantId: tenant.tenantId,
				functionalCurrencyCode: 'CUP',
				updatedBy: 'replay-it',
			},
		});
		await prisma.$transaction((tx) => seedPlanContable(tx, tenant.tenantId));

		const periodo = await prisma.periodoContable.create({
			data: {
				tenantId: tenant.tenantId,
				tipo: 'MENSUAL',
				estado: 'CERRADO',
				codigo: `REP-${suffix}`,
				fechaInicio: FECHA_INICIO,
				fechaFin: FECHA_FIN,
			},
		});
		fixture.periodoId = periodo.periodoId;

		const puntoDeVenta = await prisma.puntoDeVenta.create({
			data: { tenantId: tenant.tenantId, nombre: 'PV replay' },
		});
		const cliente = await prisma.cliente.create({
			data: { tenantId: tenant.tenantId, nombre: `Cliente replay ${suffix}` },
		});
		const serie = await prisma.serieFacturacion.create({
			data: {
				tenantId: tenant.tenantId,
				prefijo: 'RP',
				descripcion: 'Replay',
				consecutivo: 1,
				esPorDefecto: true,
			},
		});
		const tipoPago = await prisma.tipoPago.create({
			data: { tenantId: tenant.tenantId, nombre: `Pago replay ${suffix}` },
		});
		const cuentaBancaria = await prisma.cuentaBancaria.create({
			data: {
				tenantId: tenant.tenantId,
				nombreBanco: 'Banco replay',
				numeroCuenta: `REP-${suffix}`,
				tipoCuenta: 'EFECTIVO',
				saldo: 1000,
				moneda: 'CUP',
			},
		});

		const venta = await prisma.venta.create({
			data: {
				tenantId: tenant.tenantId,
				cantidad: 1,
				puntoDeVentaId: puntoDeVenta.pvId,
				clienteId: cliente.clienteId,
				total: 100,
				estado: 'FACTURADA',
				metodoPago: 'CREDITO',
				esVentaUnica: true,
			},
		});
		const factura = await prisma.factura.create({
			data: {
				tenantId: tenant.tenantId,
				serieId: serie.serieId,
				numeroConsecutivo: 1,
				numeroFactura: `RP-${suffix}-0001`,
				clienteId: cliente.clienteId,
				ventaId: venta.ventaId,
				subtotal: 100,
				total: 100,
				estado: 'PENDIENTE',
				fechaEmision: new Date('2026-03-10T12:00:00.000Z'),
				creadoPor: requester.userId,
			},
		});
		fixture.facturaId = factura.idFactura;
		await prisma.cuentaPorCobrar.create({
			data: {
				tenantId: tenant.tenantId,
				clienteId: cliente.clienteId,
				facturaId: factura.idFactura,
				montoDeuda: 100,
				estado: 'PENDIENTE',
			},
		});
		const reconciliacion = await prisma.reconciliacionVenta.create({
			data: {
				tenantId: tenant.tenantId,
				ventaId: venta.ventaId,
				cuentaId: cuentaBancaria.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				monto: 100,
				moneda: 'CUP',
				montoConvertido: 100,
				functionalCurrency: 'CUP',
				fechaReconciliacion: new Date('2026-03-15T12:00:00.000Z'),
				observaciones: 'Cobro de venta',
				reconciliadoPor: requester.userId,
			},
		});
		fixture.reconciliacionId = reconciliacion.reconciliacionId;
		return fixture;
	}

	/**
	 * @description Crea una venta de producto con su asignación FIFO persistida
	 * para reconstruir el costo histórico desde PostgreSQL.
	 * @param {Fixture} fixture - Tenant al que pertenece la venta.
	 * @param {object} params - Fecha de creación, fecha de devengo persistida,
	 * marca de devolución y modo legacy de la asignación.
	 * @returns {Promise<{ ventaId: string }>} Identificador de la venta creada.
	 */
	async function crearVentaConCostoFifo(
		fixture: Fixture,
		params: {
			fechaCreacion: Date;
			fechaDevengo: Date | null;
			conDevolucion?: boolean;
			asignacionLegacy?: boolean;
			fechaActualizacion?: Date | null;
		},
	): Promise<{ ventaId: string }> {
		const almacen = await prisma.almacen.create({
			data: { tenantId: fixture.tenantId, nombre: 'Almacén replay FIFO' },
		});
		const categoria = await prisma.categoria.create({
			data: { tenantId: fixture.tenantId, nombre: 'Categoría replay FIFO' },
		});
		const producto = await prisma.producto.create({
			data: {
				tenantId: fixture.tenantId,
				nombre: `Producto FIFO ${fixture.tenantId}`,
				precioCosto: 50,
				precioVenta: 100,
				stock: 10,
				categoriaId: categoria.catId,
				almacenId: almacen.almacenId,
			},
		});
		const proveedor = await prisma.vendor.create({
			data: { tenantId: fixture.tenantId, nombre: 'Proveedor replay FIFO' },
		});
		const fechaCompra = new Date('2026-02-10T12:00:00.000Z');
		const compra = await prisma.compraDocumento.create({
			data: {
				tenantId: fixture.tenantId,
				proveedorId: proveedor.vendorId,
				formaPago: 'CONTADO',
				moneda: 'CUP',
				estado: 'PAGADA',
				fechaCompra,
				total: 50,
			},
		});
		const lineaCompra = await prisma.compraDocumentoItem.create({
			data: {
				tenantId: fixture.tenantId,
				compraDocumentoId: compra.compraDocumentoId,
				productoId: producto.id,
				cantidad: 1,
				precioUnitario: 50,
				totalLinea: 50,
			},
		});
		const puntoDeVenta = await prisma.puntoDeVenta.findFirstOrThrow({
			where: { tenantId: fixture.tenantId },
		});
		const cliente = await prisma.cliente.findFirstOrThrow({
			where: { tenantId: fixture.tenantId },
		});
		const venta = await prisma.venta.create({
			data: {
				tenantId: fixture.tenantId,
				cantidad: 1,
				puntoDeVentaId: puntoDeVenta.pvId,
				clienteId: cliente.clienteId,
				total: 100,
				estado: 'ENTREGADA',
				createdAt: params.fechaCreacion,
				...(params.fechaActualizacion
					? { updatedAt: params.fechaActualizacion }
					: {}),
				...(params.fechaDevengo ? { costoVentaFecha: params.fechaDevengo } : {}),
			},
		});
		const ventaItem = await prisma.ventaItem.create({
			data: {
				ventaId: venta.ventaId,
				productoId: producto.id,
				cantidad: 1,
				precioUnitario: 100,
				total: 100,
			},
		});
		const evidencia = buildAppliedFxEvidence({
			originalAmount: 50,
			originalCurrency: 'CUP',
			functionalCurrency: 'CUP',
			exchangeRate: 1,
			convertedAmount: 50,
			rateEffectiveAt: null,
			fxCatalogRateId: null,
			source: 'fifo-allocation',
		});
		await prisma.purchaseAllocation.create({
			data: {
				tenantId: fixture.tenantId,
				compraDocumentoItemId: lineaCompra.compraDocumentoItemId,
				ventaItemId: ventaItem.id,
				cantidad: 1,
				// La asignación legacy no conserva evidencia FX ni snapshot de
				// origen: su costo solo se puede derivar de la factura.
				...(params.asignacionLegacy
					? {}
					: {
							costoUnitarioSnapshot: 50,
							fifoMonedaOrigen: 'CUP',
							fifoFechaFuente: fechaCompra,
							fifoMonedaFuncional: 'CUP',
							fifoCostoFuncional: 50,
							fifoTasaCambio: null,
							fifoFechaTasa: null,
							fifoEvidenciaFx: JSON.stringify({
								...evidencia,
								rawConvertedAmount: 50,
								rawExchangeRate: null,
							}),
						}),
			},
		});
		if (params.conDevolucion) {
			await prisma.devolucionVenta.create({
				data: {
					tenantId: fixture.tenantId,
					ventaId: venta.ventaId,
					estado: 'REGISTRADA',
					subtotal: 100,
					descuento: 0,
					total: 100,
					moneda: 'CUP',
					createdById: fixture.requesterId,
				},
			});
		}
		return { ventaId: venta.ventaId };
	}

	it('lee una merma aplicada desde PostgreSQL para el replay', async () => {
		const fixture = await crearFixture();
		const ajuste = await prisma.ajusteInventario.create({ data: {
			tenantId: fixture.tenantId, productoId: 'producto-prueba', tipoUbicacion: 'ALMACEN',
			ubicacionId: 'almacen-prueba', motivo: 'MERMA', cantidadTeorica: 5,
			cantidadContada: 4, diferencia: -1, costoUnitario: 25, costoTotal: -25,
			origenMermaId: 'merma-prueba', createdAt: new Date('2026-03-10T12:00:00.000Z'),
		} });
		const candidato = (await recolectarCandidatos(fixture.tenantId))
			.find((item) => item.origenTipo === 'ajuste_merma' && item.origenId === ajuste.id);
		expect(candidato).toMatchObject({ evento: { tipo: 'MERMA_INVENTARIO', monto: 25,
			moneda: 'CUP', montoFuncional: 25 } });
		expect(candidato?.causaOmision).toBeUndefined();
	});

	it('reconstruye un reverso de merma desde evidencia y aprobación independiente', async () => {
		const fixture = await crearFixture();
		const fechaOriginal = new Date('2026-03-10T12:00:00.000Z');
		const fechaReversion = new Date('2026-03-11T12:00:00.000Z');
		const ajuste = await prisma.ajusteInventario.create({ data: {
			tenantId: fixture.tenantId, productoId: 'producto-prueba', tipoUbicacion: 'ALMACEN',
			ubicacionId: 'almacen-prueba', motivo: 'MERMA', cantidadTeorica: 5,
			cantidadContada: 4, diferencia: -1, costoUnitario: 25, costoTotal: -25,
			origenMermaId: 'merma-replay-prueba', createdAt: fechaOriginal, estado: 'ANULADO',
			mermaReversionFecha: fechaReversion, mermaReversionRegistradaAt: fechaReversion,
		} });
		await prisma.periodoContable.update({ where: { periodoId: fixture.periodoId }, data: { estado: 'ABIERTO' } });
		await prisma.$transaction((tx) => emitirReconocimientoMerma(tx, {
			tenantId: fixture.tenantId, userId: fixture.requesterId,
		}, { ajusteInventarioId: ajuste.id, fecha: fechaOriginal, costoTotal: ajuste.costoTotal }));
		await prisma.periodoContable.update({ where: { periodoId: fixture.periodoId }, data: { estado: 'CERRADO' } });
		const preflight = await crearPreflightBackfill(fixture.tenantId, fixture.periodoId, fixture.requesterId);
		const approval = await aprobarPreflightBackfill(fixture.tenantId, preflight.replayPreflightId, fixture.approverId);
		const fechaAlterada = new Date('2026-03-12T12:00:00.000Z');
		await prisma.ajusteInventario.update({ where: { id: ajuste.id }, data: {
			mermaReversionFecha: fechaAlterada, mermaReversionRegistradaAt: fechaAlterada,
		} });
		await expect(ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId })).rejects.toThrow('Las fuentes cambiaron desde el preflight');
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId,
			origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id } })).toBe(0);
		await prisma.ajusteInventario.update({ where: { id: ajuste.id }, data: {
			mermaReversionFecha: fechaReversion, mermaReversionRegistradaAt: fechaReversion,
		} });
		const result = await ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId });
		expect(result).toMatchObject({ status: 'COMPLETED' });
		const reverso = await prisma.asiento.findUniqueOrThrow({ where: { tenantId_origenTipo_origenId: {
			tenantId: fixture.tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
		} }, include: { lineas: true } });
		expect(reverso.fecha).toEqual(fechaReversion);
		expect(reverso.lineas.reduce((sum, linea) => sum + Number(linea.debe), 0)).toBe(25);
		expect(reverso.lineas.reduce((sum, linea) => sum + Number(linea.haber), 0)).toBe(25);
	});

	it('reconcilia el reverso de merma USD sin duplicarlo ni perder la evidencia FX', async () => {
		const fixture = await crearFixture();
		const fechaOriginal = new Date('2026-03-10T12:00:00.000Z');
		const fechaReversion = new Date('2026-03-11T12:00:00.000Z');
		await prisma.moneda.upsert({
			where: { codigo: 'USD' },
			update: {},
			create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
		});
		const tasa = await prisma.tasaCambio.create({ data: {
			monedaOrigenId: 'CUP', monedaDestino: 'USD', tasa: 0.04,
			fechaVigencia: new Date('2026-03-01T00:00:00.000Z'),
		} });
		await prisma.tenantAccountingPolicy.update({
			where: { tenantId: fixture.tenantId }, data: { functionalCurrencyCode: 'USD' },
		});
		const ajuste = await prisma.ajusteInventario.create({ data: {
			tenantId: fixture.tenantId, productoId: 'producto-prueba', tipoUbicacion: 'ALMACEN',
			ubicacionId: 'almacen-prueba', motivo: 'MERMA', cantidadTeorica: 5,
			cantidadContada: 4, diferencia: -1, costoUnitario: 25, costoTotal: -25,
			origenMermaId: 'merma-replay-usd', createdAt: fechaOriginal,
		} });
		await prisma.periodoContable.update({
			where: { periodoId: fixture.periodoId }, data: { estado: 'ABIERTO' },
		});
		await prisma.$transaction(async (tx) => {
			await emitirReconocimientoMerma(tx, {
				tenantId: fixture.tenantId, userId: fixture.requesterId,
			}, { ajusteInventarioId: ajuste.id, fecha: fechaOriginal, costoTotal: ajuste.costoTotal });
			await tx.ajusteInventario.update({ where: { id: ajuste.id }, data: {
				estado: 'ANULADO', mermaReversionFecha: fechaReversion,
				mermaReversionRegistradaAt: fechaReversion,
			} });
			const reverso = await emitirReversionMermaSiContabilizada(tx, {
				tenantId: fixture.tenantId, userId: fixture.requesterId,
			}, { ajusteInventarioId: ajuste.id, fecha: fechaReversion,
				costoTotal: ajuste.costoTotal, fechaValoracionOriginal: fechaOriginal });
			expect(reverso?.estado).toBe('CONTABILIZADO');
		});
		await prisma.periodoContable.update({
			where: { periodoId: fixture.periodoId }, data: { estado: 'CERRADO' },
		});

		const evidencia = await prisma.fxEvidence.findFirstOrThrow({ where: {
			tenantId: fixture.tenantId, sourceType: 'ajuste_merma_reversado', sourceId: ajuste.id,
		} });
		const asientosAntes = await prisma.asiento.count({ where: {
			tenantId: fixture.tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
		} });
		const preflight = await crearPreflightBackfill(
			fixture.tenantId, fixture.periodoId, fixture.requesterId,
		);
		const approval = await aprobarPreflightBackfill(
			fixture.tenantId, preflight.replayPreflightId, fixture.approverId,
		);
		await prisma.ajusteInventario.update({ where: { id: ajuste.id }, data: {
			mermaReversionFecha: new Date('2026-03-12T12:00:00.000Z'),
		} });
		await expect(ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId })).rejects.toThrow('Las fuentes cambiaron desde el preflight');
		await prisma.ajusteInventario.update({ where: { id: ajuste.id }, data: {
			mermaReversionFecha: fechaReversion,
		} });

		const replay = await ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId });
		expect(replay).toMatchObject({ status: 'COMPLETED', omitidos: 0,
			reconciliation: { status: 'CONFORME' } });
		expect(await prisma.asiento.count({ where: {
			tenantId: fixture.tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
		} })).toBe(asientosAntes);
		const reverso = await prisma.asiento.findUniqueOrThrow({ where: { tenantId_origenTipo_origenId: {
			tenantId: fixture.tenantId, origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id,
		} }, include: { lineas: true } });
		expect(reverso.replayRunId).toBeNull();
		expect(reverso.lineas).toHaveLength(2);
		for (const linea of reverso.lineas) {
			expect(linea.monedaOriginal).toBe('CUP');
			expect(linea.montoOriginal.toString()).toBe('25');
			expect(linea.tasaCambio?.toString()).toBe('0.04');
			expect(linea.fxEvidenceFingerprint).toBe(evidencia.evidenceFingerprint);
		}
		expect(evidencia.originalCurrency).toBe('CUP');
		expect(evidencia.functionalCurrency).toBe('USD');
		expect(evidencia.exchangeRate.toString()).toBe('0.04');
		expect(evidencia.functionalAmount.toString()).toBe('1');
		expect(evidencia.rateEffectiveAt).toEqual(tasa.fechaVigencia);
		expect(evidencia.cutoffAt).toEqual(fechaOriginal);
		await prisma.tasaCambio.delete({ where: { tasaId: tasa.tasaId } });
	});

	it('no acredita un replay sin fuentes cuando existen asientos', async () => {
		const fixture = await crearFixture();
		await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
		await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: fixture.tenantId } });
		await prisma.factura.deleteMany({ where: { tenantId: fixture.tenantId } });
		const caja = await prisma.cuentaRolTenant.findUniqueOrThrow({
			where: { tenantId_rol: { tenantId: fixture.tenantId, rol: 'CAJA_PRINCIPAL' } },
		});
		const capital = await prisma.cuentaRolTenant.findUniqueOrThrow({
			where: { tenantId_rol: { tenantId: fixture.tenantId, rol: 'CAPITAL_SOCIAL' } },
		});
		const diario = await prisma.diario.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, tipo: 'APERTURA_CIERRE' },
		});
		await prisma.$transaction((tx) => insertarAsientoConNumeracion(
			tx, { tenantId: fixture.tenantId, userId: fixture.requesterId }, {
				diarioId: diario.diarioId, periodoId: fixture.periodoId,
				fecha: new Date('2026-03-02T12:00:00.000Z'), descripcion: 'Asiento fuera del replay',
				origenTipo: 'apertura_revision', origenId: randomUUID(), createdBy: fixture.requesterId,
				lineas: [
					{ orden: 1, cuentaId: caja.cuentaId, debe: new Prisma.Decimal(100), haber: new Prisma.Decimal(0),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
					{ orden: 2, cuentaId: capital.cuentaId, debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(100),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
				],
			},
		));
		expect((await planBackfillContable(fixture.tenantId)).totalEvaluados).toBe(0);
		const preflight = await crearPreflightBackfill(fixture.tenantId, fixture.periodoId, fixture.requesterId);
		const approval = await aprobarPreflightBackfill(fixture.tenantId, preflight.replayPreflightId, fixture.approverId);
		const replay = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId, replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId, actorId: fixture.approverId,
		});
		expect(replay.status).toBe('COMPLETED');
		expect(replay.reconciliation).toMatchObject({ status: 'CONFORME', expectedCount: 0, matchedCount: 0 });
		const params = { tenantId: fixture.tenantId, periodoId: fixture.periodoId };
		const reporte = await getFormalFinancialReport(params);
		expect(reporte).toMatchObject({ status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['REPLAY_SIN_FUENTES']) } });
		expect(reporte).not.toHaveProperty('accounts');
		await expect(crearCheckpointFormal(params)).rejects.toThrow('COVERAGE_NOT_CREDIFIED');
		expect(await prisma.checkpointContableFormal.count({ where: params })).toBe(0);
	});

	it('reconstruye un desembolso de deuda Cash con evidencia persistida', async () => {
		const fixture = await crearFixture();
		const fecha = new Date('2026-03-06T12:00:00.000Z');
		const proveedor = await prisma.vendor.create({ data: { tenantId: fixture.tenantId, nombre: 'Proveedor Cash' } });
		const cxp = await prisma.cuentaPorPagar.create({ data: {
			tenantId: fixture.tenantId, proveedorId: proveedor.vendorId, proveedorNombre: proveedor.nombre,
			numeroFactura: `DC-${fixture.tenantId}`, montoDeuda: 125, montoPagado: 0,
			saldoPendiente: 125, moneda: 'CUP', tipo: 'compra', tipoDeuda: 'DEUDA_CASH', estado: 'PENDIENTE',
		} });
		const deuda = await prisma.deudaCash.create({ data: {
			tenantId: fixture.tenantId, proveedorId: proveedor.vendorId, cuentaPorPagarId: cxp.cuentaPorPagarId,
			montoCapital: 125, moneda: 'CUP', observaciones: 'Descripción editada',
			cashInterestGrantDate: fecha, createdById: fixture.requesterId,
		} });
		const cuenta = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const tipoPago = await prisma.tipoPago.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const fx = buildAppliedFxEvidence({ originalAmount: 125, originalCurrency: 'CUP',
			functionalCurrency: 'CUP', source: 'cash-debt-obligation' });
		await prisma.reconciliacionVenta.create({ data: {
			tenantId: fixture.tenantId, cuentaId: cuenta.cuentaId, tipoPagoId: tipoPago.tipoId,
			deudaCashId: deuda.id, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', monto: 125, moneda: 'CUP',
			montoConvertido: 125, functionalCurrency: 'CUP', tasaCambio: 1, rateEffectiveAt: fecha,
			fxProvenanceKind: fx.fxProvenanceKind, fxProvenanceSource: fx.fxProvenanceSource,
			fxCatalogRateId: fx.fxCatalogRateId, fxEvidenceFingerprint: fx.fxEvidenceFingerprint,
			fxEvidenceVersion: fx.fxEvidenceVersion, fechaReconciliacion: fecha, reconciliadoPor: fixture.requesterId,
			observaciones: 'Deuda original',
		} });
		const plan = await planBackfillContable(fixture.tenantId);
		expect(plan.totalEvaluados).toBe(3);
		expect(plan.omitidos).toHaveLength(0);
		const preflight = await crearPreflightBackfill(fixture.tenantId, fixture.periodoId, fixture.requesterId);
		const approval = await aprobarPreflightBackfill(fixture.tenantId, preflight.replayPreflightId, fixture.approverId);
		const result = await ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId });
		expect(result).toMatchObject({ status: 'COMPLETED', contabilizados: 3,
			reconciliation: { status: 'CONFORME' } });
		const asiento = await prisma.asiento.findUniqueOrThrow({
			where: { tenantId_origenTipo_origenId: { tenantId: fixture.tenantId, origenTipo: 'deuda_cash', origenId: deuda.id } },
			include: { lineas: { orderBy: { orden: 'asc' }, include: { cuenta: true } } },
		});
		expect(asiento.descripcion).toBe('Deuda original');
		expect(asiento.lineas.map((linea) => [linea.cuenta.codigo, linea.debe.toString(), linea.haber.toString()]))
			.toEqual([['1.1.02', '125', '0'], ['2.1.02', '0', '125']]);
		expect((await getFormalFinancialReport({ tenantId: fixture.tenantId, periodoId: fixture.periodoId })).status)
			.toBe('AVAILABLE');
	});

	it('reconstruye un préstamo Cash vinculado con evidencia persistida', async () => {
		const fixture = await crearFixture();
		const fecha = new Date('2026-03-06T12:00:00.000Z');
		const cliente = await prisma.cliente.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const cxc = await prisma.cuentaPorCobrar.create({ data: {
			tenantId: fixture.tenantId, clienteId: cliente.clienteId, montoDeuda: 125,
			montoPagado: 0, tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
		} });
		const prestamo = await prisma.prestamoCash.create({ data: {
			tenantId: fixture.tenantId, clienteId: cliente.clienteId, cuentaPorCobrarId: cxc.id,
			montoCapital: 125, moneda: 'CUP', observaciones: 'Descripción editada',
			fechaOtorgamiento: fecha, cashInterestGrantDate: fecha, createdById: fixture.requesterId,
		} });
		const cuenta = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const tipoPago = await prisma.tipoPago.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const fx = buildAppliedFxEvidence({ originalAmount: 125, originalCurrency: 'CUP',
			functionalCurrency: 'CUP', source: 'cash-loan-obligation' });
		const clave = `PRESTAMO-${fixture.tenantId}`;
		await prisma.reconciliacionVenta.create({ data: {
			tenantId: fixture.tenantId, cuentaId: cuenta.cuentaId, tipoPagoId: tipoPago.tipoId,
			prestamoCashId: prestamo.id, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
			idempotencyKey: clave, monto: 125, moneda: 'CUP', montoConvertido: 125,
			functionalCurrency: 'CUP', tasaCambio: 1, rateEffectiveAt: fecha,
			fxProvenanceKind: fx.fxProvenanceKind, fxProvenanceSource: fx.fxProvenanceSource,
			fxCatalogRateId: fx.fxCatalogRateId, fxEvidenceFingerprint: fx.fxEvidenceFingerprint,
			fxEvidenceVersion: fx.fxEvidenceVersion, fechaReconciliacion: fecha,
			reconciliadoPor: fixture.requesterId, observaciones: 'Préstamo original',
		} });
		const plan = await planBackfillContable(fixture.tenantId);
		expect(plan.totalEvaluados).toBe(3);
		expect(plan.omitidos).toHaveLength(0);
		const preflight = await crearPreflightBackfill(fixture.tenantId, fixture.periodoId, fixture.requesterId);
		const approval = await aprobarPreflightBackfill(fixture.tenantId, preflight.replayPreflightId, fixture.approverId);
		const result = await ejecutarBackfillAutorizado({ tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId, replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId });
		expect(result).toMatchObject({ status: 'COMPLETED', contabilizados: 3,
			reconciliation: { status: 'CONFORME' } });
		const asiento = await prisma.asiento.findUniqueOrThrow({
			where: { tenantId_origenTipo_origenId: { tenantId: fixture.tenantId,
				origenTipo: 'prestamo_cash', origenId: prestamo.id } },
			include: { lineas: { orderBy: { orden: 'asc' }, include: { cuenta: true } } },
		});
		expect(asiento.descripcion).toBe('Préstamo original');
		expect(asiento.lineas.map((linea) => [linea.cuenta.codigo, linea.debe.toString(), linea.haber.toString()]))
			.toEqual([['1.2.02', '125', '0'], ['1.1.02', '0', '125']]);
		expect((await getFormalFinancialReport({ tenantId: fixture.tenantId, periodoId: fixture.periodoId })).status)
			.toBe('AVAILABLE');
	});

	it('exige una aprobación independiente y contabiliza el periodo aprobado', async () => {
		const fixture = await crearFixture();

		const plan = await planBackfillContable(fixture.tenantId);
		expect(plan.totalEvaluados).toBe(2);
		expect(plan.omitidos).toHaveLength(0);

		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		expect(preflight.digest).toHaveLength(64);

		await expect(
			aprobarPreflightBackfill(
				fixture.tenantId,
				preflight.replayPreflightId,
				fixture.requesterId,
			),
		).rejects.toThrow('La aprobación debe ser independiente');

		const approval = await aprobarPreflightBackfill(
			fixture.tenantId,
			preflight.replayPreflightId,
			fixture.approverId,
		);
		expect(approval.status).toBe('APPROVED');

		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.status).toBe('COMPLETED');
		expect(resultado.contabilizados).toBe(2);
		expect(resultado.reconciliation.status).toBe('CONFORME');

		const asientos = await prisma.asiento.findMany({
			where: { tenantId: fixture.tenantId },
			include: { lineas: true },
			orderBy: { numero: 'asc' },
		});
		expect(asientos).toHaveLength(2);
		expect(asientos.map((asiento) => asiento.origenTipo).sort()).toEqual([
			'factura',
			'reconciliacion_venta',
		]);
		for (const asiento of asientos) {
			expect(asiento.replayRunId).toBe(resultado.replayRunId);
			expect(asiento.periodoId).toBe(fixture.periodoId);
			const debe = asiento.lineas.reduce((total, linea) => total + Number(linea.debe), 0);
			const haber = asiento.lineas.reduce((total, linea) => total + Number(linea.haber), 0);
			expect(debe).toBe(haber);
			expect(debe).toBe(100);
		}

		const run = await prisma.replayRun.findUnique({
			where: { tenantId_replayRunId: {
				tenantId: fixture.tenantId,
				replayRunId: resultado.replayRunId,
			} },
		});
		expect(run?.status).toBe('COMPLETED');
		expect(run?.postedCount).toBe(2);
	});

	it('repone con backfill la fecha de devengo de las ventas legacy y las deja acreditables', async () => {
		const fixture = await crearFixture();
		const fechaCreacion = new Date('2026-02-20T12:00:00.000Z');
		// Venta legacy POS: creada y entregada en el acto, nunca modificada.
		const { ventaId: ventaLegacy } = await crearVentaConCostoFifo(fixture, {
			fechaCreacion,
			fechaDevengo: null,
			fechaActualizacion: fechaCreacion,
		});
		// Venta legacy PVE: creada antes y modificada al entregarse. Su fecha de
		// devengo real es desconocida y no se puede inventar.
		const { ventaId: ventaPveLegacy } = await crearVentaConCostoFifo(fixture, {
			fechaCreacion,
			fechaDevengo: null,
			fechaActualizacion: new Date('2026-03-05T09:30:00.000Z'),
		});

		const antesDelBackfill = await recolectarCandidatos(fixture.tenantId);
		expect(antesDelBackfill.find((item) =>
			item.origenTipo === 'venta_costo' && item.origenId === ventaLegacy)?.causaOmision,
		).toBe('FECHA_COSTO_FIFO_NO_PERSISTIDA');

		const resumen = await aplicarBackfillVentaCostoFecha(prisma as never, { simular: false });
		expect(resumen.repostas).toBeGreaterThanOrEqual(1);

		const ventaLegacyRepuesta = await prisma.venta.findUniqueOrThrow({
			where: { ventaId: ventaLegacy },
		});
		expect(ventaLegacyRepuesta.costoVentaFecha).toEqual(fechaCreacion);

		// La venta PVE legacy conserva la fecha desconocida: el replay la omite.
		const ventaPveSinBackfill = await prisma.venta.findUniqueOrThrow({
			where: { ventaId: ventaPveLegacy },
		});
		expect(ventaPveSinBackfill.costoVentaFecha).toBeNull();

		const despuesDelBackfill = await recolectarCandidatos(fixture.tenantId);
		const candidatoRepuesto = despuesDelBackfill.find((item) =>
			item.origenTipo === 'venta_costo' && item.origenId === ventaLegacy);
		expect(candidatoRepuesto?.causaOmision).toBeUndefined();
		expect(candidatoRepuesto?.evento.montoFuncional).toBe(50);
		expect(despuesDelBackfill.find((item) =>
			item.origenTipo === 'venta_costo' && item.origenId === ventaPveLegacy)?.causaOmision,
		).toBe('FECHA_COSTO_FIFO_NO_PERSISTIDA');
	});

	it('atribuye el costo FIFO de una venta PVE a la fecha de devengo persistida', async () => {
		const fixture = await crearFixture();
		const fechaCreacion = new Date('2026-02-20T12:00:00.000Z');
		const fechaDevengo = new Date('2026-03-05T09:30:00.000Z');
		const { ventaId } = await crearVentaConCostoFifo(fixture, {
			fechaCreacion,
			fechaDevengo,
		});

		const candidato = (await recolectarCandidatos(fixture.tenantId))
			.find((item) => item.origenTipo === 'venta_costo' && item.origenId === ventaId);

		// El devengo ocurre en la entrega, no en la creación del pedido: el
		// replay debe atribuir el costo al periodo de la fecha persistida.
		expect(candidato?.fecha).toEqual(fechaDevengo);
		expect(candidato?.evento).toMatchObject({
			tipo: 'COSTO_VENTA_DEVENGADO',
			fecha: fechaDevengo,
			monto: 50,
			moneda: 'CUP',
			montoFuncional: 50,
			monedaFuncional: 'CUP',
		});
		expect(candidato?.causaOmision).toBeUndefined();
	});

	it('omite el costo FIFO de una venta sin fecha de devengo persistida', async () => {
		const fixture = await crearFixture();
		const { ventaId } = await crearVentaConCostoFifo(fixture, {
			fechaCreacion: new Date('2026-02-20T12:00:00.000Z'),
			fechaDevengo: null,
		});

		const candidato = (await recolectarCandidatos(fixture.tenantId))
			.find((item) => item.origenTipo === 'venta_costo' && item.origenId === ventaId);

		// Sin fecha persistida no hay forma de atribuir el costo a un periodo:
		// la fuente queda fuera del libro en vez de imputarse por defecto.
		expect(candidato?.causaOmision).toBe('FECHA_COSTO_FIFO_NO_PERSISTIDA');
		expect(candidato?.evento.montoFuncional).toBeNull();
	});

	it('no reconstruye el costo FIFO de una venta con devolución sobre asignación legacy', async () => {
		const fixture = await crearFixture();
		const { ventaId } = await crearVentaConCostoFifo(fixture, {
			fechaCreacion: new Date('2026-02-20T12:00:00.000Z'),
			fechaDevengo: new Date('2026-03-05T09:30:00.000Z'),
			conDevolucion: true,
			asignacionLegacy: true,
		});

		const candidato = (await recolectarCandidatos(fixture.tenantId))
			.find((item) => item.origenTipo === 'venta_costo' && item.origenId === ventaId);

		// La devolución alteró las asignaciones: el replay no puede reconstruir
		// el costo original, ni siquiera desde una asignación legacy.
		expect(candidato?.causaOmision).toBe('DEVOLUCION_FIFO_NO_RECONSTRUIBLE');
		expect(candidato?.evento.montoFuncional).toBeNull();
	});

	it('reconstruye producción con fecha exacta mediante replay aprobado y conciliado', async () => {
		const fixture = await crearFixture();
		const fechaContabilizacion = new Date('2026-03-18T16:42:11.321Z');
		const recetaId = `receta-replay-${fixture.tenantId}`;
		const ordenId = `orden-replay-${fixture.tenantId}`;
		await prisma.receta.create({
			data: {
				recetaId,
				tenantId: fixture.tenantId,
				nombre: 'Producción histórica verificable',
				updatedAt: fechaContabilizacion,
			},
		});
		const ordenLegacyId = `orden-legacy-${fixture.tenantId}`;
		await prisma.ordenProduccion.create({
			data: {
				ordenProduccionId: ordenLegacyId,
				tenantId: fixture.tenantId,
				recetaId,
				cantidad: 1,
				estado: 'COMPLETADA',
				fechaProduccion: new Date('2026-03-18T12:00:00.000Z'),
				costoMateriales: 35,
				updatedAt: fechaContabilizacion,
			},
		});
		const reporteConFechaHistoricaDesconocida = await getFormalFinancialReport({
			tenantId: fixture.tenantId,
			periodoId: fixture.periodoId,
		});
		expect(reporteConFechaHistoricaDesconocida).toMatchObject({
			status: 'UNAVAILABLE',
			reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['FUENTES_NO_EVALUADAS']) },
		});
		expect(reporteConFechaHistoricaDesconocida).not.toHaveProperty('accounts');
		await prisma.ordenProduccion.delete({ where: { ordenProduccionId: ordenLegacyId } });
		await prisma.ordenProduccion.create({
			data: {
				ordenProduccionId: ordenId,
				tenantId: fixture.tenantId,
				recetaId,
				cantidad: 1,
				estado: 'COMPLETADA',
				fechaProduccion: new Date('2026-03-01T00:00:00.000Z'),
				fechaContabilizacion,
				costoMateriales: 35,
				updatedAt: fechaContabilizacion,
			},
		});

		const candidato = (await recolectarCandidatos(fixture.tenantId)).find(
			(item) => item.origenTipo === 'orden_produccion' && item.origenId === ordenId,
		);
		expect(candidato).toMatchObject({
			fecha: fechaContabilizacion,
			evento: { tipo: 'PRODUCCION_SALIDA', monto: 35, moneda: 'CUP', montoFuncional: 35 },
		});
		expect(candidato?.causaOmision).toBeUndefined();

		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const snapshot = preflight.snapshot as {
			manifest: {
				version: string;
				fingerprint: string;
				requiredEventTypes: string[];
				evaluatedEventTypes: string[];
				requiredQueryIds: string[];
				evaluatedQueryIds: string[];
			};
			sources: Array<{
				identity: { sourceType: string; sourceId: string };
				semantics: { fecha: string };
			}>;
		};
		expect(snapshot.manifest).toMatchObject({
			version: 'formal-replay-sources-v1',
			fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
		});
		expect(snapshot.manifest.evaluatedEventTypes).toEqual(snapshot.manifest.requiredEventTypes);
		expect(snapshot.manifest.evaluatedQueryIds).toEqual(snapshot.manifest.requiredQueryIds);
		expect(snapshot.manifest.evaluatedQueryIds).toContain('ordenProduccion');
		expect(snapshot.manifest.requiredEventTypes).toContain('PRODUCCION_SALIDA');
		expect(snapshot.sources).toEqual(expect.arrayContaining([
			expect.objectContaining({
				identity: { sourceType: 'orden_produccion', sourceId: ordenId },
				semantics: expect.objectContaining({ fecha: fechaContabilizacion.toISOString() }),
			}),
		]));
		const approval = await aprobarPreflightBackfill(
			fixture.tenantId,
			preflight.replayPreflightId,
			fixture.approverId,
		);
		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.status).toBe('COMPLETED');
		expect(resultado.contabilizados).toBe(3);
		expect(resultado.reconciliation.status).toBe('CONFORME');
		const asientoProduccion = await prisma.asiento.findUniqueOrThrow({
			where: {
				tenantId_origenTipo_origenId: {
					tenantId: fixture.tenantId,
					origenTipo: 'orden_produccion',
					origenId: ordenId,
				},
			},
			include: { lineas: true },
		});
		expect(asientoProduccion.fecha).toEqual(fechaContabilizacion);
		expect(asientoProduccion.replayRunId).toBe(resultado.replayRunId);
		expect(asientoProduccion.periodoId).toBe(fixture.periodoId);
		expect(asientoProduccion.lineas.reduce((sum, linea) => sum + Number(linea.debe), 0)).toBe(35);
		expect(asientoProduccion.lineas.reduce((sum, linea) => sum + Number(linea.haber), 0)).toBe(35);

		const reporte = await getFormalFinancialReport({
			tenantId: fixture.tenantId,
			periodoId: fixture.periodoId,
		});
		expect(reporte.status).toBe('AVAILABLE');
		await prisma.replayPreflight.update({
			where: { tenantId_replayPreflightId: {
				tenantId: fixture.tenantId,
				replayPreflightId: preflight.replayPreflightId,
			} },
			data: { snapshot: {
				...snapshot,
				manifest: {
					...snapshot.manifest,
					evaluatedQueryIds: snapshot.manifest.evaluatedQueryIds.filter(
						(queryId) => queryId !== 'ordenProduccion',
					),
				},
			} },
		});
		const reporteConManifiestoIncompleto = await getFormalFinancialReport({
			tenantId: fixture.tenantId,
			periodoId: fixture.periodoId,
		});
		expect(reporteConManifiestoIncompleto).toMatchObject({
			status: 'UNAVAILABLE',
			reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['MANIFIESTO_INCOMPLETO']) },
		});
		expect(reporteConManifiestoIncompleto).not.toHaveProperty('accounts');
	});

	it('no duplica los asientos cuando se repite el replay con un preflight nuevo', async () => {
		const fixture = await crearFixture();

		const primerPreflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const primeraAprobacion = await aprobarPreflightBackfill(
			fixture.tenantId,
			primerPreflight.replayPreflightId,
			fixture.approverId,
		);
		await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: primerPreflight.replayPreflightId,
			replayApprovalId: primeraAprobacion.replayApprovalId,
			actorId: fixture.approverId,
		});

		const segundoPreflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const segundaAprobacion = await aprobarPreflightBackfill(
			fixture.tenantId,
			segundoPreflight.replayPreflightId,
			fixture.approverId,
		);
		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: segundoPreflight.replayPreflightId,
			replayApprovalId: segundaAprobacion.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.contabilizados).toBe(0);
		expect(resultado.yaPosteados).toBe(2);
		const asientos = await prisma.asiento.findMany({
			where: { tenantId: fixture.tenantId },
		});
		expect(asientos).toHaveLength(2);
	});

	it('integra apertura manual, cierre formal y replay idempotente en el mismo período', async () => {
		const fixture = await crearFixture();
		await prisma.periodoContable.delete({ where: { periodoId: fixture.periodoId } });
		fixture.periodoId = '';

		const user: AuthenticatedUser = {
			userId: fixture.requesterId,
			name: 'T5 integración',
			email: `t5-${fixture.requesterId}@replay.test`,
			role: 'regularUser',
			isActive: true,
			tenantId: fixture.tenantId,
			tenantRole: 'manager',
			planFeatures: { contabilidad: true, 'contabilidad-formal': true },
			permissions: new Set([
				'financiero.apertura.aprobar',
				'financiero.contabilidad.acceder',
			]),
		};
		auth.user = user;
		vi.mocked(getCurrentUser).mockImplementation(async () => user);
		const actions = await import('@/features/contabilidad/actions-periodos');
		const automaticOpening = await actions.abrirPeriodoAction({
			tipo: 'MENSUAL' as never,
			fechaInicio: FECHA_INICIO.toISOString(),
			fechaFin: FECHA_FIN.toISOString(),
		});
		expect(automaticOpening).toMatchObject({
			success: false,
			error: { code: 'APERTURA_SALDOS_NO_VERIFICABLES' },
		});
		expect(await prisma.periodoContable.count({ where: { tenantId: fixture.tenantId } })).toBe(0);

		const request = await actions.solicitarAperturaManualAction({
			idempotencyKey: `t5-${fixture.tenantId}`,
			tipo: 'MENSUAL' as never,
			fechaInicio: FECHA_INICIO.toISOString(),
			fechaFin: FECHA_FIN.toISOString(),
			lineas: [
				{ cuentaCodigo: '1.1.01', moneda: 'CUP', debito: '10', credito: '0' },
				{ cuentaCodigo: '3.1', moneda: 'CUP', debito: '0', credito: '10' },
			],
		});
		expect(request.success, JSON.stringify(request)).toBe(true);
		if (!request.success) throw new Error(request.error.message);
		const approved = await actions.aprobarAperturaManualAction({
			solicitudId: request.data.solicitudId,
		});
		expect(approved.success, JSON.stringify(approved)).toBe(true);
		if (!approved.success) throw new Error(approved.error.message);
		const opened = await actions.abrirPeriodoManualAprobadoAction({
			solicitudId: request.data.solicitudId,
		});
		expect(opened.success, JSON.stringify(opened)).toBe(true);
		if (!opened.success) throw new Error(opened.error.message);
		fixture.periodoId = opened.data.periodo.periodoId;

		const sources = (await recolectarCandidatos(fixture.tenantId))
			.filter((candidate) => !candidate.causaOmision &&
				candidate.fecha >= FECHA_INICIO && candidate.fecha <= FECHA_FIN);
		expect(sources.map(({ origenTipo }) => origenTipo).sort()).toEqual([
			'factura',
			'reconciliacion_venta',
		]);
		for (const source of sources) {
			const posted = await prisma.$transaction((tx) => postEvento(
				tx,
				{ tenantId: fixture.tenantId, userId: fixture.requesterId },
				source.evento,
				{ modo: 'enforce' },
			));
			expect(posted.estado).toBe('CONTABILIZADO');
		}

		const closed = await actions.cerrarPeriodoAction({ periodoId: fixture.periodoId });
		expect(closed.success, JSON.stringify(closed)).toBe(true);
		if (!closed.success) throw new Error(closed.error.message);
		expect(closed.data.periodo.estado).toBe('APROBADO');

		const opening = await prisma.asiento.findUniqueOrThrow({
			where: { tenantId_origenTipo_origenId: {
				tenantId: fixture.tenantId,
				origenTipo: 'apertura_manual',
				origenId: request.data.solicitudId,
			} },
			include: { lineas: true },
		});
		const closing = await prisma.asiento.findUniqueOrThrow({
			where: { tenantId_origenTipo_origenId: {
				tenantId: fixture.tenantId,
				origenTipo: 'cierre_periodo',
				origenId: fixture.periodoId,
			} },
			include: { lineas: true },
		});
		expect(opening.periodoId).toBe(fixture.periodoId);
		expect(opening.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(10);
		expect(opening.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(10);
		expect(closing.periodoId).toBe(fixture.periodoId);
		expect(closing.lineas.length).toBeGreaterThanOrEqual(2);
		expect(closing.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(100);
		expect(closing.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(100);

		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const approval = await aprobarPreflightBackfill(
			fixture.tenantId,
			preflight.replayPreflightId,
			fixture.approverId,
		);
		const journalCountBeforeFailedReplay = await prisma.asiento.count({
			where: { tenantId: fixture.tenantId },
		});
		await prisma.factura.update({
			where: { idFactura: fixture.facturaId },
			data: { total: 101 },
		});
		await expect(ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		})).rejects.toThrow('Las fuentes cambiaron desde el preflight');
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } }))
			.toBe(journalCountBeforeFailedReplay);
		expect(await prisma.asiento.count({ where: {
			tenantId: fixture.tenantId,
			origenTipo: { in: ['apertura_manual', 'cierre_periodo'] },
		} })).toBe(2);
		await prisma.factura.update({
			where: { idFactura: fixture.facturaId },
			data: { total: 100 },
		});

		const replay = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});
		expect(replay).toMatchObject({
			status: 'COMPLETED',
			contabilizados: 0,
			yaPosteados: 2,
			reconciliation: { status: 'CONFORME', expectedCount: 2, matchedCount: 2 },
		});
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } }))
			.toBe(journalCountBeforeFailedReplay);
		expect(await prisma.asiento.count({
			where: {
				tenantId: fixture.tenantId,
				origenTipo: { in: ['apertura_manual', 'cierre_periodo'] },
			},
		})).toBe(2);

		const replayRetryPreflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const replayRetryApproval = await aprobarPreflightBackfill(
			fixture.tenantId,
			replayRetryPreflight.replayPreflightId,
			fixture.approverId,
		);
		const replayRetry = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: replayRetryPreflight.replayPreflightId,
			replayApprovalId: replayRetryApproval.replayApprovalId,
			actorId: fixture.approverId,
		});
		expect(replayRetry).toMatchObject({
			status: 'COMPLETED',
			contabilizados: 0,
			yaPosteados: 2,
			reconciliation: { status: 'CONFORME', expectedCount: 2, matchedCount: 2 },
		});
		expect(await prisma.asiento.count({ where: { tenantId: fixture.tenantId } }))
			.toBe(journalCountBeforeFailedReplay);
	});

	/**
	 * @description Agrega fuentes operativas que no son ventas de productos: el
	 * pago de un gasto, una compra a plazo y una venta de servicios.
	 * @param {Fixture} fixture - Fixture del tenant aislado.
	 * @returns {Promise<void>} Resuelve cuando las fuentes quedaron persistidas.
	 */
	async function agregarFuentesNoVentas(fixture: Fixture): Promise<void> {
		const cuentaBancaria = await prisma.cuentaBancaria.findFirstOrThrow({
			where: { tenantId: fixture.tenantId },
		});
			const cuentaDestino = await prisma.cuentaBancaria.create({
				data: {
					tenantId: fixture.tenantId,
					nombreBanco: 'Banco destino replay',
					numeroCuenta: `DST-${fixture.tenantId.slice(-8)}`,
					tipoCuenta: 'EFECTIVO',
					saldo: 100,
					moneda: 'CUP',
				},
			});
			await prisma.transferenciaBancaria.create({
				data: {
					tenantId: fixture.tenantId,
					numeroComprobante: `TRF-${fixture.tenantId.slice(-8)}`,
					cuentaOrigenId: cuentaBancaria.cuentaId,
					cuentaDestinoId: cuentaDestino.cuentaId,
					montoOrigen: 30,
					monedaOrigen: 'CUP',
					montoDestino: 30,
					monedaDestino: 'CUP',
					motivo: 'Transferencia de replay',
					fechaTransferencia: new Date('2026-03-19T12:00:00.000Z'),
				},
			});
		const tipoPago = await prisma.tipoPago.findFirstOrThrow({
			where: { tenantId: fixture.tenantId },
		});
		await prisma.reconciliacionGasto.create({
			data: {
				tenantId: fixture.tenantId,
				tipoGasto: 'gastoDE',
				referenciaId: 'gasto-replay-1',
				cuentaId: cuentaBancaria.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				monto: 40,
				moneda: 'CUP',
				montoConvertido: 40,
				functionalCurrency: 'CUP',
				fechaReconciliacion: new Date('2026-03-16T12:00:00.000Z'),
				descripcion: 'Pago de gasto replay',
				estado: 'PAGADA',
				reconciliadoPor: fixture.requesterId,
			},
		});
		const proveedor = await prisma.vendor.create({
			data: { tenantId: fixture.tenantId, nombre: `Proveedor replay ${fixture.tenantId}` },
		});
		await prisma.compraDocumento.create({
			data: {
				tenantId: fixture.tenantId,
				proveedorId: proveedor.vendorId,
				numeroFactura: 'RP-COMP-0001',
				formaPago: 'PAGO_PARCIAL',
				moneda: 'CUP',
				estado: 'RECIBIDA',
				total: 60,
				fechaCompra: new Date('2026-03-07T12:00:00.000Z'),
			},
		});
		const servicio = await prisma.servicios.create({
			data: {
				tenantId: fixture.tenantId,
				nombre: `Servicio replay ${fixture.tenantId}`,
				precio: 25,
				descripcion: 'Servicio de prueba',
				moneda: 'CUP',
			},
		});
		await prisma.ventaServicios.create({
			data: {
				tenantId: fixture.tenantId,
				servicioId: servicio.servicioId,
				cantidad: 1,
				total: 25,
				moneda: 'CUP',
				createdAt: new Date('2026-03-08T12:00:00.000Z'),
			},
		});
		const ventaServicioCobrado = await prisma.ventaServicios.create({
			data: {
				tenantId: fixture.tenantId,
				servicioId: servicio.servicioId,
				cantidad: 1,
				total: 35,
				moneda: 'CUP',
				createdAt: new Date('2026-03-12T12:00:00.000Z'),
			},
		});
		const reconciliacionServicio = await prisma.reconciliacionServicio.create({
			data: {
				tenantId: fixture.tenantId,
				ventaServicioId: ventaServicioCobrado.ventaServicioId,
				cuentaId: cuentaBancaria.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				monto: 35,
				moneda: 'CUP',
				montoConvertido: 35,
				functionalCurrency: 'CUP',
				fechaReconciliacion: new Date('2026-03-18T12:00:00.000Z'),
				reconciliadoPor: fixture.requesterId,
			},
		});
		const cliente = await prisma.cliente.findFirstOrThrow({
			where: { tenantId: fixture.tenantId },
		});
		const anticipo = await prisma.anticipo.create({
			data: {
				tenantId: fixture.tenantId,
				tipo: 'COBRO',
				clienteId: cliente.clienteId,
				montoOriginal: 45,
				montoFinanciado: 45,
				saldoDisponible: 45,
				moneda: 'CUP',
				createdById: fixture.requesterId,
			},
		});
		await prisma.anticipoMovimiento.create({
			data: {
				anticipoId: anticipo.anticipoId,
				tipoMovimiento: 'RECEPCION',
				cuentaId: cuentaBancaria.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				monto: 45,
				moneda: 'CUP',
				montoFuncional: 45,
				functionalCurrency: 'CUP',
				saldoAntes: 0,
				saldoDespues: 45,
				usuarioId: fixture.requesterId,
				createdAt: new Date('2026-03-09T12:00:00.000Z'),
			},
		});
	}

		it('reconoce gastos, compras, servicios y transferencias bancarias verificables', async () => {
		const fixture = await crearFixture();
		await agregarFuentesNoVentas(fixture);

		const params = { tenantId: fixture.tenantId, periodoId: fixture.periodoId };
		const sinCobertura = await getFormalFinancialReport(params);
		expect(sinCobertura).toMatchObject({ status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED' });
		expect(sinCobertura).not.toHaveProperty('accounts');
		await expect(crearCheckpointFormal(params)).rejects.toThrow('COVERAGE_NOT_CREDIFIED');
		expect(await prisma.checkpointContableFormal.count({ where: params })).toBe(0);

		const plan = await planBackfillContable(fixture.tenantId);
			expect(plan.totalEvaluados).toBe(9);
		expect(plan.omitidos).toHaveLength(0);

		const preflight = await crearPreflightBackfill(
			fixture.tenantId,
			fixture.periodoId,
			fixture.requesterId,
		);
		const approval = await aprobarPreflightBackfill(
			fixture.tenantId,
			preflight.replayPreflightId,
			fixture.approverId,
		);
		const resultado = await ejecutarBackfillAutorizado({
			tenantId: fixture.tenantId,
			replayPreflightId: preflight.replayPreflightId,
			replayApprovalId: approval.replayApprovalId,
			actorId: fixture.approverId,
		});

		expect(resultado.status).toBe('COMPLETED');
			expect(resultado.contabilizados).toBe(9);
		expect(resultado.reconciliation.status).toBe('CONFORME');
		expect(await prisma.asiento.count({
			where: {
				tenantId: fixture.tenantId,
				origenTipo: 'reconciliacion_servicio',
			},
		})).toBe(1);
			expect(await prisma.asiento.count({
				where: { tenantId: fixture.tenantId, origenTipo: 'transferencia_bancaria' },
			})).toBe(1);

		const periodoAnterior = await prisma.periodoContable.create({ data: {
			tenantId: fixture.tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
			codigo: `PRE-${fixture.tenantId.slice(-8)}`,
			fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
			fechaFin: new Date('2026-02-28T23:59:59.999Z'),
		} });
		const caja = await prisma.cuentaRolTenant.findUniqueOrThrow({
			where: { tenantId_rol: { tenantId: fixture.tenantId, rol: 'CAJA_PRINCIPAL' } },
		});
		const capital = await prisma.cuentaRolTenant.findUniqueOrThrow({
			where: { tenantId_rol: { tenantId: fixture.tenantId, rol: 'CAPITAL_SOCIAL' } },
		});
		const diario = await prisma.diario.findFirstOrThrow({
			where: { tenantId: fixture.tenantId, tipo: 'APERTURA_CIERRE' },
		});
		const asientoAnterior = await prisma.$transaction((tx) => insertarAsientoConNumeracion(
			tx, { tenantId: fixture.tenantId, userId: fixture.requesterId }, {
				diarioId: diario.diarioId, periodoId: periodoAnterior.periodoId,
				fecha: new Date('2026-02-10T12:00:00.000Z'), descripcion: 'Saldo anterior',
				origenTipo: 'apertura_revision', origenId: randomUUID(), createdBy: fixture.requesterId,
				lineas: [
					{ orden: 1, cuentaId: caja.cuentaId, debe: new Prisma.Decimal(100), haber: new Prisma.Decimal(0),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
					{ orden: 2, cuentaId: capital.cuentaId, debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(100),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
				],
			},
		));
		const reporteSinCoberturaAnterior = await getFormalFinancialReport(params);
		expect(reporteSinCoberturaAnterior).toMatchObject({
			status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { periodoId: periodoAnterior.periodoId, motivos: expect.arrayContaining(['REPLAY_AUSENTE']) },
		});
		await prisma.asiento.delete({ where: { asientoId: asientoAnterior.asientoId } });
		await prisma.periodoContable.delete({ where: { periodoId: periodoAnterior.periodoId } });

		const asientoAjeno = await prisma.$transaction((tx) => insertarAsientoConNumeracion(
			tx, { tenantId: fixture.tenantId, userId: fixture.requesterId }, {
				diarioId: diario.diarioId, periodoId: fixture.periodoId,
				fecha: new Date('2026-03-02T12:00:00.000Z'), descripcion: 'Fuera del snapshot',
				origenTipo: 'apertura_revision', origenId: randomUUID(), createdBy: fixture.requesterId,
				lineas: [
					{ orden: 1, cuentaId: caja.cuentaId, debe: new Prisma.Decimal(100), haber: new Prisma.Decimal(0),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
					{ orden: 2, cuentaId: capital.cuentaId, debe: new Prisma.Decimal(0), haber: new Prisma.Decimal(100),
						monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal(100), tasaCambio: null,
						fxEvidenceFingerprint: null, referencia: null },
				],
			},
		));
		const reporteIncompleto = await getFormalFinancialReport(params);
		expect(reporteIncompleto).toMatchObject({
			status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['ASIENTOS_NO_ACREDITADOS']) },
		});
		expect(reporteIncompleto).not.toHaveProperty('accounts');
		await expect(crearCheckpointFormal(params)).rejects.toThrow('COVERAGE_NOT_CREDIFIED');
		expect(await prisma.checkpointContableFormal.count({ where: params })).toBe(0);
		await prisma.asiento.delete({ where: { asientoId: asientoAjeno.asientoId } });

		const proveedor = await prisma.vendor.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		const compraNueva = await prisma.compraDocumento.create({ data: {
			tenantId: fixture.tenantId, proveedorId: proveedor.vendorId, numeroFactura: 'RP-POSTERIOR',
			formaPago: 'PAGO_PARCIAL', moneda: 'CUP', estado: 'RECIBIDA', total: 5,
			fechaCompra: new Date('2026-03-20T12:00:00.000Z'),
		} });
		const reporteConFuenteNueva = await getFormalFinancialReport(params);
		expect(reporteConFuenteNueva).toMatchObject({
			status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['FUENTES_CAMBIARON']) },
		});
		expect(reporteConFuenteNueva).not.toHaveProperty('accounts');
		await expect(crearCheckpointFormal(params)).rejects.toThrow('COVERAGE_NOT_CREDIFIED');
		await prisma.compraDocumento.delete({ where: { compraDocumentoId: compraNueva.compraDocumentoId } });
		const facturaOriginal = await prisma.factura.findUniqueOrThrow({
			where: { idFactura: fixture.facturaId }, select: { total: true },
		});
		await prisma.factura.update({ where: { idFactura: fixture.facturaId }, data: { total: 101 } });
		const reporteConFuenteModificada = await getFormalFinancialReport(params);
		expect(reporteConFuenteModificada).toMatchObject({ status: 'UNAVAILABLE',
			coverage: { motivos: expect.arrayContaining(['FUENTES_CAMBIARON']) } });
		await prisma.factura.update({
			where: { idFactura: fixture.facturaId }, data: { total: facturaOriginal.total },
		});

		const report = await getFormalFinancialReport(params);
		expect(report.status).toBe('AVAILABLE');
		if (report.status !== 'AVAILABLE') throw new Error('El reporte no está disponible');
		expect(report.accounts.length).toBeGreaterThan(0);
		expect(report.coverage.estado).toBe('CUBIERTA');
		expect(await getFormalFinancialReport({ tenantId: 'tenant-ajeno', periodoId: fixture.periodoId }))
			.toMatchObject({ status: 'UNAVAILABLE', reason: 'PERIODO_NO_ENCONTRADO' });
		const checkpoint = await crearCheckpointFormal(params);
		expect(checkpoint.replayRunId).toBe(report.coverage.replayRunId);
		const lecturaParams = { ...params, checkpointId: checkpoint.checkpointId };
		expect(await leerCheckpointFormal({ ...lecturaParams, tenantId: 'tenant-ajeno' }))
			.toEqual({ status: 'NO_ENCONTRADO' });
		const lectura = await leerCheckpointFormal(lecturaParams);
		expect(lectura.status).toBe('VERIFICADO');
		if (lectura.status !== 'VERIFICADO') throw new Error('El checkpoint no fue verificado');
		expect(lectura.payload.accounts).toEqual(report.accounts);
		expect(lectura.payload.result).toEqual(report.result);
		await prisma.checkpointContableFormal.update({
			where: { checkpointId: checkpoint.checkpointId }, data: { payload: { altered: true } },
		});
		expect(await leerCheckpointFormal(lecturaParams))
			.toMatchObject({ status: 'NO_VERIFICADO', motivo: 'PAYLOAD_ALTERADO' });

		const checkpointLedger = await crearCheckpointFormal(params);
		const asiento = await prisma.asiento.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
		await prisma.asiento.update({ where: { asientoId: asiento.asientoId }, data: { hash: 'alterado' } });
		expect(await leerCheckpointFormal({ ...params, checkpointId: checkpointLedger.checkpointId }))
			.toMatchObject({ status: 'NO_VERIFICADO', motivo: 'LEDGER_ALTERADO' });

		const origenes = await prisma.asiento.findMany({
			where: { tenantId: fixture.tenantId },
			select: { origenTipo: true },
		});
		expect(origenes.map((asiento) => asiento.origenTipo).sort()).toEqual([
			'anticipo_movimiento',
			'compra_documento',
			'factura',
			'reconciliacion_gasto',
			'reconciliacion_servicio',
			'reconciliacion_venta',
			'transferencia_bancaria',
			'venta_servicio',
			'venta_servicio',
		]);
	});
});
