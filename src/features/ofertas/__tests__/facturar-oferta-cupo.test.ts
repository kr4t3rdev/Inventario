/**
 * @description Tests del protocolo de cupo en `facturarOfertaAction` (writer
 * de CxC fuera del protocolo, detectado en el cierre del change
 * remediacion-integridad-ventas-credito-fiscal): la facturación de una oferta
 * con vencimiento crea CxC — exige validar el límite del cliente bajo el lock
 * dentro de la transacción, con override por origen y motivo, y auditarlo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
	applyFacturacionCobroWorkflow: vi.fn().mockResolvedValue({
		tipoVencimiento: 'plazo', reconciliacionId: null,
	}),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({
	getOrCreateTurnoActivo: vi.fn().mockResolvedValue({
		success: true, data: { turnoId: 'turno-1' },
	}),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({ allocateFifoForSale: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

const { mockTx } = vi.hoisted(() => ({
	mockTx: {
		$queryRaw: vi.fn().mockResolvedValue([]),
		oferta: { update: vi.fn() },
		venta: { create: vi.fn().mockResolvedValue({ ventaId: 'ven-1' }) },
		ventaServicios: { create: vi.fn() },
		servicios: { findFirst: vi.fn() },
		factura: { create: vi.fn().mockResolvedValue({ idFactura: 'fac-1' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
		cuentaPorCobrar: {
			findFirst: vi.fn().mockResolvedValue(null),
			findMany: vi.fn().mockResolvedValue([]),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		cliente: { findFirst: vi.fn() },
		serieFacturacion: {
			findFirst: vi.fn().mockResolvedValue({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 5, esPorDefecto: true }),
			create: vi.fn(),
			update: vi.fn().mockResolvedValue({ serieId: 'serie-1', consecutivo: 6 }),
		},
		producto: { findUnique: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
	},
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		oferta: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
		cliente: { findFirst: vi.fn() },
		producto: { findFirst: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
	},
}));

// Espías pass-through para verificar el permiso del origen.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
	return {
		...actual,
		requireFeature: vi.fn(actual.requireFeature),
		requirePermission: vi.fn(actual.requirePermission),
		requireTenant: vi.fn(actual.requireTenant),
	};
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { facturarOfertaAction } from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager = {
	userId: 'u-1', name: 'Manager', email: 'm@test.com',
	role: 'user', isActive: true, tenantId: 'tenant-1', tenantRole: 'manager',
	planFeatures: { ofertas: true },
	permissions: new Set<string>(['ventas.ofertas.gestionar']),
} as unknown as AuthenticatedUser;

const ofertaConCredito = {
	id: 'of-1', numeroOferta: 'OF-000001', estado: 'PENDIENTE', clienteId: 'cli-1',
	tenantId: 'tenant-1', subtotal: 1000, impuestos: 0, total: 1000,
	items: [{ productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 }],
	cliente: { clienteId: 'cli-1', nombre: 'Cliente' },
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getCurrentUser).mockResolvedValue(manager);
	mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'cli-1', limiteCredito: 100 });
	mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
	mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null);
	mockTx.producto.findUnique.mockResolvedValue({
		id: 'prod-1', nombre: 'Producto Test', tenantId: 'tenant-1',
	});
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaConCredito as never);
});

describe('protocolo de cupo en facturarOfertaAction', () => {
	it('facturar con vencimiento y cupo agotado se rechaza antes de crear venta/factura', async () => {
		const result = await facturarOfertaAction({
			ofertaId: 'of-1', puntoDeVentaId: 'pv-1',
			tipoVencimiento: 'plazo',
		} as never);

		expect(result).toMatchObject({ success: false, error: { code: 'CREDITO_EXCEDIDO' } });
		expect(mockTx.venta.create).not.toHaveBeenCalled();
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});

	it('el cupo se valida bajo el lock dentro de la transacción (FOR UPDATE antes de leer)', async () => {
		await facturarOfertaAction({
			ofertaId: 'of-1', puntoDeVentaId: 'pv-1',
			tipoVencimiento: 'plazo',
		} as never);

		expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
		const sql = String(mockTx.$queryRaw.mock.calls[0][0]);
		expect(sql).toContain('FOR UPDATE');
		expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
			mockTx.venta.create.mock.invocationCallOrder[0] ?? Infinity,
		);
	});

	it('override con permiso del origen + motivo audita estricto en la transacción', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			permissions: new Set<string>(['ventas.ofertas.gestionar', 'ventas.venta.credito-override']),
		} as AuthenticatedUser);

		const result = await facturarOfertaAction({
			ofertaId: 'of-1', puntoDeVentaId: 'pv-1',
			tipoVencimiento: 'plazo',
			solicitarCreditoOverride: true,
			motivoCreditoOverride: 'Oferta autorizada por gerencia',
		} as never);

		expect(result).toMatchObject({ success: true });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(), 'ventas.venta.credito-override', expect.any(String),
		);
		expect(AuditLogService.logStrict).toHaveBeenCalledWith(
			expect.objectContaining({
				detalles: expect.objectContaining({
					tipo: 'CREDITO_OVERRIDE',
					motivo: 'Oferta autorizada por gerencia',
				}),
			}),
			mockTx,
		);
	});

	it('oferta sin vencimiento (contra_pago) no consume cupo y no valida límite', async () => {
		const result = await facturarOfertaAction({
			ofertaId: 'of-1', puntoDeVentaId: 'pv-1',
		} as never);
		expect(mockTx.$queryRaw).not.toHaveBeenCalled();
		expect(AuditLogService.logStrict).not.toHaveBeenCalled();
	});
});
