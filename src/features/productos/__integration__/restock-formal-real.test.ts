/**
 * @description Integración de la fila 28 de la matriz R0.5 (`productos/actions-restock.ts`):
 * `restockProductoAction` en enforce postea el egreso del restock en el mismo tx con
 * la valoración FX persistida, y un fallo SQL en el posteo revierte stock y gasto.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => ({
	value: {
		userId: '', name: 'Actor Restock', email: 'restock@test.invalid',
		role: 'user' as const, isActive: true, tenantId: '',
		tenantRole: 'manager' as const,
		planFeatures: { restock: true, contabilidad: true },
		permissions: new Set(['inventario.productos.restock']),
	},
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: async () => currentUser.value,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { restockProductoAction } from '@/features/productos/actions-restock';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';

describe('restockProductoAction — posting enforce y rollback real', { timeout: 60_000 }, () => {
	let tenantId = '';
	let productoId = '';
	let productoRollbackId = '';
	let cuentaId = '';
	let actorId = '';
	let proveedorId = '';
	const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;

	async function crearProducto(nombre: string): Promise<string> {
		const categoria = await prisma.categoria.findFirstOrThrow({ where: { tenantId } });
		const almacen = await prisma.almacen.findFirstOrThrow({ where: { tenantId } });
		const producto = await prisma.producto.create({
			data: {
				nombre, precioCosto: 10, precioVenta: 15, stock: 0,
				tenant: { connect: { tenantId } },
				categoria: { connect: { catId: categoria.catId } },
				almacen: { connect: { almacenId: almacen.almacenId } },
				vendor: { connect: { vendorId: proveedorId } },
			},
		});
		return producto.id;
	}

	beforeAll(async () => {
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const suffix = randomUUID().replaceAll('-', '');
		await prisma.$transaction(async (tx) => seedPlantillasGlobales(tx));
		const tenant = await prisma.tenant.create({
			data: { nombre: 'Restock formal integrado', slug: `restock-formal-${suffix}` },
		});
		tenantId = tenant.tenantId;
		currentUser.value.tenantId = tenantId;
		await prisma.$transaction(async (tx) => seedPlanContable(tx, tenantId));
		await prisma.tenantLicense.create({
			data: {
				tenantId,
				expiracion: new Date('2099-01-01'),
				features: { 'contabilidad-formal': true },
			},
		});

		const now = new Date();
		const inicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const fin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
		await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
				codigo: `RST-${suffix.slice(0, 8)}`,
				fechaInicio: inicio, fechaFin: fin,
			},
		});

		const actor = await prisma.user.create({
			data: { name: 'Actor Restock', email: `restock-${suffix}@test.invalid`, password: 'test' },
		});
		actorId = actor.userId;
		currentUser.value.userId = actor.userId;
		// Política contable requerida por el writer y el guard fail-closed del motor.
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: actorId },
		});

		await prisma.almacen.create({ data: { nombre: 'Almacén restock', tenantId } });
		await prisma.categoria.create({ data: { nombre: 'Categoría restock', tenantId } });
		const proveedor = await prisma.vendor.create({
			data: { tenantId, nombre: 'Proveedor restock' },
		});
		proveedorId = proveedor.vendorId;

		const cuenta = await prisma.cuentaBancaria.create({
			data: {
				tenantId, nombreBanco: 'Banco Test', numeroCuenta: `ACC-${suffix.slice(0, 10)}`,
				tipoCuenta: 'CORRIENTE', saldo: 100000, moneda: 'CUP',
			},
		});
		cuentaId = cuenta.cuentaId;
		await prisma.tipoPago.create({
			data: { tenantId, nombre: 'Efectivo', cuentaDefecto: cuentaId },
		});

		productoId = await crearProducto('Producto restock');
		productoRollbackId = await crearProducto('Producto restock rollback');
	});

	afterAll(async () => {
		delete process.env.CONTABILIDAD_FORMAL_MODE;
		if (originalMode !== undefined) process.env.CONTABILIDAD_FORMAL_MODE = originalMode;
		if (!tenantId) return;
		const productoIds = (
			await prisma.producto.findMany({ where: { tenantId }, select: { id: true } })
		).map((p) => p.id);
		await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
		await prisma.asiento.deleteMany({ where: { tenantId } });
		await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.tipoPago.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.gastoCompra.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.compraProducto.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.producto.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.categoria.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.almacen.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.cuentaBancaria.deleteMany({ where: { tenantId } }).catch(() => undefined);
			await prisma.user.delete({ where: { userId: actorId } }).catch(() => undefined);
		await prisma.vendor.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.periodoContable.deleteMany({ where: { tenantId } });
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
		await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
	});

	it('posts the restock expense in enforce with persisted FX valuation', async () => {
		const respuesta = await restockProductoAction({
			productoId, cantidad: 3, precioCosto: 40,
			descripcion: 'Restock enforce', tipoRestock: 'sumar_stock',
			moneda: 'CUP', cuentaId,
		} as never);
		if (!respuesta.success) console.error('RESTOCK_FAIL', respuesta.error);
		expect(respuesta.success).toBe(true);

		const rec = await prisma.reconciliacionGasto.findFirst({
			where: { tenantId }, orderBy: { createdAt: 'desc' },
		});
		expect(rec).toBeTruthy();
		const asiento = await prisma.asiento.findFirstOrThrow({
			where: { tenantId, origenTipo: 'reconciliacion_gasto', origenId: rec!.reconciliacionId },
			include: { lineas: true },
		});
		expect(asiento.estado).toBe('CONTABILIZADO');
		const debe = asiento.lineas.reduce((acc, l) => acc + Number(l.debe), 0);
		const haber = asiento.lineas.reduce((acc, l) => acc + Number(l.haber), 0);
		expect(debe).toBe(haber);
		expect(debe).toBe(120);
		expect(asiento.createdBy).toBe(currentUser.value.userId);
	});

	it('rolls back stock and expense when the formal posting fails', async () => {
		const trigger = `rst_fail_${randomUUID().replaceAll('-', '')}`;
		const fn = `${trigger}_fn`;
		// El trigger existe solo durante este intento y falla cualquier línea de
		// asiento insertada mientras esté activo (falla del posteo formal).
		await prisma.$executeRawUnsafe(
			`CREATE OR REPLACE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$
			 BEGIN IF NEW."tenantId" = '${tenantId.replaceAll("'", "''")}'
			 THEN RAISE EXCEPTION 'injected restock posting failure'; END IF; RETURN NEW; END $$`,
		);
		await prisma.$executeRawUnsafe(`
			CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asiento_lineas"
			FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);

		try {
			const respuesta = await restockProductoAction({
				productoId: productoRollbackId, cantidad: 5, precioCosto: 20,
				descripcion: 'Restock rollback', tipoRestock: 'sumar_stock',
				moneda: 'CUP', cuentaId,
			} as never);
			expect(respuesta.success).toBe(false);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asiento_lineas"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"() CASCADE`);
		}
	});

	it('rechaza el reintento con el mismo numero de factura (RESTOCK_DUPLICADO)', async () => {
		const factura = `F-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
		const input = {
			productoId, cantidad: 2, precioCosto: 25,
			descripcion: 'Restock idempotencia', tipoRestock: 'sumar_stock',
			moneda: 'CUP', cuentaId, numeroFactura: factura,
		} as never;

		const primera = await restockProductoAction(input);
		if (!primera.success) console.error('RESTOCK_FAIL', primera.error);
		expect(primera.success).toBe(true);

		const reintento = await restockProductoAction(input);
		expect(reintento.success).toBe(false);
		expect(JSON.stringify(reintento.error)).toContain('RESTOCK_DUPLICADO');

		// Sin duplicados: una sola compra registrada con esa factura.
		expect(await prisma.gastoCompra.count({
			where: { tenantId, numeroFactura: factura },
		})).toBe(1);
	});

	it('5 llamadas concurrentes con la misma factura crean una sola compra', async () => {
		const factura = `F-CONC-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
		const input = {
			productoId, cantidad: 1, precioCosto: 10,
			descripcion: 'Restock concurrente', tipoRestock: 'sumar_stock',
			moneda: 'CUP', cuentaId, numeroFactura: factura,
		} as never;

		const resultados = await Promise.all(
			Array.from({ length: 5 }, () => restockProductoAction(input)),
		);

		// Solo una debe tener éxito; las demás reciben RESTOCK_DUPLICADO
		// (vía el check previo o el catch P2002 en carrera).
		const exitosas = resultados.filter((r: any) => r.success);
		expect(exitosas.length).toBe(1);

		for (const r of resultados) {
			if (!(r as any).success) {
				expect(JSON.stringify((r as any).error)).toContain('RESTOCK_DUPLICADO');
			}
		}

		expect(await prisma.gastoCompra.count({
			where: { tenantId, numeroFactura: factura },
		})).toBe(1);
	});
});
