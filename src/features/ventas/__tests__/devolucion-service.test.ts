/**
 * @description Tests del servicio transaccional de devoluciones (DNC-T3):
 * registro idempotente con stock/kardex/FIFO, nota de crédito con serie propia
 * y cascada financiera (CxC → saldo a favor / reembolso).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', () => ({
	registrarMovimiento: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
	restaurarAllocacionesFifo: vi.fn().mockResolvedValue({ restaurado: 2, costoTotal: 600 }),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
	createAnticipoDevolucion: vi.fn().mockResolvedValue({ anticipoId: 'ant-1' }),
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn(),
		venta: { findUnique: vi.fn() },
		devolucionVenta: {
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			aggregate: vi.fn().mockResolvedValue({ _sum: { descuento: 0 } }),
		},
		devolucionVentaItem: { findMany: vi.fn(), create: vi.fn() },
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
		factura: { create: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn(), update: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn() },
	};
	return { mockTx };
});

vi.mock('@/lib/prisma', () => ({
	prisma: {
		venta: { findUnique: vi.fn() },
		devolucionVenta: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
	},
}));

import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';
import { createAnticipoDevolucion } from '@/lib/services/anticipos-workflow';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { DevolucionVentaService } from '@/features/ventas/services/devolucion-venta-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const admin = {
	userId: 'u-1',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { 'ventas-pos': true, facturacion: true },
} as unknown as AuthenticatedUser;

const KEY = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const ventaEntregada = {
	ventaId: 'v-1',
	tenantId: 'tenant-1',
	estado: 'FACTURADA',
	deletedAt: null,
	puntoDeVentaId: 'pv-1',
	clienteId: 'c-1',
	descuento: 0,
	total: 1500,
	factura: { idFactura: 'f-1', tasaCambio: 1 },
	items: [
		{
			id: 'vi-1',
			productoId: 'p-1',
			cantidad: 3,
			precioUnitario: 500,
			total: 1500,
			producto: { almacenId: 'alm-1', precioCosto: 300, tenantId: 'tenant-1' },
		},
	],
};

function preparar(opts: { cxcSaldo?: number; turnoAbierto?: boolean } = {}) {
	const { cxcSaldo = 0, turnoAbierto = false } = opts;
	vi.mocked(prisma.venta.findUnique).mockResolvedValue(ventaEntregada as never);
	vi.mocked(prisma.devolucionVenta.findFirst).mockResolvedValue(null);
	mockTx.venta.findUnique.mockResolvedValue(ventaEntregada as never);
	mockTx.devolucionVenta.findFirst.mockResolvedValue(null);
	mockTx.devolucionVentaItem.findMany.mockResolvedValue([]);
	mockTx.devolucionVenta.create.mockResolvedValue({ devolucionId: 'dev-1' });
	mockTx.devolucionVenta.update.mockResolvedValue({ devolucionId: 'dev-1' });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({
		serieId: 's-nc',
		prefijo: 'NC',
		consecutivo: 1,
	});
	mockTx.serieFacturacion.upsert.mockResolvedValue({ serieId: 's-nc', prefijo: 'NC' });
	mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
	mockTx.factura.create.mockResolvedValue({ idFactura: 'nc-1' });
	mockTx.cuentaPorCobrar.findMany.mockResolvedValue(
		cxcSaldo > 0
			? [{ id: 'cxc-1', montoDeuda: cxcSaldo, montoPagado: 0, estado: 'PENDIENTE' }]
			: [],
	);
	mockTx.turnoPuntoVenta.findFirst.mockResolvedValue(
		turnoAbierto ? { id: 't-1', estado: 'ABIERTO' } : null,
	);
}

const inputBase = {
	ventaId: 'v-1',
	items: [{ ventaItemId: 'vi-1', cantidad: 2 }],
	motivo: 'Producto defectuoso',
	preferenciaFinanciera: 'SALDO_FAVOR' as const,
	idempotencyKey: KEY,
};

describe('DevolucionVentaService.registrar (DNC-T3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('registra devolución parcial con NC y saldo a favor (sin CxC)', async () => {
		preparar({ cxcSaldo: 0 });
		const r = await DevolucionVentaService.registrar({ input: inputBase, user: admin });

		expect(r.devolucionId).toBe('dev-1');
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				ubicacionId: 'pv-1',
				tipoUbicacion: 'punto_venta',
				delta: 2,
			}),
		);
		expect(registrarMovimiento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tipoOrigen: 'VENTA',
				origenId: 'dev-1',
				cantidad: 2,
				costoUnitario: 300,
			}),
		);
		expect(restaurarAllocacionesFifo).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ ventaItemId: 'vi-1', cantidad: 2 }),
		);
		expect(mockTx.factura.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tipoDocumento: 'NOTA_CREDITO',
					numeroFactura: 'NC-000001',
					tasaCambio: 1,
					estado: 'PAGADA',
				}),
			}),
		);
		expect(createAnticipoDevolucion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ monto: 1000, clienteId: 'c-1', facturaId: 'nc-1' }),
		);
		expect(AuditLogService.logStrict).toHaveBeenCalled();
	});

	it('replay por idempotencyKey devuelve la existente sin efectos', async () => {
		preparar();
		vi.mocked(prisma.devolucionVenta.findFirst).mockResolvedValue({
			devolucionId: 'dev-previa',
			ventaId: 'v-1',
		} as never);
		const r = await DevolucionVentaService.registrar({ input: inputBase, user: admin });
		expect(r.devolucionId).toBe('dev-previa');
		expect(mockTx.devolucionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza venta de otro tenant', async () => {
		preparar();
		vi.mocked(prisma.venta.findUnique).mockResolvedValue(null);
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: admin }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('rechaza venta anulada', async () => {
		preparar();
		vi.mocked(prisma.venta.findUnique).mockResolvedValue({
			...ventaEntregada,
			deletedAt: new Date(),
			estado: 'ANULADA',
		} as never);
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: admin }),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
	});

	it('rechaza devolución sobre un PEDIDO (sin mercancía entregada)', async () => {
		preparar();
		vi.mocked(prisma.venta.findUnique).mockResolvedValue({
			...ventaEntregada,
			estado: 'PEDIDO',
		} as never);
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: admin }),
		).rejects.toMatchObject({ code: 'DEVOLUCION_NO_APLICA' });
	});

	it('rechaza cantidad superior a la disponible', async () => {
		preparar();
		await expect(
			DevolucionVentaService.registrar({
				input: { ...inputBase, items: [{ ventaItemId: 'vi-1', cantidad: 5 }] },
				user: admin,
			}),
		).rejects.toMatchObject({ code: 'CANTIDAD_EXCEDIDA' });
	});

	it('rechaza replay de la clave usada en otra venta (IDEMPOTENCIA_CONFLICTO)', async () => {
		preparar();
		vi.mocked(prisma.devolucionVenta.findFirst).mockResolvedValue({
			devolucionId: 'dev-previa',
			ventaId: 'v-otra',
		} as never);
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: admin }),
		).rejects.toMatchObject({ code: 'IDEMPOTENCIA_CONFLICTO' });
	});

	it('venta sin cliente con excedente → guía a reembolso (CLIENTE_REQUERIDO)', async () => {
		preparar();
		vi.mocked(prisma.venta.findUnique).mockResolvedValue({
			...ventaEntregada,
			clienteId: null,
			factura: null,
		} as never);
		mockTx.venta.findUnique.mockResolvedValue({
			...ventaEntregada,
			clienteId: null,
			factura: null,
		} as never);
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: admin }),
		).rejects.toMatchObject({ code: 'CLIENTE_REQUERIDO' });
	});

	it('aplica la cascada en orden a varias CxC de la venta', async () => {
		preparar({ cxcSaldo: 0 });
		mockTx.cuentaPorCobrar.findMany.mockResolvedValue([
			{ id: 'cxc-1', montoDeuda: 300, montoPagado: 0 },
			{ id: 'cxc-2', montoDeuda: 500, montoPagado: 400 },
		]);
		const r = await DevolucionVentaService.registrar({ input: inputBase, user: admin });
		// total 1000: cubre 300 (PAGADA) + 100 (PAGADA, saldo 100) → excedente 600 a saldo
		expect(mockTx.cuentaPorCobrar.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'cxc-1' },
				data: expect.objectContaining({ montoPagado: 300, estado: 'PAGADA' }),
			}),
		);
		expect(mockTx.cuentaPorCobrar.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'cxc-2' },
				data: expect.objectContaining({ montoPagado: 500, estado: 'PAGADA' }),
			}),
		);
		expect(r.aplicadoCxc).toBe(400);
		expect(r.saldoFavor).toBe(600);
	});

	it('reduce la CxC primero cuando hay saldo pendiente', async () => {
		preparar({ cxcSaldo: 1500 });
		const r = await DevolucionVentaService.registrar({ input: inputBase, user: admin });
		expect(mockTx.cuentaPorCobrar.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'cxc-1' },
				data: expect.objectContaining({ montoPagado: 1000, estado: 'PARCIAL' }),
			}),
		);
		expect(r.aplicadoCxc).toBe(1000);
		expect(r.saldoFavor).toBe(0);
		expect(createAnticipoDevolucion).not.toHaveBeenCalled();
	});

	it('sin feature facturacion registra sin nota de crédito', async () => {
		preparar();
		const userPlanBasico = {
			...admin,
			role: 'user',
			tenantRole: 'manager',
			planFeatures: { 'ventas-pos': true },
		} as unknown as AuthenticatedUser;
		const r = await DevolucionVentaService.registrar({ input: inputBase, user: userPlanBasico });
		expect(r.notaCreditoId).toBeNull();
		expect(mockTx.factura.create).not.toHaveBeenCalled();
		// El resto de efectos sí se aplican
		expect(upsertStockUbicacion).toHaveBeenCalled();
	});

	it('sin permiso ventas.devolucion.registrar → FORBIDDEN', async () => {
		preparar();
		const dependiente = {
			...admin,
			role: 'user',
			tenantRole: 'dependiente',
			planFeatures: { 'ventas-pos': true, facturacion: true },
		} as unknown as AuthenticatedUser;
		await expect(
			DevolucionVentaService.registrar({ input: inputBase, user: dependiente }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('reembolso en efectivo con turno abierto ligado', async () => {
		preparar({ turnoAbierto: true });
		const r = await DevolucionVentaService.registrar({
			input: { ...inputBase, preferenciaFinanciera: 'REEMBOLSO_EFECTIVO' },
			user: admin,
		});
		expect(r.reembolso).toBe(1000);
		expect(mockTx.devolucionVenta.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ turnoReembolsoId: 't-1', montoReembolsado: 1000 }),
			}),
		);
	});

	it('reembolso sin turno abierto → REEMBOLSO_SIN_TURNO', async () => {
		preparar({ turnoAbierto: false });
		await expect(
			DevolucionVentaService.registrar({
				input: { ...inputBase, preferenciaFinanciera: 'REEMBOLSO_EFECTIVO' },
				user: admin,
			}),
		).rejects.toMatchObject({ code: 'REEMBOLSO_SIN_TURNO' });
	});
});
