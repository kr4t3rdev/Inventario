/**
 * @description Tests del ciclo de vida del pedido de venta (PVE-T2):
 * entregarVenta (PEDIDO → ENTREGADA), facturarVenta (ENTREGADA → FACTURADA)
 * y anularVentaPorEstado (cualquier estado → ANULADA con efectos según origen).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', () => ({
	registrarMovimiento: vi.fn(),
	revertirMovimientosDeOrigen: vi.fn().mockResolvedValue([{ id: 'm1' }]),
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

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn(),
		venta: {
			findUnique: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			update: vi.fn(),
		},
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		serieFacturacion: {
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		factura: { create: vi.fn(), update: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn(), updateMany: vi.fn() },
		reconciliacionVenta: { deleteMany: vi.fn() },
		purchaseAllocation: { deleteMany: vi.fn() },
	};
	return { mockTx };
});

vi.mock('@/lib/prisma', () => ({
	prisma: {
		venta: { findUnique: vi.fn() },
		$transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
	},
}));

import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
	registrarMovimiento,
	revertirMovimientosDeOrigen,
} from '@/features/inventario/movimientos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { ActionError } from '@/lib/server-actions';
import { VentaLifecycleService } from '@/features/ventas/services/venta-lifecycle-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const svc = VentaLifecycleService;

const adminUser: AuthenticatedUser = {
	userId: 'user-1',
	name: 'Admin',
	email: 'admin@test.com',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
} as AuthenticatedUser;

const ventaPedido = {
	ventaId: 'venta-1',
	tenantId: 'tenant-1',
	estado: 'PEDIDO',
	puntoDeVentaId: 'pv-1',
	clienteId: 'cliente-1',
	deletedAt: null,
	total: 1000,
	descuento: 0,
	factura: null,
	reconciliaciones: [],
	turno: { estado: 'ABIERTO', arqueos: [] },
	items: [
		{
			id: 'item-1',
			productoId: 'prod-1',
			cantidad: 2,
			precioUnitario: 500,
			total: 1000,
			producto: {
				id: 'prod-1',
				tenantId: 'tenant-1',
				almacenId: 'alm-1',
				precioCosto: 300,
			},
		},
	],
};

function mirarVenta(v: typeof ventaPedido) {
	vi.mocked(prisma.venta.findUnique).mockResolvedValue(v as never);
	mockTx.venta.findUnique.mockResolvedValue(v as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockTx.venta.updateMany.mockResolvedValue({ count: 1 });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({
		serieId: 'serie-1',
		prefijo: 'FV',
		consecutivo: 8,
	});
	mockTx.serieFacturacion.update.mockResolvedValue({
		serieId: 'serie-1',
		consecutivo: 9,
	});
	mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	mockTx.producto.findUnique.mockResolvedValue(ventaPedido.items[0].producto);
	mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
});

describe('entregarVenta (PEDIDO → ENTREGADA)', () => {
	it('reclama el estado, descuenta stock, registra kardex y aplica FIFO', async () => {
		mirarVenta(ventaPedido);
		await svc.entregarVenta({ ventaId: 'venta-1', user: adminUser });

		expect(mockTx.venta.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					ventaId: 'venta-1',
					tenantId: 'tenant-1',
					estado: 'PEDIDO',
				}),
				data: expect.objectContaining({ estado: 'ENTREGADA' }),
			}),
		);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				productoId: 'prod-1',
				tipoUbicacion: 'punto_venta',
				ubicacionId: 'pv-1',
				delta: -2,
			}),
		);
		expect(registrarMovimiento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tipoOrigen: 'VENTA',
				origenId: 'venta-1',
				cantidad: -2,
				costoUnitario: 300,
			}),
		);
		expect(allocateFifoForSale).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'venta-1');
	});

	it('rechaza una doble entrega (estado ya avanzó) sin efectos', async () => {
		mirarVenta({ ...ventaPedido, estado: 'ENTREGADA' });
		mockTx.venta.findUnique.mockResolvedValue({ ...ventaPedido, estado: 'ENTREGADA' } as never);

		await expect(
			svc.entregarVenta({ ventaId: 'venta-1', user: adminUser }),
		).rejects.toThrow(ActionError);
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(allocateFifoForSale).not.toHaveBeenCalled();
	});

	it('rechaza la entrega si el stock ya no alcanza, sin efectos', async () => {
		mirarVenta(ventaPedido);
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 1 });

		await expect(
			svc.entregarVenta({ ventaId: 'venta-1', user: adminUser }),
		).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(allocateFifoForSale).not.toHaveBeenCalled();
	});

	it('exige venta del tenant', async () => {
		vi.mocked(prisma.venta.findUnique).mockResolvedValue(null);
		await expect(
			svc.entregarVenta({ ventaId: 'venta-x', user: adminUser }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('exige la feature ventas-pedidos a no-admin', async () => {
		mirarVenta(ventaPedido);
		const userSinPlan = {
			...adminUser,
			role: 'user',
			tenantRole: 'manager',
			planFeatures: {},
		} as unknown as AuthenticatedUser;
		await expect(
			svc.entregarVenta({ ventaId: 'venta-1', user: userSinPlan }),
		).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
	});
});

describe('facturarVenta (ENTREGADA → FACTURADA)', () => {
	const ventaEntregada = { ...ventaPedido, estado: 'ENTREGADA' };

	it('crea la factura con serie, reclama el estado y persiste el cobro', async () => {
		mirarVenta(ventaEntregada);
		await svc.facturarVenta({
			ventaId: 'venta-1',
			input: { metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
			user: adminUser,
		});

		expect(mockTx.venta.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ ventaId: 'venta-1', estado: 'ENTREGADA' }),
				data: expect.objectContaining({ estado: 'FACTURADA', metodoPago: 'EFECTIVO' }),
			}),
		);
		expect(mockTx.factura.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tipoDocumento: 'FACTURA',
					numeroFactura: 'FV-000008',
					ventaId: 'venta-1',
					clienteId: 'cliente-1',
					estado: 'PENDIENTE',
				}),
			}),
		);
	});

	it('aplica el workflow de cobro cuando hay vencimiento', async () => {
		mirarVenta(ventaEntregada);
		await svc.facturarVenta({
			ventaId: 'venta-1',
			input: {
				metodoPago: 'CREDITO',
				tipoVencimiento: 'plazo',
				fechaVencimiento: '2026-10-01',
			},
			user: adminUser,
		});
		expect(applyFacturacionCobroWorkflow).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ ventaId: 'venta-1', facturaId: 'fac-1' }),
		);
	});

	it('rechaza facturar un pedido que aún no se entregó', async () => {
		mirarVenta(ventaPedido);
		mockTx.venta.findUnique.mockResolvedValue(ventaPedido as never);
		await expect(
			svc.facturarVenta({
				ventaId: 'venta-1',
				input: { metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
				user: adminUser,
			}),
		).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' });
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});

	it('rechaza facturar una venta sin cliente', async () => {
		mirarVenta({ ...ventaEntregada, clienteId: null });
		await expect(
			svc.facturarVenta({
				ventaId: 'venta-1',
				input: { metodoPago: 'EFECTIVO' },
				user: adminUser,
			}),
		).rejects.toMatchObject({ code: 'CLIENTE_REQUERIDO' });
	});

	it('exige que el desglose MIXTO sume exactamente el total de la venta', async () => {
		mirarVenta(ventaEntregada);
		await expect(
			svc.facturarVenta({
				ventaId: 'venta-1',
				input: { metodoPago: 'MIXTO', montoEfectivo: 600, montoTarjeta: 300 },
				user: adminUser,
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});
});

describe('anularVentaPorEstado', () => {
	it('anula un PEDIDO sin tocar stock, FIFO ni factura', async () => {
		mirarVenta(ventaPedido);
		await svc.anularVentaPorEstado({ ventaId: 'venta-1', motivo: 'error', user: adminUser });

		expect(mockTx.venta.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'ANULADA' }),
			}),
		);
		expect(mockTx.venta.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ deletedAt: expect.any(Date) }),
			}),
		);
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(revertirMovimientosDeOrigen).not.toHaveBeenCalled();
		expect(allocateFifoForSale).not.toHaveBeenCalled();
	});

	it('anula una ENTREGADA revirtiendo stock, kardex y allocations', async () => {
		mirarVenta({ ...ventaPedido, estado: 'ENTREGADA' });
		await svc.anularVentaPorEstado({ ventaId: 'venta-1', motivo: null, user: adminUser });

		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ productoId: 'prod-1', delta: 2 }),
		);
		expect(revertirMovimientosDeOrigen).toHaveBeenCalled();
		expect(mockTx.purchaseAllocation.deleteMany).toHaveBeenCalled();
	});

	it('anula una FACTURADA anulando también factura y CxC', async () => {
		const ventaFacturada = {
			...ventaPedido,
			estado: 'FACTURADA',
			factura: { idFactura: 'fac-1', tenantId: 'tenant-1' },
		};
		mirarVenta(ventaFacturada);
		mockTx.cuentaPorCobrar.findMany.mockResolvedValue([{ id: 'cxc-1' }]);
		await svc.anularVentaPorEstado({ ventaId: 'venta-1', motivo: null, user: adminUser });

		expect(mockTx.factura.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { idFactura: 'fac-1' },
				data: { estado: 'ANULADA' },
			}),
		);
		expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({ data: { estado: 'ANULADA' } }),
		);
	});

	it('rechaza anular una venta de turno cerrado', async () => {
		mirarVenta({
			...ventaPedido,
			estado: 'ENTREGADA',
			turno: { estado: 'CERRADO', arqueos: [] },
		});
		await expect(
			svc.anularVentaPorEstado({ ventaId: 'venta-1', motivo: null, user: adminUser }),
		).rejects.toMatchObject({ code: 'FINANCIAL_REVERSAL_REQUIRED' });
	});

	it('falla sin efectos si el claim de anulación pierde la carrera', async () => {
		mirarVenta({ ...ventaPedido, estado: 'ENTREGADA' });
		mockTx.venta.updateMany.mockResolvedValue({ count: 0 });
		await expect(
			svc.anularVentaPorEstado({ ventaId: 'venta-1', motivo: null, user: adminUser }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
	});
});
