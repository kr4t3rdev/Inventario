/**
 * @description Tests de conversión de oferta a pedido de venta (PVE-T4):
 * crea la venta en estado PEDIDO sin efectos, vinculada por ofertaId,
 * con idempotencia ante doble conversión.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn(),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		venta: { create: vi.fn() },
		oferta: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
	};
	return { mockTx };
});

vi.mock('@/lib/prisma', () => ({
	prisma: {
		oferta: { findFirst: vi.fn() },
		venta: { findFirst: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
	},
}));

import { prisma } from '@/lib/prisma';
import { convertirOfertaAPedido } from '@/features/ofertas/services/convertir-oferta-pedido';

const oferta = {
	id: 'of-1',
	tenantId: 'tenant-1',
	estado: 'PENDIENTE',
	clienteId: 'c-1',
	subtotal: 1000,
	descuento: 0,
	impuestos: 0,
	total: 1000,
	items: [
		{
			productoId: 'p-1',
			servicioId: null,
			cantidad: 2,
			precioUnitario: 500,
			total: 1000,
		},
	],
};

describe('convertirOfertaAPedido (PVE-T4)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.oferta.findFirst).mockResolvedValue(oferta as never);
		vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({ pvId: 'pv-1' } as never);
		mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
		vi.mocked(prisma.venta.findFirst).mockResolvedValue(null);
		mockTx.venta.create.mockResolvedValue({ ventaId: 'v-99' });
	});

	it('crea la venta en PEDIDO con los items y marca la oferta ACEPTADA', async () => {
		const r = await convertirOfertaAPedido({
			ofertaId: 'of-1',
			puntoDeVentaId: 'pv-1',
			tenantId: 'tenant-1',
		});
		expect(r.ventaId).toBe('v-99');
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					estado: 'PEDIDO',
					ofertaId: 'of-1',
					puntoDeVentaId: 'pv-1',
					clienteId: 'c-1',
					metodoPago: null,
					items: {
						create: [
							expect.objectContaining({
								productoId: 'p-1',
								cantidad: 2,
								precioUnitario: 500,
							}),
						],
					},
				}),
			}),
		);
		expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: 'of-1', estado: { in: ['PENDIENTE', 'ACEPTADA'] } }),
				data: { estado: 'ACEPTADA' },
			}),
		);
	});

	it('es idempotente: segunda conversión devuelve el pedido existente', async () => {
		vi.mocked(prisma.venta.findFirst).mockResolvedValue({
			ventaId: 'v-previa',
			estado: 'PEDIDO',
		} as never);
		const r = await convertirOfertaAPedido({
			ofertaId: 'of-1',
			puntoDeVentaId: 'pv-1',
			tenantId: 'tenant-1',
		});
		expect(r.ventaId).toBe('v-previa');
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('rechaza ofertas FACTURADAS o RECHAZADAS', async () => {
		vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
			...oferta,
			estado: 'FACTURADA',
		} as never);
		await expect(
			convertirOfertaAPedido({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tenantId: 'tenant-1',
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
	});

	it('rechaza un punto de venta que no pertenece al tenant', async () => {
		vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);
		await expect(
			convertirOfertaAPedido({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-ajeno',
				tenantId: 'tenant-1',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('falla si la oferta cambió de estado en la carrera (guarda atómica)', async () => {
		mockTx.oferta.updateMany.mockResolvedValue({ count: 0 });
		await expect(
			convertirOfertaAPedido({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tenantId: 'tenant-1',
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
	});

	it('rechaza ofertas con ítems de servicio (solo productos)', async () => {
		vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
			...oferta,
			items: [
				{ productoId: null, servicioId: 's-1', cantidad: 1, precioUnitario: 100, total: 100 },
			],
		} as never);
		await expect(
			convertirOfertaAPedido({
				ofertaId: 'of-1',
				puntoDeVentaId: 'pv-1',
				tenantId: 'tenant-1',
			}),
		).rejects.toMatchObject({ code: 'NOT_SUPPORTED' });
	});
});
