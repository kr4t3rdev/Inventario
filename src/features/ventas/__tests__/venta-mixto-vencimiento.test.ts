/**
 * @description Tests de la porción cobrada hoy en ventas MIXTO con vencimiento
 * (tarea 3.2.c): el caller pasa `montoCobradoContado` al workflow, el cupo
 * cuenta sólo el remanente (deuda realmente pendiente) y una porción que cubre
 * el total no crea CxC.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));
vi.mock('@/features/inventario/movimientos', () => ({ registrarMovimiento: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({
	allocateFifoForSale: vi.fn(),
	getCostoFifoVentaValorado: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn(),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: vi.fn().mockResolvedValue(undefined),
}));
const workflowSpy = vi.hoisted(() => vi.fn().mockResolvedValue({ tipoVencimiento: 'fecha', reconciliacionId: null }));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
	applyFacturacionCobroWorkflow: workflowSpy,
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn().mockResolvedValue([]),
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: { create: vi.fn().mockResolvedValue({ ventaId: 'v-1' }) },
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		factura: { create: vi.fn().mockResolvedValue({ idFactura: 'fac-1' }) },
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
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager = {
	userId: 'u-1',
	role: 'user',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { facturacion: true, 'ventas-factura': true, 'ventas-pos': true },
} as unknown as AuthenticatedUser;

/** Venta MIXTO 40 efectivo + 60 crédito, producto a 100, con vencimiento fecha. */
const ventaMixtoVencimiento = {
	puntoDeVentaId: 'pv-1',
	clienteId: 'c-1',
	items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 100 }],
	metodoPago: 'MIXTO' as const,
	montoEfectivo: 40,
	montoCredito: 60,
	tipoVencimiento: 'fecha' as const,
	fechaVencimiento: '2026-10-10',
};

beforeEach(() => {
	vi.clearAllMocks();
	workflowSpy.mockClear();
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null } as never);
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ listaPrecioId: null } as never);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: 'prod-1', nombre: 'Producto', precioVenta: 100, precios: [] },
	] as never);
	mockTx.producto.findUnique.mockResolvedValue({
		id: 'prod-1', nombre: 'Producto', stock: 10, precioCosto: 30,
		almacenId: 'alm-1', tenantId: 'tenant-1',
	});
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({ serieId: 's-1', prefijo: 'FV' });
	mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
	mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
	mockTx.cliente.findFirst.mockImplementation(async (args?: { where?: { clienteId?: string } }) => {
		// Devuelve el límite fijo 80 para el cliente de la venta.
		if (args?.where?.clienteId === 'c-1') {
			return { clienteId: 'c-1', limiteCredito: 80 } as never;
		}
		return null as never;
	});
});

describe('create: MIXTO con vencimiento cobra hoy y deja el remanente como CxC', () => {
	it('pasa montoCobradoContado=40 al workflow y el cupo cuenta sólo el remanente 60', async () => {
		const r = await VentaMutationService.create({
			input: ventaMixtoVencimiento,
			user: manager,
		});

		expect(r).toEqual({ ventaId: 'v-1' });
		expect(workflowSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				montoTotal: 100,
				montoCobradoContado: 40,
				tipoVencimiento: 'fecha',
			}),
		);
	});

	it('el cupo rechaza cuando el remanente excede el límite (60 > 50), no el total', async () => {
		mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: 50 } as never);
		mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);

		await expect(
			VentaMutationService.create({ input: ventaMixtoVencimiento, user: manager }),
		).rejects.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
		expect(workflowSpy).not.toHaveBeenCalled();
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('CREDITO puro no declara porción cobrada: workflow recibe 0', async () => {
		// Sin límite configurado el cupo no decide; sólo se verifica el contrato
		// del desglose que recibe el workflow.
		mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: null } as never);

		await VentaMutationService.create({
			input: {
				...ventaMixtoVencimiento,
				metodoPago: 'CREDITO' as const,
				montoEfectivo: undefined,
				montoCredito: 100,
			},
			user: manager,
		});

		expect(workflowSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ montoCobradoContado: 0 }),
		);
	});
});
