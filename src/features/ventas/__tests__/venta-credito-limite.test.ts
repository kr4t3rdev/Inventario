/**
 * @description Enforcement del límite de crédito en `create` (CRM-T2): si la
 * venta iría a crédito y el total supera el tope del cliente, se rechaza con
 * CREDITO_EXCEDIDO — salvo permiso `ventas.venta.credito-override` (auditado).
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
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn(),
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
		cuentaPorCobrar: { findMany: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
	};
	return { mockTx };
});

vi.mock('@/lib/prisma', () => ({
	prisma: {
		puntoDeVenta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
		producto: { findMany: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn() },
		$transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
	},
}));

import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
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

function prepararEntorno(opts: { limiteCredito: number | null; saldoCxc: number }) {
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
		pvId: 'pv-1',
		listaPrecioId: null,
	} as never);
	// Turno ABIERTO existente dentro de la tx (3.2.c.iii).
	mockTx.turnoPuntoVenta.findFirst.mockResolvedValue({ id: 't-1' });
	mockTx.puntoDeVenta.findFirst.mockResolvedValue({ tipoCaja: 'MOVIL' });
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
		listaPrecioId: null,
	} as never);
	mockTx.cliente.findFirst.mockResolvedValue({
		clienteId: 'c-1',
		limiteCredito: opts.limiteCredito,
	} as never);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: 'prod-1', nombre: 'Producto', precioVenta: 1000, precios: [] },
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
	mockTx.serieFacturacion.findFirst.mockResolvedValue({
		serieId: 's-1',
		prefijo: 'FV',
	});
	mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
	mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
	mockTx.cuentaPorCobrar.findMany.mockResolvedValue(
		opts.saldoCxc > 0
			? [{ id: 'cxc-1', montoDeuda: opts.saldoCxc, montoPagado: 0, estado: 'PENDIENTE', monedaOriginal: 'CUP' }]
			: [],
	);
}

const baseVentaACredito = {
	puntoDeVentaId: 'pv-1',
	clienteId: 'c-1',
	items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000 }],
	metodoPago: 'CREDITO' as const,
	montoCredito: 1000,
};

describe('enforcement del límite de crédito (CRM-T2)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sin límite configurado el crédito pasa siempre', async () => {
		prepararEntorno({ limiteCredito: null, saldoCxc: 0 });
		const r = await VentaMutationService.create({ input: baseVentaACredito, user: manager });
		expect(r).toEqual({ ventaId: 'v-1' });
	});

	it('dentro del límite pasa sin alerta', async () => {
		prepararEntorno({ limiteCredito: 2000, saldoCxc: 500 });
		const r = await VentaMutationService.create({ input: baseVentaACredito, user: manager });
		expect(r.ventaId).toBe('v-1');
		expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
		expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
			mockTx.venta.create.mock.invocationCallOrder[0] ?? Infinity,
		);
	});

	it('superar el tope sin permiso → CREDITO_EXCEDIDO, sin crear venta', async () => {
		prepararEntorno({ limiteCredito: 1000, saldoCxc: 800 });
		const dependiente = { ...manager, tenantRole: 'dependiente' } as unknown as AuthenticatedUser;
		await expect(
			VentaMutationService.create({ input: baseVentaACredito, user: dependiente }),
		).rejects.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it('con el permiso override pasa y queda auditado', async () => {
		prepararEntorno({ limiteCredito: 1000, saldoCxc: 800 });
		const managerConOverride = {
			...manager,
			role: 'admin',
		} as unknown as AuthenticatedUser;
		const r = await VentaMutationService.create({
			input: {
				...baseVentaACredito,
				solicitarCreditoOverride: true,
				motivoCreditoOverride: 'Autorización aprobada',
			},
			user: managerConOverride,
		});
		expect(r.ventaId).toBe('v-1');
		expect(AuditLogService.logStrict).toHaveBeenCalledWith(
			expect.objectContaining({ detalles: expect.objectContaining({ tipo: 'CREDITO_OVERRIDE' }) }),
			expect.anything(),
		);
	});

	it('reintenta la transacción completa ante P2034 y confirma la venta', async () => {
		prepararEntorno({ limiteCredito: null, saldoCxc: 0 });
		const delegado = vi.mocked(prisma.$transaction).getMockImplementation();
		let llamadas = 0;
		vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => unknown) => {
			llamadas += 1;
			if (llamadas === 1) {
				const error = new Error('Transaction conflict or write conflict') as Error & { code: string };
				error.code = 'P2034';
				throw error;
			}
			return (delegado as (cb: (tx: unknown) => unknown) => unknown)(cb);
		}) as never);

		const r = await VentaMutationService.create({ input: baseVentaACredito, user: manager });

		expect(r).toEqual({ ventaId: 'v-1' });
		expect(llamadas).toBe(2);
		expect(mockTx.venta.create).toHaveBeenCalledOnce();
	});
});
