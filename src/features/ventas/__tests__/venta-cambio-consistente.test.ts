/**
 * @description Tests del contrato del vuelto declarado (tareas 3.3/3.4 del
 * change remediacion-integridad-ventas-credito-fiscal): `cambioDevuelto` es
 * opcional/nullable (compatibilidad mobile legacy), pero si se envía debe
 * coincidir exactamente con el derivado del recibido y la porción en efectivo;
 * en caso contrario se rechaza con CAMBIO_INCONSISTENTE antes de cualquier
 * efecto, y la venta persiste siempre el vuelto DERIVADO del servidor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', () => ({
	registrarMovimiento: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
	allocateFifoForSale: vi.fn(),
	getCostoFifoVentaValorado: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn().mockResolvedValue({
		success: true,
		data: { turnoId: 't-1' },
	}),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: vi.fn().mockResolvedValue(undefined),
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn().mockResolvedValue([]),
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: { create: vi.fn().mockResolvedValue({ ventaId: 'v-1' }) },
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		factura: { create: vi.fn() },
		cliente: { findFirst: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([]) },
		turnoPuntoVenta: { findFirst: vi.fn().mockResolvedValue({ id: 't-1' }), create: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
	};
	return { mockTx };
});

vi.mock('@/lib/prisma', () => ({
	prisma: {
		puntoDeVenta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
		producto: { findMany: vi.fn() },
		$transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
	},
}));

import { prisma } from '@/lib/prisma';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { createVentaSchema } from '@/features/ventas/schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager = {
	userId: 'u-1',
	role: 'user',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { facturacion: true, 'ventas-factura': true, 'ventas-pos': true },
} as unknown as AuthenticatedUser;

/** Venta EFECTIVO de 4800 con producto mockeado a precio 4800. */
const ventaEfectivo = {
	puntoDeVentaId: 'pv-1',
	items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 4800 }],
	metodoPago: 'EFECTIVO' as const,
	montoEfectivo: 4800,
};

/** Venta MIXTO: 2000 efectivo + 1000 tarjeta, producto a 3000. */
const ventaMixto = {
	puntoDeVentaId: 'pv-1',
	items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 3000 }],
	metodoPago: 'MIXTO' as const,
	montoEfectivo: 2000,
	montoTarjeta: 1000,
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
		pvId: 'pv-1',
		listaPrecioId: null,
	} as never);
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ listaPrecioId: null } as never);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: 'prod-1', nombre: 'Producto', precioVenta: 4800, precios: [] },
	] as never);
	mockTx.producto.findUnique.mockResolvedValue({
		id: 'prod-1',
		nombre: 'Producto',
		stock: 10,
		precioCosto: 300,
		almacenId: 'alm-1',
		tenantId: 'tenant-1',
	});
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({ serieId: 's-1', prefijo: 'FV' });
	mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
	mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
	mockTx.$queryRaw.mockResolvedValue([]);
	mockTx.venta.create.mockResolvedValue({ ventaId: 'v-1' });
});

describe('schema: cambioDevuelto opcional/nullable', () => {
	it('acepta payload sin cambioDevuelto (compatibilidad legacy)', () => {
		expect(() => createVentaSchema.parse({
			puntoDeVentaId: 'pv-1',
			items: [{ productoId: 'p', cantidad: 1, precioUnitario: 100 }],
			metodoPago: 'EFECTIVO',
			montoEfectivo: 100,
		})).not.toThrow();
	});

	it('acepta cambioDevuelto null y valores enteros no negativos', () => {
		expect(() => createVentaSchema.parse({
			puntoDeVentaId: 'pv-1',
			items: [{ productoId: 'p', cantidad: 1, precioUnitario: 100 }],
			metodoPago: 'EFECTIVO',
			montoEfectivo: 100,
			cambioDevuelto: null,
		})).not.toThrow();
	});
});

describe('servicio: CAMBIO_INCONSISTENTE antes de efectos', () => {
	it('EFECTIVO con cambio declarado correcto confirma y persiste el vuelto derivado', async () => {
		const r = await VentaMutationService.create({
			input: { ...ventaEfectivo, montoRecibidoEfectivo: 5000, cambioDevuelto: 200 },
			user: manager,
		});

		expect(r).toEqual({ ventaId: 'v-1' });
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					montoRecibidoEfectivo: 5000,
					cambioDevuelto: 200,
				}),
			}),
		);
	});

	it('EFECTIVO con cambio declarado incorrecto se rechaza sin crear venta', async () => {
		await expect(
			VentaMutationService.create({
				input: { ...ventaEfectivo, montoRecibidoEfectivo: 5000, cambioDevuelto: 300 },
				user: manager,
			}),
		).rejects.toMatchObject({ code: 'CAMBIO_INCONSISTENTE' });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('cambio declarado sin recibido declarado se rechaza (no verificable)', async () => {
		await expect(
			VentaMutationService.create({
				input: { ...ventaEfectivo, cambioDevuelto: 200 },
				user: manager,
			}),
		).rejects.toMatchObject({ code: 'CAMBIO_INCONSISTENTE' });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('MIXTO: el cambio se valida contra la porción en efectivo', async () => {
		await expect(
			VentaMutationService.create({
				input: { ...ventaMixto, montoRecibidoEfectivo: 2500, cambioDevuelto: 500 },
				user: manager,
			}),
		).resolves.toEqual({ ventaId: 'v-1' });

		vi.clearAllMocks();
		mockTx.venta.create.mockResolvedValue({ ventaId: 'v-1' });
		await expect(
			VentaMutationService.create({
				input: { ...ventaMixto, montoRecibidoEfectivo: 2500, cambioDevuelto: 400 },
				user: manager,
			}),
		).rejects.toMatchObject({ code: 'CAMBIO_INCONSISTENTE' });
	});

	it('método sin efectivo con cambio declarado se rechaza', async () => {
		await expect(
			VentaMutationService.create({
				input: {
					...ventaEfectivo,
					metodoPago: 'TARJETA' as const,
					montoEfectivo: undefined,
					montoTarjeta: 4800,
					cambioDevuelto: 200,
				},
				user: manager,
			}),
		).rejects.toMatchObject({ code: 'CAMBIO_INCONSISTENTE' });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('cambioDevuelto null o ausente sigue pasando (payload legacy)', async () => {
		await expect(
			VentaMutationService.create({
				input: { ...ventaEfectivo, montoRecibidoEfectivo: 5000, cambioDevuelto: null },
				user: manager,
			}),
		).resolves.toEqual({ ventaId: 'v-1' });

		vi.clearAllMocks();
		mockTx.venta.create.mockResolvedValue({ ventaId: 'v-1' });
		await expect(
			VentaMutationService.create({
				input: { ...ventaEfectivo, montoRecibidoEfectivo: 5000 },
				user: manager,
			}),
		).resolves.toEqual({ ventaId: 'v-1' });
	});
});
