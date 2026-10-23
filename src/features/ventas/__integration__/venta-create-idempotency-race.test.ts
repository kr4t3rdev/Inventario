/**
 * @description Verifies product-sale request idempotency against disposable PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import type { CreateVentaInput } from '@/features/ventas/schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

type Fixture = {
	tenantId: string;
	userId: string;
	puntoDeVentaId: string;
	productoId: string;
};

const fixtures: Fixture[] = [];
const stamp = `venta-idem-${crypto.randomUUID()}`;

/**
 * @description Creates a tenant-scoped actor authorized to register sales.
 * @param {string} tenantId - Tenant that owns the sale fixture.
 * @returns {AuthenticatedUser} Integration actor for the tenant.
 */
function actor(tenantId: string): AuthenticatedUser {
	const fixture = fixtures.find((entry) => entry.tenantId === tenantId);
	return {
		userId: fixture?.userId ?? `actor-${tenantId}`,
		role: 'admin',
		isActive: true,
		tenantId,
		tenantRole: 'manager',
		planFeatures: { 'ventas-pos': true },
		permissions: new Set(['ventas.venta.registrar']),
	} as unknown as AuthenticatedUser;
}

/**
 * @description Persists the minimum real PostgreSQL graph for product sales.
 * @param {string} name - Unique fixture suffix.
 * @returns {Promise<Fixture>} Tenant, point-of-sale, product, and user IDs.
 */
async function createFixture(name: string): Promise<Fixture> {
	const tenant = await prisma.tenant.create({
		data: { nombre: `${stamp}-${name}`, slug: `${stamp}-${name}` },
	});
	const user = await prisma.user.create({
		data: {
			name: `${name}-actor`,
			email: `${stamp}-${name}@test.local`,
			password: 'integration-only-placeholder',
		},
	});
	const [warehouse, category, pointOfSale] = await Promise.all([
		prisma.almacen.create({ data: { tenantId: tenant.tenantId, nombre: `${name}-warehouse` } }),
		prisma.categoria.create({ data: { tenantId: tenant.tenantId, nombre: `${name}-category` } }),
		prisma.puntoDeVenta.create({
			data: { tenantId: tenant.tenantId, nombre: `${name}-point-of-sale` },
		}),
	]);
	const product = await prisma.producto.create({
		data: {
			tenantId: tenant.tenantId,
			nombre: `${name}-product`,
			precioCosto: 200,
			precioVenta: 500,
			stock: 10,
			categoriaId: category.catId,
			almacenId: warehouse.almacenId,
		},
	});
	await prisma.stockUbicacion.create({
		data: {
			tenantId: tenant.tenantId,
			productoId: product.id,
			tipoUbicacion: 'punto_venta',
			ubicacionId: pointOfSale.pvId,
			cantidad: 10,
			cantidadDisponible: 10,
		},
	});
	const fixture = {
		tenantId: tenant.tenantId,
		userId: user.userId,
		puntoDeVentaId: pointOfSale.pvId,
		productoId: product.id,
	};
	fixtures.push(fixture);
	return fixture;
}

/**
 * @description Captures durable sale and accounting state for rollback assertions.
 * @param {Fixture} fixture - Tenant fixture to inspect.
 * @returns {Promise<object>} Counts and inventory quantities for owned rows.
 */
async function snapshotFeatureState(fixture: Fixture) {
	const [
		sales,
		saleItems,
		receipts,
		stockMoves,
		fifoAllocations,
		invoices,
		receivables,
		reconciliations,
		series,
		auditLogs,
		journalEntries,
		journalLines,
		stock,
	] = await Promise.all([
		prisma.venta.count({ where: { tenantId: fixture.tenantId } }),
		prisma.ventaItem.count({ where: { venta: { tenantId: fixture.tenantId } } }),
		prisma.ventaCreateIdempotency.count({ where: { tenantId: fixture.tenantId } }),
		prisma.stockMoveLine.count({ where: { tenantId: fixture.tenantId } }),
		prisma.purchaseAllocation.count({ where: { tenantId: fixture.tenantId } }),
		prisma.factura.count({ where: { tenantId: fixture.tenantId } }),
		prisma.cuentaPorCobrar.count({ where: { tenantId: fixture.tenantId } }),
		prisma.reconciliacionVenta.count({ where: { tenantId: fixture.tenantId } }),
		prisma.serieFacturacion.count({ where: { tenantId: fixture.tenantId } }),
		prisma.auditLog.count({ where: { usuarioId: fixture.userId } }),
		prisma.asiento.count({ where: { tenantId: fixture.tenantId } }),
		prisma.asientoLinea.count({ where: { asiento: { tenantId: fixture.tenantId } } }),
		prisma.stockUbicacion.findUniqueOrThrow({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: fixture.productoId,
					tipoUbicacion: 'punto_venta',
					ubicacionId: fixture.puntoDeVentaId,
				},
			},
		}),
	]);
	return {
		sales,
		saleItems,
		receipts,
		stockMoves,
		fifoAllocations,
		invoices,
		receivables,
		reconciliations,
		series,
		auditLogs,
		journalEntries,
		journalLines,
		stock: {
			cantidad: stock.cantidad,
			cantidadDisponible: stock.cantidadDisponible,
		},
	};
}

/**
 * @description Installs a disposable-table trigger that forces receipt persistence to fail.
 * @param {'INSERT' | 'UPDATE'} event - Receipt operation that should fail.
 * @param {() => Promise<void>} action - Request expected to hit the trigger.
 * @returns {Promise<void>} Resolves after trigger cleanup.
 */
async function withReceiptFailureTrigger(
	event: 'INSERT' | 'UPDATE',
	action: () => Promise<void>,
): Promise<void> {
	const suffix = crypto.randomUUID().replaceAll('-', '');
	const functionName = `test_sale_receipt_failure_${suffix}`;
	const triggerName = `test_sale_receipt_failure_trigger_${suffix}`;
	await prisma.$executeRawUnsafe(`
		CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			RAISE EXCEPTION 'forced sale receipt ${event.toLowerCase()} failure';
		END;
		$$
	`);
	await prisma.$executeRawUnsafe(`
		CREATE TRIGGER "${triggerName}" BEFORE ${event} ON "VentaCreateIdempotency"
		FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
	`);
	try {
		await action();
	} finally {
		await prisma.$executeRawUnsafe(
			`DROP TRIGGER IF EXISTS "${triggerName}" ON "VentaCreateIdempotency"`,
		);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
	}
}

/**
 * @description Builds a product-sale request for the integration fixture.
 * @param {Fixture} fixture - Tenant fixture to sell from.
 * @param {string} idempotencyKey - Request-level retry key.
 * @param {Record<string, unknown>} overrides - Fields overriding the basic request.
 * @returns {CreateVentaInput} Sale request accepted by the mutation service.
 */
function input(
	fixture: Fixture,
	idempotencyKey: string,
	overrides: Record<string, unknown> = {},
): CreateVentaInput {
	return {
		puntoDeVentaId: fixture.puntoDeVentaId,
		idempotencyKey,
		items: [{ productoId: fixture.productoId, cantidad: 1, precioUnitario: 500 }],
		...overrides,
	};
}

describe('product sale idempotency — PostgreSQL races', { timeout: 90_000 }, () => {
	let primary!: Fixture;
	let secondTenant!: Fixture;

	beforeAll(async () => {
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		const target = new URL(process.env.DATABASE_URL ?? '');
		expect(identity[0]).toMatchObject({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});
		primary = await createFixture('primary');
		secondTenant = await createFixture('second');
	});

	afterAll(async () => {
		for (const fixture of fixtures) {
			await prisma.ventaCreateIdempotency.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.venta.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.$transaction(async (tx) => {
				await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");
				await tx.stockMoveLine.deleteMany({ where: { tenantId: fixture.tenantId } });
			});
			await prisma.stockUbicacion.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.producto.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.categoria.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.puntoDeVenta.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.almacen.deleteMany({ where: { tenantId: fixture.tenantId } });
			await prisma.tenant.delete({ where: { tenantId: fixture.tenantId } });
			await prisma.user.delete({ where: { userId: fixture.userId } });
		}
		await prisma.$disconnect();
	});

	it('replays one immutable response and applies stock/FIFO only once for identical concurrent requests', async () => {
		const key = `same-${crypto.randomUUID()}`;
		const results = await Promise.all([
			VentaMutationService.create({ input: input(primary, key, { observaciones: 'original' }), user: actor(primary.tenantId) }),
			VentaMutationService.create({ input: input(primary, key, { observaciones: 'original' }), user: actor(primary.tenantId) }),
		]);
		const saleId = results[0].ventaId;
		expect(results[1].ventaId).toBe(saleId);
		expect(results.map((result) => result.createdAt instanceof Date)).toEqual([true, true]);
		expect(await prisma.venta.count({ where: { tenantId: primary.tenantId, ventaId: saleId } })).toBe(1);
		expect(await prisma.ventaItem.count({ where: { venta: { tenantId: primary.tenantId, ventaId: saleId } } })).toBe(1);
		expect(await prisma.stockUbicacion.findUniqueOrThrow({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: primary.productoId,
					tipoUbicacion: 'punto_venta',
					ubicacionId: primary.puntoDeVentaId,
				},
			},
		}).then((row) => row.cantidadDisponible)).toBe(9);
		expect(await prisma.stockMoveLine.count({ where: { tenantId: primary.tenantId, tipoOrigen: 'VENTA', origenId: saleId } })).toBe(1);
		expect(await prisma.ventaCreateIdempotency.count({ where: { tenantId: primary.tenantId } })).toBe(1);

		await prisma.venta.update({
			where: { ventaId: saleId },
			data: { observaciones: 'mutated later' },
		});
		await prisma.producto.update({
			where: { id: primary.productoId },
			data: { precioVenta: 700 },
		});
		const replay = await VentaMutationService.create({
			input: input(primary, key, { observaciones: 'original' }),
			user: actor(primary.tenantId),
		});
		expect(replay.observaciones).toBe('original');
		await prisma.venta.delete({ where: { ventaId: saleId } });
		const receipt = await prisma.ventaCreateIdempotency.findUniqueOrThrow({
			where: {
				tenantId_keyHash: {
					tenantId: primary.tenantId,
					keyHash: createHash('sha256').update(key).digest('hex'),
				},
			},
		});
		expect(receipt.ventaId).toBeNull();
		expect(receipt.responseSnapshot).toMatchObject({ ventaId: saleId, observaciones: 'original' });
		const replayAfterDelete = await VentaMutationService.create({
			input: input(primary, key, { observaciones: 'original' }),
			user: actor(primary.tenantId),
		});
		expect(replayAfterDelete.ventaId).toBe(saleId);
		expect(replayAfterDelete.createdAt).toBeInstanceOf(Date);
		await prisma.producto.update({
			where: { id: primary.productoId },
			data: { precioVenta: 500 },
		});
	});

	it('rejects changed intent without creating another sale and scopes keys by tenant', async () => {
		const key = `scope-${crypto.randomUUID()}`;
		await VentaMutationService.create({ input: input(primary, key), user: actor(primary.tenantId) });
		await expect(VentaMutationService.create({
			input: input(primary, key, {
				items: [{ productoId: primary.productoId, cantidad: 2, precioUnitario: 1 }],
			}),
			user: actor(primary.tenantId),
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });

		const otherTenantResult = await VentaMutationService.create({
			input: input(secondTenant, key),
			user: actor(secondTenant.tenantId),
		});
		expect(otherTenantResult.tenantId).toBe(secondTenant.tenantId);
		expect(await prisma.ventaCreateIdempotency.count({ where: { keyHash: { not: '' } } })).toBe(3);
	});

	it('rolls back the sale and receipt when a downstream stock check fails', async () => {
		const key = `rollback-${crypto.randomUUID()}`;
		const salesBefore = await prisma.venta.count({ where: { tenantId: primary.tenantId } });
		const receiptsBefore = await prisma.ventaCreateIdempotency.count({
			where: { tenantId: primary.tenantId },
		});
		const existingStock = await prisma.stockUbicacion.findUniqueOrThrow({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: primary.productoId,
					tipoUbicacion: 'punto_venta',
					ubicacionId: primary.puntoDeVentaId,
				},
			},
		});
		await prisma.stockUbicacion.update({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: primary.productoId,
					tipoUbicacion: 'punto_venta',
					ubicacionId: primary.puntoDeVentaId,
				},
			},
			data: { cantidad: 0, cantidadDisponible: 0 },
		});
		await expect(VentaMutationService.create({
			input: {
				...input(primary, key),
				modoPedido: false,
			},
			user: actor(primary.tenantId),
		})).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
		expect(await prisma.venta.count({ where: { tenantId: primary.tenantId } })).toBe(salesBefore);
		expect(await prisma.ventaCreateIdempotency.count({ where: { tenantId: primary.tenantId } }))
			.toBe(receiptsBefore);
		await prisma.stockUbicacion.update({
			where: {
				productoId_tipoUbicacion_ubicacionId: {
					productoId: primary.productoId,
					tipoUbicacion: 'punto_venta',
					ubicacionId: primary.puntoDeVentaId,
				},
			},
			data: {
				cantidad: existingStock.cantidad,
				cantidadDisponible: existingStock.cantidadDisponible,
			},
		});
	});

	it('leaves feature state untouched when receipt reservation insert fails', async () => {
		const before = await snapshotFeatureState(primary);
		await withReceiptFailureTrigger('INSERT', async () => {
			await expect(VentaMutationService.create({
				input: input(primary, `receipt-insert-${crypto.randomUUID()}`),
				user: actor(primary.tenantId),
			})).rejects.toBeDefined();
		});
		expect(await snapshotFeatureState(primary)).toEqual(before);
	});

	it('rolls back sale, stock, kardex and ledgers when receipt finalization fails', async () => {
		const before = await snapshotFeatureState(primary);
		await withReceiptFailureTrigger('UPDATE', async () => {
			await expect(VentaMutationService.create({
				input: input(primary, `receipt-update-${crypto.randomUUID()}`),
				user: actor(primary.tenantId),
			})).rejects.toBeDefined();
		});
		expect(await snapshotFeatureState(primary)).toEqual(before);
	});
});
