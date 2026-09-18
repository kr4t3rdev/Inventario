/**
 * @description Tests de las server actions de devoluciones (DNC-T4.1):
 * auth, gates de feature/permiso y paso de datos al servicio.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockCtx, mockRegistrar } = vi.hoisted(() => ({
	mockCtx: vi.fn(),
	mockRegistrar: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		venta: { findFirst: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([]) },
		turnoPuntoVenta: { findFirst: vi.fn().mockResolvedValue(null) },
		devolucionVenta: { findMany: vi.fn().mockResolvedValue([]) },
	},
}));

vi.mock('@/features/ventas/services/devolucion-venta-service', () => ({
	DevolucionVentaService: { registrar: mockRegistrar },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
	getDevolucionContextoAction,
	registrarDevolucionAction,
	getDevolucionesDeVentaAction,
} from '@/features/ventas/actions-devoluciones';

const manager = {
	userId: 'u-1',
	role: 'user',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	isActive: true,
	planFeatures: { 'ventas-pos': true, facturacion: true, 'ventas-pedidos': true },
} as const;

describe('actions de devoluciones (DNC-T4)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('contexto exige sesión', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		const r = await getDevolucionContextoAction('v-1');
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('AUTH_REQUIRED');
	});

	it('contexto exige feature ventas-pos', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			planFeatures: {},
		} as never);
		const r = await getDevolucionContextoAction('v-1');
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('contexto devuelve disponibilidad por ítem y saldo CxC', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager as never);
		vi.mocked(prisma.venta.findFirst).mockResolvedValue({
			ventaId: 'v-1',
			estado: 'FACTURADA',
			deletedAt: null,
			puntoDeVentaId: 'pv-1',
			clienteId: 'c-1',
			total: 1000,
			descuento: 0,
			cliente: { clienteId: 'c-1', nombre: 'Ana' },
			factura: { idFactura: 'f-1', numeroFactura: 'FV-000001' },
			items: [
				{
					id: 'vi-1',
					productoId: 'p-1',
					cantidad: 3,
					precioUnitario: 500,
					total: 1500,
					producto: { nombre: 'Café' },
				},
			],
			devoluciones: [
				{ devolucionId: 'd-1', total: 500, facturaNotaCreditoId: null, items: [{ ventaItemId: 'vi-1', cantidad: 1 }] },
			],
		} as never);
		vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
			{ id: 'c1', montoDeuda: 800, montoPagado: 200 },
		] as never);

		const r = await getDevolucionContextoAction('v-1');
		expect(r.success).toBe(true);
		if (r.success && r.data) {
			expect(r.data.items[0].disponible).toBe(2);
			expect(r.data.items[0].yaDevuelto).toBe(1);
			expect(r.data.saldoCxc).toBe(600);
			expect(r.data.venta.cliente?.nombre).toBe('Ana');
		}
	});

	it('registrar devuelve la respuesta del servicio', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager as never);
		mockRegistrar.mockResolvedValue({ devolucionId: 'd-9', total: 100, aplicadoCxc: 0, saldoFavor: 100, reembolso: 0, notaCreditoId: 'nc-1' });
		const r = await registrarDevolucionAction({
			ventaId: 'v-1',
			items: [{ ventaItemId: 'vi-1', cantidad: 1 }],
			motivo: 'Defectuoso',
			preferenciaFinanciera: 'SALDO_FAVOR',
			idempotencyKey: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
		});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data?.devolucionId).toBe('d-9');
		expect(mockRegistrar).toHaveBeenCalled();
	});
});
