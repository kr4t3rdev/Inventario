/**
 * @description Tests de orquestación del ciclo en VentaMutationService.create (PVE-T3):
 * el flujo clásico termina ENTREGADA/FACTURADA con efectos; el modo pedido crea la
 * venta en PEDIDO sin efectos de stock/FIFO/factura.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', () => ({
	registrarMovimiento: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
	allocateFifoForSale: vi.fn(),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
	applyFacturacionCobroWorkflow: vi.fn(),
}));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn().mockResolvedValue({
		success: true,
		data: { turnoId: 't-1' },
	}),
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		serieFacturacion: {
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		venta: { create: vi.fn(), update: vi.fn() },
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		factura: { create: vi.fn() },
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
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const adminUser = {
	userId: 'user-1',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { facturacion: true, 'ventas-factura': true, 'ventas-pos': true },
} as unknown as AuthenticatedUser;

const items = [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }];

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
		pvId: 'pv-1',
		listaPrecioId: null,
	} as never);
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ listaPrecioId: null } as never);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: 'prod-1', nombre: 'Producto', precioVenta: 500, precios: [] },
	] as never);
	mockTx.venta.create.mockResolvedValue({ ventaId: 'v-1' });
	mockTx.producto.findUnique.mockResolvedValue({
		id: 'prod-1',
		nombre: 'Producto',
		stock: 10,
		precioCosto: 300,
		almacenId: 'alm-1',
		tenantId: 'tenant-1',
	});
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({
		serieId: 'serie-1',
		prefijo: 'FV',
	});
	mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
	mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
});

describe('create como orquestador del ciclo (PVE-T3)', () => {
	it('flujo clásico con cliente y plan de facturación termina FACTURADA', async () => {
		const result = await VentaMutationService.create({
			input: {
				puntoDeVentaId: 'pv-1',
				clienteId: 'c-1',
				items,
				metodoPago: 'EFECTIVO',
				montoEfectivo: 1000,
			},
			user: adminUser,
		});
		expect(result).toEqual({ ventaId: 'v-1' });
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'FACTURADA', metodoPago: 'EFECTIVO' }),
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalled();
		expect(allocateFifoForSale).toHaveBeenCalled();
		expect(mockTx.factura.create).toHaveBeenCalled();
	});

	it('flujo clásico sin cliente termina ENTREGADA con efectos de stock', async () => {
		await VentaMutationService.create({
			input: { puntoDeVentaId: 'pv-1', items, metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
			user: adminUser,
		});
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'ENTREGADA' }),
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalled();
		expect(allocateFifoForSale).toHaveBeenCalled();
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});

	it('modo pedido crea en PEDIDO sin stock, FIFO, factura ni pago persistido', async () => {
		await VentaMutationService.create({
			input: {
				puntoDeVentaId: 'pv-1',
				clienteId: 'c-1',
				items,
				modoPedido: true,
				metodoPago: 'EFECTIVO',
				montoEfectivo: 1000,
			},
			user: adminUser,
		});
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'PEDIDO', metodoPago: null }),
			}),
		);
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(registrarMovimiento).not.toHaveBeenCalled();
		expect(allocateFifoForSale).not.toHaveBeenCalled();
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});

	it('la respuesta conserva la forma actual (venta creada)', async () => {
		const result = await VentaMutationService.create({
			input: { puntoDeVentaId: 'pv-1', items },
			user: adminUser,
		});
		expect(result).toEqual({ ventaId: 'v-1' });
	});
});
