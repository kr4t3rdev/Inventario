/**
 * @description Exercises the real cash-sale writer against disposable PostgreSQL and verifies
 * that shadow posting failures are durably recorded without partial formal accounting writes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { deletePagoSalarioAction } from '@/features/pago-salario/actions';
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';
import { VentaLifecycleService } from '@/features/ventas/services/venta-lifecycle-service';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';

assertDisposableDatabase(process.env);

const { authState } = vi.hoisted(() => ({ authState: { user: null as unknown } }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: () => Promise.resolve(authState.user),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const stamp = crypto.randomUUID();
let prisma!: typeof import('@/lib/prisma').prisma;
let seedPlanContable!: typeof import('@/features/contabilidad-formal/services/seed-plan-contable').seedPlanContable;
let seedPlantillasGlobales!: typeof import('@/features/contabilidad-formal/services/seed-plan-contable').seedPlantillasGlobales;
let createVentaAction!: typeof import('@/features/ventas/actions').createVentaAction;
let tenantId = '';
let productId = '';
let pvId = '';
let customerId = '';
let cuentaId = '';
let turnoId = '';
let triggerName = '';
let functionName = '';
let triggerTable = '';
const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
const actorId = `cash-sale-user-${stamp}`;

const user = () => ({
	userId: actorId,
	role: 'user',
	tenantId,
	tenantRole: 'manager',
	isActive: true,
	planFeatures: {
		'ventas-pos': true,
		'ventas-factura': true,
		facturacion: true,
			'contabilidad-formal': true,
			empleados: true,
	},
	permissions: new Set([
		'ventas.venta.registrar', 'ventas.venta.anular', 'rrhh.salarios.eliminar',
		'ventas.precio.override',
	]),
}) as never;

/** @description Installs a narrowly scoped PostgreSQL trigger for deterministic writer failure. */
async function installTrigger(table: string, body: string, condition: string): Promise<void> {
	await removeTrigger();
	triggerName = `cash_sale_${crypto.randomUUID().replaceAll('-', '')}`;
	functionName = `${triggerName}_fn`;
	triggerTable = table;
	await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger
		LANGUAGE plpgsql AS $$ BEGIN ${body}; RETURN NEW; END $$`);
	await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON ${table}
		FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION "${functionName}"()`);
}

/** @description Removes only the test-owned PostgreSQL trigger and function. */
async function removeTrigger(): Promise<void> {
	const failures: unknown[] = [];
	if (triggerName) {
		try {
			await prisma.$executeRawUnsafe(
				`DROP TRIGGER IF EXISTS "${triggerName}" ON ${triggerTable}`,
			);
			triggerName = '';
			triggerTable = '';
		} catch (error) {
			failures.push(error);
		}
	}
	if (functionName) {
		try {
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
			functionName = '';
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length) {
		throw new AggregateError(failures, 'Failed to remove cash-sale fault-injection trigger objects');
	}
}

/** @description Creates an allocated foreign purchase lot without valuation evidence. */
async function crearCompraFifoSinFx(): Promise<void> {
	const proveedor = await prisma.vendor.create({
		data: { tenantId, nombre: `Proveedor sin FX ${crypto.randomUUID()}` },
	});
	const documento = await prisma.compraDocumento.create({
		data: {
			tenantId,
			proveedorId: proveedor.vendorId,
			formaPago: 'PAGO_COMPLETO',
			moneda: 'USD',
			functionalCurrency: 'CUP',
			estado: 'RECIBIDA',
			total: 600,
		},
	});
	await prisma.compraDocumentoItem.create({
		data: {
			tenantId,
			compraDocumentoId: documento.compraDocumentoId,
			productoId: productId,
			cantidad: 2,
			precioUnitario: 300,
			totalLinea: 600,
		},
	});
}

/** @description Creates a functional-currency FIFO lot for posting fault injection. */
async function crearCompraFifoCUP(): Promise<void> {
	const proveedor = await prisma.vendor.create({
		data: { tenantId, nombre: `Proveedor CUP ${crypto.randomUUID()}` },
	});
	const documento = await prisma.compraDocumento.create({
		data: {
			tenantId,
			proveedorId: proveedor.vendorId,
			formaPago: 'PAGO_COMPLETO',
			moneda: 'CUP',
			functionalCurrency: 'CUP',
			estado: 'RECIBIDA',
			total: 300,
		},
	});
	await prisma.compraDocumentoItem.create({
		data: {
			tenantId,
			compraDocumentoId: documento.compraDocumentoId,
			productoId: productId,
			cantidad: 1,
			precioUnitario: 300,
			totalLinea: 300,
		},
	});
}

describe('cash sale formal shadow — real PostgreSQL writer', { timeout: 90_000 }, () => {
	beforeAll(async () => {
		const [prismaModule, seedModule, actionsModule] = await Promise.all([
			import('@/lib/prisma'),
			import('@/features/contabilidad-formal/services/seed-plan-contable'),
			import('@/features/ventas/actions'),
		]);
		prisma = prismaModule.prisma;
		seedPlanContable = seedModule.seedPlanContable;
		seedPlantillasGlobales = seedModule.seedPlantillasGlobales;
		createVentaAction = actionsModule.createVentaAction;
		const target = new URL(process.env.DATABASE_URL ?? '');
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port`;
		expect(identity[0]).toMatchObject({ db: target.pathname.slice(1), port: Number(target.port) });
		process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		await prisma.moneda.upsert({
			where: { codigo: 'CUP' },
			create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
			update: {},
		});
		await prisma.moneda.upsert({
			where: { codigo: 'USD' },
			create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
			update: {},
		});
		const tenant = await prisma.tenant.create({ data: { nombre: stamp, slug: `cash-${stamp}` } });
		tenantId = tenant.tenantId;
		await prisma.user.create({
			data: {
				userId: actorId,
				name: `Cash sale ${stamp}`,
				email: `cash-sale-${stamp}@test.invalid`,
				password: 'integration-test-only',
			},
		});
		const plan = await prisma.plan.create({
			data: { nombre: `cash-${stamp}`, duracionDias: 30, features: {
				'contabilidad-formal': true, facturacion: true, 'ventas-pos': true, 'ventas-factura': true,
			} },
		});
		await prisma.tenantLicense.create({ data: {
			tenantId, planId: plan.planId, activa: true,
			expiracion: new Date(Date.now() + 86_400_000),
		} });
		await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
		await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
		await prisma.tenantAccountingPolicy.create({ data: {
			tenantId, functionalCurrencyCode: 'CUP', updatedBy: `cash-sale-user-${stamp}`,
		} });
		const now = new Date();
		await prisma.periodoContable.create({ data: {
			tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
			fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
			fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
		} });
		const [category, warehouse, pv, customer, account] = await Promise.all([
			prisma.categoria.create({ data: { tenantId, nombre: `Cat-${stamp}` } }),
			prisma.almacen.create({ data: { tenantId, nombre: `Alm-${stamp}` } }),
			prisma.puntoDeVenta.create({ data: { tenantId, nombre: `PV-${stamp}` } }),
			prisma.cliente.create({ data: { tenantId, nombre: `Cliente-${stamp}` } }),
			prisma.cuentaBancaria.create({ data: {
				tenantId, nombreBanco: 'Cash sale test', numeroCuenta: stamp,
				tipoCuenta: 'EFECTIVO', moneda: 'CUP', saldo: 0,
			} }),
		]);
		pvId = pv.pvId;
		customerId = customer.clienteId;
		cuentaId = account.cuentaId;
		const turno = await prisma.turnoPuntoVenta.create({
			data: { tenantId, puntoDeVentaId: pvId, estado: 'ABIERTO', tipo: 'NORMAL' },
		});
		turnoId = turno.id;
		const tipoPago = await prisma.tipoPago.create({ data: {
			tenantId, nombre: `Efectivo-${stamp}`, cuentaDefecto: cuentaId,
		} });
		void tipoPago;
		const producto = await prisma.producto.create({ data: {
			tenantId, nombre: `Producto-${stamp}`, precioCosto: 0, precioVenta: 1000, stock: 10,
			categoriaId: category.catId, almacenId: warehouse.almacenId,
		} });
		productId = producto.id;
		await prisma.stockUbicacion.create({ data: {
			tenantId, productoId: productId, tipoUbicacion: 'punto_venta', ubicacionId: pvId,
			cantidad: 10, cantidadDisponible: 10,
		} });
		authState.user = user();
	});

	afterAll(async () => {
		try {
			await removeTrigger();
		} finally {
			try {
				await prisma?.auditLog.deleteMany({ where: { usuarioId: actorId, entidad: 'VENTA' } });
			} finally {
				// Preserve the append-only tenant graph while cleaning this fixture's audit rows.
				if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
				else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
				await prisma?.$disconnect();
			}
		}
	});

	it('posts a balanced real VENTA_CONTADO in enforce with original tenant actor', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		try {
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId, clienteId: customerId,
				metodoPago: 'EFECTIVO', montoEfectivo: 1000,
				tipoVencimiento: 'contra_pago', cuentaBancariaId: cuentaId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result).toMatchObject({ success: true });

			const venta = await prisma.venta.findFirstOrThrow({
				where: { tenantId, clienteId: customerId }, orderBy: { createdAt: 'desc' },
			});
			const reconciliacion = await prisma.reconciliacionVenta.findFirstOrThrow({
				where: { tenantId, ventaId: venta.ventaId },
			});
			expect(reconciliacion.moneda).toBe('CUP');
			expect(reconciliacion.montoConvertido?.eq(new Prisma.Decimal('1000'))).toBe(true);
			expect(reconciliacion.tasaCambio?.eq(new Prisma.Decimal('1'))).toBe(true);
			expect(reconciliacion.fxEvidenceFingerprint).toBeTypeOf('string');
			const asiento = await prisma.asiento.findFirstOrThrow({
				where: {
					tenantId,
					origenTipo: 'reconciliacion_venta',
					origenId: reconciliacion.reconciliacionId,
				},
				include: { lineas: true },
			});
			expect(asiento.createdBy).toBe(actorId);
			expect(asiento.tenantId).toBe(tenantId);
			expect(asiento.lineas).toHaveLength(2);
			expect(asiento.lineas.every((linea) =>
				linea.monedaOriginal === 'CUP' &&
				linea.tasaCambio?.eq(new Prisma.Decimal('1')) &&
				linea.fxEvidenceFingerprint === reconciliacion.fxEvidenceFingerprint,
			)).toBe(true);
			const debe = asiento.lineas.reduce(
				(suma, linea) => suma.add(linea.debe),
				new Prisma.Decimal(0),
			);
			const haber = asiento.lineas.reduce(
				(suma, linea) => suma.add(linea.haber),
				new Prisma.Decimal(0),
			);
			expect(debe.eq(haber)).toBe(true);
			expect(await prisma.shadowPosteoOutbox.count({ where: { tenantId } })).toBe(0);
		} finally {
			process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		}
	});

	it('anular una venta revierte todos sus asientos formales sin borrar el historial', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		try {
			const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
				where: { cuentaId },
			})).saldo;
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId, clienteId: customerId,
				metodoPago: 'EFECTIVO', montoEfectivo: 1000,
				tipoVencimiento: 'contra_pago', cuentaBancariaId: cuentaId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result.success, result.success ? undefined : result.error.message).toBe(true);

			const venta = await prisma.venta.findFirstOrThrow({
				where: { tenantId, clienteId: customerId }, orderBy: { createdAt: 'desc' },
			});
			const factura = await prisma.factura.findFirstOrThrow({
				where: { tenantId, ventaId: venta.ventaId },
				select: { idFactura: true },
			});
			const reconciliaciones = await prisma.reconciliacionVenta.findMany({
				where: { tenantId, ventaId: venta.ventaId },
				select: { reconciliacionId: true },
			});
			const origenes = [
				{ origenTipo: 'factura', origenId: factura.idFactura },
				{ origenTipo: 'venta_costo', origenId: venta.ventaId },
				...reconciliaciones.map(({ reconciliacionId }) => ({
					origenTipo: 'reconciliacion_venta', origenId: reconciliacionId,
				})),
			].filter((origen) => origen.origenId.length > 0);
			const originales = await prisma.asiento.findMany({
				where: { tenantId, OR: origenes },
				include: { lineas: { orderBy: { orden: 'asc' } } },
			});
			expect(originales.length).toBeGreaterThan(0);
			const saldoDespuesDeVenta = (await prisma.cuentaBancaria.findUniqueOrThrow({
				where: { cuentaId },
			})).saldo;

			await VentaLifecycleService.anularVentaPorEstado({ ventaId: venta.ventaId, user: user() });

			for (const original of originales) {
				const anulado = await prisma.asiento.findUniqueOrThrow({
					where: { asientoId: original.asientoId },
				});
				expect(anulado.estado).toBe('ANULADO');
				expect(anulado.revertidoPorId).toBeTruthy();
				const reverso = await prisma.asiento.findUniqueOrThrow({
					where: { asientoId: anulado.revertidoPorId! },
					include: { lineas: { orderBy: { orden: 'asc' } } },
				});
				expect(reverso).toMatchObject({
					estado: 'CONTABILIZADO',
					origenTipo: 'REVERSO_ASIENTO',
					origenId: original.asientoId,
				});
				expect(reverso.lineas.map((linea) => [
					linea.cuentaId, linea.debe.toString(), linea.haber.toString(),
					linea.fxEvidenceFingerprint,
				])).toEqual(original.lineas.map((linea) => [
					linea.cuentaId, linea.haber.toString(), linea.debe.toString(),
					linea.fxEvidenceFingerprint,
				]));
			}
			expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
				.toBe(saldoAntes);
			expect(saldoDespuesDeVenta).toBe(saldoAntes + 1000);
			expect((await prisma.venta.findUniqueOrThrow({ where: { ventaId: venta.ventaId } })).estado)
				.toBe('ANULADA');
		} finally {
			process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		}
	});

	it('eliminar una nómina revierte los asientos PAGO_NOMINA junto con caja y reconciliación', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const payrollAccount = await prisma.cuentaBancaria.create({ data: {
			tenantId, nombreBanco: `Payroll ${stamp}`, numeroCuenta: `PAY-${stamp}`,
			tipoCuenta: 'EFECTIVO', moneda: 'CUP', saldo: 5000,
		} });
		const payrollTipoPago = await prisma.tipoPago.create({ data: {
			tenantId, nombre: `Payroll payment ${stamp}`, cuentaDefecto: payrollAccount.cuentaId,
		} });
		const empleado = await prisma.empleado.create({ data: {
			tenantId, nombre: 'Payroll', apellido: stamp.slice(0, 8), cargo: 'Operaciones',
			salarioBases: 1000, fechaContratacion: new Date('2025-01-01'),
		} });
		const pago = await prisma.pagosalario.create({ data: {
			tenantId, empleadoId: empleado.empleadoId, salario: 1000,
			periodo: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
		} });
		const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: payrollAccount.cuentaId },
		})).saldo;
		await prisma.$transaction((tx) => applyPagoGastoWorkflow(tx, {
			tipoGasto: 'salario', referenciaId: pago.pgId, pgId: pago.pgId,
			reconciliadoPor: actorId, descripcion: 'Pago de nómina para reversión formal',
			monto: 1000, moneda: 'CUP', tenantId, cuentaId: payrollAccount.cuentaId,
			tipoPagoId: payrollTipoPago.tipoId, fechaPago: new Date(),
		}));
		const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({ where: {
			tenantId, pgId: pago.pgId,
		} });
		const original = await prisma.asiento.findUniqueOrThrow({ where: {
			tenantId_origenTipo_origenId: {
				tenantId, origenTipo: 'reconciliacion_gasto',
				origenId: reconciliacion.reconciliacionId,
			},
		}, include: { lineas: { orderBy: { orden: 'asc' } } } });
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: payrollAccount.cuentaId },
		})).saldo).toBe(saldoInicial - 1000);

		const deleted = await deletePagoSalarioAction(pago.pgId);

		expect(deleted.success).toBe(true);
		const anulado = await prisma.asiento.findUniqueOrThrow({
			where: { asientoId: original.asientoId },
		});
		expect(anulado.estado).toBe('ANULADO');
		expect(anulado.revertidoPorId).toBeTruthy();
		const reverso = await prisma.asiento.findUniqueOrThrow({
			where: { asientoId: anulado.revertidoPorId! },
			include: { lineas: { orderBy: { orden: 'asc' } } },
		});
		expect(reverso).toMatchObject({
			origenTipo: 'REVERSO_ASIENTO', origenId: original.asientoId,
		});
		expect(reverso.lineas.map((linea) => [linea.cuentaId, linea.debe.toString(), linea.haber.toString()]))
			.toEqual(original.lineas.map((linea) => [
				linea.cuentaId, linea.haber.toString(), linea.debe.toString(),
			]));
		expect(await prisma.reconciliacionGasto.findUnique({
			where: { reconciliacionId: reconciliacion.reconciliacionId },
		})).toBeNull();
		expect(await prisma.pagosalario.findUnique({ where: { pgId: pago.pgId } })).toBeNull();
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: payrollAccount.cuentaId },
		})).saldo).toBe(saldoInicial);
	});

	it('posts COSTO_VENTA_DEVENGADO at the persisted functional purchase value', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const proveedor = await prisma.vendor.create({
			data: { tenantId, nombre: `Proveedor FX ${stamp}` },
		});
		const rateEffectiveAt = new Date('2026-09-30T00:00:00Z');
		const evidencia = buildAppliedFxEvidence({
			originalAmount: 300,
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: 24,
			convertedAmount: 7200,
			rateEffectiveAt,
			source: 'accounting-reconciliation-service',
		});
		const documento = await prisma.compraDocumento.create({
			data: {
				tenantId,
				proveedorId: proveedor.vendorId,
				formaPago: 'PAGO_COMPLETO',
				moneda: 'USD',
				tasaCambio: 24,
				montoConvertido: 7200,
				functionalCurrency: 'CUP',
				rateEffectiveAt,
				fxProvenanceKind: evidencia.fxProvenanceKind,
				fxProvenanceSource: evidencia.fxProvenanceSource,
				fxCatalogRateId: evidencia.fxCatalogRateId,
				fxEvidenceFingerprint: evidencia.fxEvidenceFingerprint,
				fxEvidenceVersion: evidencia.fxEvidenceVersion,
				estado: 'RECIBIDA',
				total: 300,
			},
		});
		await prisma.compraDocumentoItem.create({
			data: {
				tenantId,
				compraDocumentoId: documento.compraDocumentoId,
				productoId: productId,
				cantidad: 1,
				precioUnitario: 300,
				totalLinea: 300,
			},
		});

		const result = await createVentaAction({
			puntoDeVentaId: pvId, turnoId, clienteId: customerId,
			metodoPago: 'EFECTIVO', montoEfectivo: 1000,
			items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
		} as never);
		process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		expect(
			result.success,
			result.success ? undefined : `${result.error.code}: ${result.error.message}`,
		).toBe(true);

		const venta = await prisma.venta.findFirstOrThrow({
			where: { tenantId, clienteId: customerId }, orderBy: { createdAt: 'desc' },
		});
		const asiento = await prisma.asiento.findFirstOrThrow({
			where: { tenantId, origenTipo: 'venta_costo', origenId: venta.ventaId },
			include: { lineas: true },
		});
		const debe = asiento.lineas.reduce((suma, linea) => suma.add(linea.debe), new Prisma.Decimal(0));
		const haber = asiento.lineas.reduce((suma, linea) => suma.add(linea.haber), new Prisma.Decimal(0));
		expect(debe.eq(new Prisma.Decimal('7200'))).toBe(true);
		expect(haber.eq(new Prisma.Decimal('7200'))).toBe(true);
		expect(asiento.lineas.every((linea) => linea.monedaOriginal === 'CUP')).toBe(true);
	});

	// El rollback tras el INSERT de asiento COGS se cubre aparte abajo; este audit ocurre antes del FIFO.
	it('el AuditLog físico bloquea la venta antes del FIFO y del posteo COGS', async () => {
		const previous = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const input = {
			puntoDeVentaId: pvId, turnoId, clienteId: customerId,
			metodoPago: 'EFECTIVO', montoEfectivo: 1001,
			items: [{ productoId: productId, cantidad: 1, precioUnitario: 1001 }],
		} as never;
		try {
			await crearCompraFifoCUP();
			const happy = await VentaMutationService.create({ input, user: user() as never });
			const happyAudit = await prisma.auditLog.findFirstOrThrow({ where: {
				usuarioId: actorId, entidad: 'VENTA', entidadId: happy.ventaId, accion: 'EXECUTE',
			} });
			expect(happyAudit.detalles).toMatchObject({ tipo: 'PRICE_OVERRIDE' });
			const happyCogs = await prisma.asiento.findFirstOrThrow({
				where: { tenantId, origenTipo: 'venta_costo', origenId: happy.ventaId },
				include: { lineas: true },
			});
			expect(happyCogs.lineas.reduce((sum, line) => sum.add(line.debe), new Prisma.Decimal(0))
				.eq(new Prisma.Decimal(300))).toBe(true);

			await crearCompraFifoCUP();
			const before = {
				sales: await prisma.venta.count({ where: { tenantId } }),
				items: await prisma.ventaItem.count({ where: { venta: { tenantId } } }),
				product: await prisma.producto.findUniqueOrThrow({ where: { id: productId } }),
				stock: await prisma.stockUbicacion.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
				allocations: await prisma.purchaseAllocation.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
				kardex: await prisma.stockMoveLine.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
				account: await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }),
				reconciliations: await prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { reconciliacionId: 'asc' } }),
				entries: await prisma.asiento.findMany({ where: { tenantId }, orderBy: { asientoId: 'asc' }, include: { lineas: { orderBy: { lineaId: 'asc' } } } }),
				audit: await prisma.auditLog.findMany({ where: { usuarioId: actorId, entidad: 'VENTA' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
				cache: await prisma.periodoCache.findMany({ where: { tenantId }, orderBy: { cacheKey: 'asc' } }),
			};
			const suffix = crypto.randomUUID().replaceAll('-', '');
			const trigger = `cash_sale_audit_${suffix}`;
			const fn = `${trigger}_fn`;
			await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger
				LANGUAGE plpgsql AS $$ BEGIN
				IF NEW."usuarioId" = '${actorId}' AND NEW."entidad" = 'VENTA' AND NEW."accion" = 'EXECUTE' THEN
					IF NOT EXISTS (SELECT 1 FROM "Venta" WHERE "ventaId" = NEW."entidadId") THEN
						RAISE EXCEPTION 'sale row missing before AuditLog' USING ERRCODE = 'P0001';
					END IF;
					IF EXISTS (SELECT 1 FROM "venta_items" item
						JOIN "purchase_allocations" allocation ON allocation."ventaItemId" = item."id"
						WHERE item."ventaId" = NEW."entidadId") THEN
						RAISE EXCEPTION 'FIFO allocation unexpectedly preceded AuditLog' USING ERRCODE = 'P0001';
					END IF;
					RAISE EXCEPTION 'physical price override AuditLog rejected before FIFO' USING ERRCODE = '22012';
				END IF; RETURN NEW; END $$`);
			await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog"
				FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
			try {
				await expect(VentaMutationService.create({ input, user: user() as never }))
					.rejects.toThrow('physical price override AuditLog rejected before FIFO');
			} finally {
				await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
				await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
			}
			expect(await prisma.venta.count({ where: { tenantId } })).toBe(before.sales);
			expect(await prisma.ventaItem.count({ where: { venta: { tenantId } } })).toBe(before.items);
			expect(await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).toEqual(before.product);
			expect(await prisma.stockUbicacion.findMany({ where: { tenantId }, orderBy: { id: 'asc' } })).toEqual(before.stock);
			expect(await prisma.purchaseAllocation.findMany({ where: { tenantId }, orderBy: { id: 'asc' } })).toEqual(before.allocations);
			expect(await prisma.stockMoveLine.findMany({ where: { tenantId }, orderBy: { id: 'asc' } })).toEqual(before.kardex);
			expect(await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).toEqual(before.account);
			expect(await prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { reconciliacionId: 'asc' } })).toEqual(before.reconciliations);
			expect(await prisma.asiento.findMany({ where: { tenantId }, orderBy: { asientoId: 'asc' }, include: { lineas: { orderBy: { lineaId: 'asc' } } } })).toEqual(before.entries);
			expect(await prisma.auditLog.findMany({ where: { usuarioId: actorId, entidad: 'VENTA' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).toEqual(before.audit);
			expect(await prisma.periodoCache.findMany({ where: { tenantId }, orderBy: { cacheKey: 'asc' } })).toEqual(before.cache);
			// Consume the second fixture lot so later shadow tests retain their isolated missing-FX case.
			await VentaMutationService.create({ input, user: user() as never });
		} finally {
			if (previous === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previous;
		}
	});

	it('shadow preserves sale and records durable COGS valuation failure', async () => {
		await crearCompraFifoSinFx();
		const result = await createVentaAction({
			puntoDeVentaId: pvId, turnoId,
			items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
		} as never);
		expect(
			result.success,
			result.success ? undefined : `${result.error.code}: ${result.error.message}`,
		).toBe(true);

		const venta = await prisma.venta.findFirstOrThrow({
			where: { tenantId }, orderBy: { createdAt: 'desc' },
		});
		const allocation = await prisma.purchaseAllocation.findFirstOrThrow({
			where: { tenantId, ventaItem: { ventaId: venta.ventaId } },
		});
		expect(allocation.cantidad).toBe(1);
		const outbox = await prisma.shadowPosteoOutbox.findFirstOrThrow({
			where: {
				tenantId,
				tipoEvento: 'COSTO_VENTA_DEVENGADO',
				origenTipo: 'venta_costo',
				origenId: venta.ventaId,
			},
		});
		expect(outbox.estado).toBe('ERROR_SHADOW');
		expect(outbox.causa).toContain('valoración monetaria');
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'venta_costo', origenId: venta.ventaId },
		})).toBe(0);
	});

	it('enforce rolls sale, stock and FIFO allocation back when source FX is absent', async () => {
		const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		await crearCompraFifoSinFx();
		const before = {
			ventas: await prisma.venta.count({ where: { tenantId } }),
			allocations: await prisma.purchaseAllocation.count({ where: { tenantId } }),
			stock: (await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).stock,
		};
		try {
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result).toMatchObject({ success: false, error: { code: 'FX_INSUFICIENTE' } });
			expect(await prisma.venta.count({ where: { tenantId } })).toBe(before.ventas);
			expect(await prisma.purchaseAllocation.count({ where: { tenantId } }))
				.toBe(before.allocations);
			expect((await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).stock)
				.toBe(before.stock);
		} finally {
			if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
		}
	});

	it('enforce rolls back the sale and FIFO allocation when the COGS asiento insert fails', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		await crearCompraFifoCUP();
		const ventasAntes = await prisma.venta.count({ where: { tenantId } });
		const allocationsAntes = await prisma.purchaseAllocation.count({ where: { tenantId } });
		const stockAntes = (await prisma.stockUbicacion.findUniqueOrThrow({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: productId, tipoUbicacion: 'punto_venta', ubicacionId: pvId,
				},
			},
		})).cantidadDisponible;
		await installTrigger(
			'asientos',
			`IF NEW."origenTipo" = 'venta_costo' THEN
				RAISE EXCEPTION 'forced COGS posting failure' USING ERRCODE = '22012'; END IF`,
			`NEW."tenantId" = '${tenantId}'`,
		);
		try {
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result.success).toBe(false);
			expect(await prisma.venta.count({ where: { tenantId } })).toBe(ventasAntes);
			expect(await prisma.purchaseAllocation.count({ where: { tenantId } }))
				.toBe(allocationsAntes);
			expect((await prisma.stockUbicacion.findUniqueOrThrow({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: productId, tipoUbicacion: 'punto_venta', ubicacionId: pvId,
					},
				},
			})).cantidadDisponible).toBe(stockAntes);
		} finally {
			await removeTrigger();
			process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		}
	});

	it('fails closed and rolls back a USD cash sale without applied FX evidence', async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		await prisma.cuentaBancaria.update({ where: { cuentaId }, data: { moneda: 'USD' } });
		try {
			const before = {
				ventas: await prisma.venta.count({ where: { tenantId } }),
				reconciliaciones: await prisma.reconciliacionVenta.count({ where: { tenantId } }),
				facturas: await prisma.factura.count({ where: { tenantId } }),
				saldo: (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo,
				stock: (await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).stock,
			};
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId, clienteId: customerId,
				metodoPago: 'EFECTIVO', montoEfectivo: 1000,
				tipoVencimiento: 'contra_pago', cuentaBancariaId: cuentaId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result).toMatchObject({ success: false, error: { code: 'FX_INSUFICIENTE' } });
			expect(await prisma.venta.count({ where: { tenantId } })).toBe(before.ventas);
			expect(await prisma.reconciliacionVenta.count({ where: { tenantId } }))
				.toBe(before.reconciliaciones);
			expect(await prisma.factura.count({ where: { tenantId } })).toBe(before.facturas);
			expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
				.toEqual(before.saldo);
			expect((await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).stock)
				.toBe(before.stock);
		} finally {
			await prisma.cuentaBancaria.update({ where: { cuentaId }, data: { moneda: 'CUP' } });
			process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		}
	});

	it('commits the cash sale and durable ERROR_SHADOW after a real formal posting SQL failure', async () => {
		await installTrigger('asientos', `IF NEW."origenTipo" = 'reconciliacion_venta' THEN
			RAISE EXCEPTION 'forced cash sale shadow posting failure' USING ERRCODE = '22012'; END IF`,
			`NEW."tenantId" = '${tenantId}'`);
		try {
			const result = await createVentaAction({
				puntoDeVentaId: pvId, turnoId, clienteId: customerId,
				metodoPago: 'EFECTIVO', montoEfectivo: 1000,
				tipoVencimiento: 'contra_pago', cuentaBancariaId: cuentaId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never);
			expect(result).toMatchObject({ success: true });
			const venta = await prisma.venta.findFirstOrThrow({
				where: { tenantId, clienteId: customerId }, orderBy: { createdAt: 'desc' },
			});
			const rec = await prisma.reconciliacionVenta.findFirstOrThrow({
				where: { tenantId, ventaId: venta.ventaId },
			});
			expect(await prisma.ventaItem.count({ where: { ventaId: venta.ventaId } })).toBe(1);
			const outbox = await prisma.shadowPosteoOutbox.findFirst({
				where: {
					tenantId,
					tipoEvento: 'VENTA_CONTADO',
					origenTipo: 'reconciliacion_venta',
					origenId: rec.reconciliacionId,
				},
			});
			expect(outbox).toMatchObject({ estado: 'ERROR_SHADOW' });
			expect(outbox?.causa).toContain('forced cash sale shadow posting failure');
			expect(await prisma.asiento.count({
				where: { tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId },
			})).toBe(0);
		} finally {
			await removeTrigger();
		}
	});

	it('fails closed and rolls back the sale when durable shadow outbox insertion fails', async () => {
		await installTrigger('shadow_posteo_outbox',
			`RAISE EXCEPTION 'forced cash sale shadow outbox failure' USING ERRCODE = '22012'`,
			`NEW."tenantId" = '${tenantId}' AND NEW."tipoEvento" = 'VENTA_CONTADO'`);
		try {
			const salesBefore = await prisma.venta.count({ where: { tenantId } });
			const reconciliationsBefore = await prisma.reconciliacionVenta.count({ where: { tenantId } });
			const invoicesBefore = await prisma.factura.count({ where: { tenantId } });
			const accountBefore = await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } });
			const productBefore = await prisma.producto.findUniqueOrThrow({ where: { id: productId } });
			const stockBefore = await prisma.stockUbicacion.findUniqueOrThrow({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: productId, tipoUbicacion: 'punto_venta', ubicacionId: pvId,
					},
				},
			});
			await expect(createVentaAction({
				puntoDeVentaId: pvId, turnoId, clienteId: customerId,
				metodoPago: 'EFECTIVO', montoEfectivo: 1000,
				tipoVencimiento: 'contra_pago', cuentaBancariaId: cuentaId,
				items: [{ productoId: productId, cantidad: 1, precioUnitario: 1000 }],
			} as never)).resolves.toMatchObject({
				success: false,
				error: { code: 'OUTBOX_SHADOW_FALLIDA' },
			});
			expect(await prisma.venta.count({ where: { tenantId } })).toBe(salesBefore);
			expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(reconciliationsBefore);
			expect(await prisma.factura.count({ where: { tenantId } })).toBe(invoicesBefore);
			expect(await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).toMatchObject({
				saldo: accountBefore.saldo,
			});
			expect(await prisma.producto.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({
				stock: productBefore.stock,
			});
			expect(await prisma.stockUbicacion.findUniqueOrThrow({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: productId, tipoUbicacion: 'punto_venta', ubicacionId: pvId,
					},
				},
			})).toMatchObject({
				cantidad: stockBefore.cantidad,
				cantidadDisponible: stockBefore.cantidadDisponible,
			});
		} finally {
			await removeTrigger();
		}
	});
});
