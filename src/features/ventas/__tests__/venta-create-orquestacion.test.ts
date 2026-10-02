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
	getCostoFifoVentaValorado: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: vi.fn().mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' }),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
	applyFacturacionCobroWorkflow: vi.fn(),
}));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn(),
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
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
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
	vi.mocked(getCostoFifoVentaValorado).mockResolvedValue(null);
	vi.mocked(postEvento).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
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
	it('off conserva el flujo legacy y no resuelve moneda formal para FIFO', async () => {
		const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'off';
		try {
			await expect(VentaMutationService.create({
				input: { puntoDeVentaId: 'pv-1', items, metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
				user: adminUser,
			})).resolves.toEqual({ ventaId: 'v-1' });
			expect(getCostoFifoVentaValorado).not.toHaveBeenCalled();
			expect(postEvento).not.toHaveBeenCalled();
		} finally {
			if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
		}
	});

	it('postea COGS en moneda funcional con el costo FIFO persistido', async () => {
		const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		vi.mocked(getCostoFifoVentaValorado).mockResolvedValue({
			montoFuncional: new Prisma.Decimal('7200'),
			monedaFuncional: 'CUP',
			cantidadValorada: 2,
		});
		try {
			await VentaMutationService.create({
				input: { puntoDeVentaId: 'pv-1', items, metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
				user: adminUser,
			});

			expect(getCostoFifoVentaValorado).toHaveBeenCalledWith(mockTx, 'tenant-1', 'v-1');
			expect(postEvento).toHaveBeenCalledWith(
				mockTx,
				{ tenantId: 'tenant-1', userId: 'user-1' },
				expect.objectContaining({
					tipo: 'COSTO_VENTA_DEVENGADO',
					moneda: 'CUP',
					monedaFuncional: 'CUP',
					monto: new Prisma.Decimal('7200'),
					montoFuncional: new Prisma.Decimal('7200'),
					auxiliares: { costoFifo: new Prisma.Decimal('7200') },
				}),
			);
		} finally {
			if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
		}
	});

	it('en shadow conserva la venta y reporta costo no valorizado', async () => {
		const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
		vi.mocked(getCostoFifoVentaValorado).mockRejectedValue(
			new ActionError('La compra origen no tiene FX verificable', 'FX_INSUFICIENTE'),
		);
		try {
			await expect(VentaMutationService.create({
				input: { puntoDeVentaId: 'pv-1', items, metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
				user: adminUser,
			})).resolves.toEqual({ ventaId: 'v-1' });

			expect(mockTx.venta.create).toHaveBeenCalledOnce();
			const [, , evento] = vi.mocked(postEvento).mock.calls[0];
			expect(evento).toMatchObject({
				tipo: 'COSTO_VENTA_DEVENGADO',
				moneda: null,
				monedaFuncional: null,
				montoFuncional: null,
			});
		} finally {
			if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
		}
	});

	it('en enforce revierte la orquestación si el costo FIFO carece de FX', async () => {
		const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		vi.mocked(getCostoFifoVentaValorado).mockRejectedValue(
			new ActionError('La compra origen no tiene FX verificable', 'FX_INSUFICIENTE'),
		);
		try {
			await expect(VentaMutationService.create({
				input: { puntoDeVentaId: 'pv-1', items, metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
				user: adminUser,
			})).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
			expect(postEvento).not.toHaveBeenCalled();
		} finally {
			if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
			else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
		}
	});

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

	it('persiste recibido y vuelto derivado en ventas de efectivo (VC-T2)', async () => {
		await VentaMutationService.create({
			input: {
				puntoDeVentaId: 'pv-1',
				items,
				metodoPago: 'EFECTIVO',
				montoEfectivo: 1000,
				montoRecibidoEfectivo: 1500,
			},
			user: adminUser,
		});
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					montoRecibidoEfectivo: 1500,
					cambioDevuelto: 500,
				}),
			}),
		);
	});

	it('sin efectivo los campos de vuelto quedan nulos', async () => {
		await VentaMutationService.create({
			input: {
				puntoDeVentaId: 'pv-1',
				items,
				metodoPago: 'TARJETA',
				montoTarjeta: 1000,
			},
			user: adminUser,
		});
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					montoRecibidoEfectivo: null,
					cambioDevuelto: null,
				}),
			}),
		);
	});

	it('la respuesta conserva la forma actual (venta creada)', async () => {
		const result = await VentaMutationService.create({
			input: { puntoDeVentaId: 'pv-1', items },
			user: adminUser,
		});
		expect(result).toEqual({ ventaId: 'v-1' });
	});
});
