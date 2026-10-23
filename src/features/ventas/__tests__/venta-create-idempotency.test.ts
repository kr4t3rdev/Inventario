import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));
vi.mock('@/features/inventario/movimientos', () => ({ registrarMovimiento: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({
	allocateFifoForSale: vi.fn(),
	getCostoFifoVentaValorado: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { logStrict: vi.fn() } }));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({
	applyFacturacionCobroWorkflow: vi.fn(),
}));

const { tx } = vi.hoisted(() => ({
	tx: {
		ventaCreateIdempotency: { create: vi.fn(), update: vi.fn() },
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: { create: vi.fn() },
		producto: { findUnique: vi.fn(), findMany: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		factura: { create: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
	},
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		puntoDeVenta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
		producto: { findMany: vi.fn() },
		$transaction: vi.fn((callback: (client: unknown) => unknown) => callback(tx)),
		ventaCreateIdempotency: { findUnique: vi.fn() },
	},
}));

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { createVentaSchema } from '@/features/ventas/schemas';
import { fingerprintVentaCreatePayload } from '@/features/ventas/services/venta-create-idempotency';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user = {
	userId: 'user-1',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	planFeatures: { 'ventas-pos': true },
	permissions: new Set(['ventas.venta.registrar']),
} as unknown as AuthenticatedUser;

const input = {
	puntoDeVentaId: 'pv-1',
	turnoId: 'turno-1',
	modoPedido: true,
	idempotencyKey: '  request-123  ',
	items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }],
};

const originalSale = {
	ventaId: 'venta-1',
	tenantId: 'tenant-1',
	productoId: null,
	cantidad: 2,
	puntoDeVentaId: 'pv-1',
	createdAt: new Date('2026-10-09T12:00:00.000Z'),
	updatedAt: new Date('2026-10-09T12:00:00.000Z'),
	empleadoId: null,
	total: 1000,
	clienteId: null,
	ordenId: null,
	descuento: 0,
	observaciones: null,
	esVentaUnica: true,
	ofertaId: null,
	ventaPadreId: null,
	montoRecibidoEfectivo: null,
	cambioDevuelto: null,
	estado: 'PEDIDO',
	metodoPago: null,
	montoCredito: null,
	montoEfectivo: null,
	montoTarjeta: null,
	montoTransferencia: null,
	turnoId: 'turno-1',
	deletedAt: null,
};
let storedReceipt: Record<string, unknown> | null;

beforeEach(() => {
	vi.clearAllMocks();
	storedReceipt = null;
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
		pvId: 'pv-1', listaPrecioId: null,
	} as never);
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null as never);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: 'prod-1', nombre: 'Product', precioVenta: 500, precios: [] },
	] as never);
	tx.venta.create.mockResolvedValue(originalSale);
	tx.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
	tx.producto.findMany.mockResolvedValue([
		{ id: 'prod-1', nombre: 'Product', precioVenta: 500, precios: [] },
	]);
	tx.ventaCreateIdempotency.create.mockImplementation(async ({ data }) => {
		if (storedReceipt) {
			throw new Prisma.PrismaClientKnownRequestError('duplicate receipt key', {
				code: 'P2002',
				clientVersion: 'test',
				meta: { target: ['tenantId', 'keyHash'] },
				batchRequestIdx: undefined,
			});
		}
		storedReceipt = { ...data };
		return storedReceipt as never;
	});
	tx.ventaCreateIdempotency.update.mockImplementation(async ({ data }) => {
		storedReceipt = { ...storedReceipt, ...data };
		return storedReceipt as never;
	});
	vi.mocked(prisma.ventaCreateIdempotency.findUnique).mockImplementation(
		() => Promise.resolve(storedReceipt) as never,
	);
});

describe('product sale creation idempotency', () => {
	it('retains an optional trimmed 1–64 character idempotency key', () => {
		expect(createVentaSchema.parse(input).idempotencyKey).toBe('request-123');
		expect(() => createVentaSchema.parse({ ...input, idempotencyKey: 'x'.repeat(65) }))
			.toThrow();
	});

	it('fingerprints all material parsed fields but normalizes key whitespace and defaults', () => {
		/** @description Parses and fingerprints a request without its idempotency key. */
		const fingerprint = (candidate: Record<string, unknown>) => {
			const { idempotencyKey: _key, ...payload } = createVentaSchema.parse(candidate);
			return fingerprintVentaCreatePayload(payload);
		};
		const baseline = fingerprint(input);
		expect(fingerprint({
			puntoDeVentaId: input.puntoDeVentaId,
			turnoId: input.turnoId,
			modoPedido: true,
			idempotencyKey: 'request-123',
			items: input.items,
			descuento: 0,
			cargoTransporte: 0,
		})).toBe(baseline);

		const changes: Array<Record<string, unknown>> = [
			{ items: [{ ...input.items[0], cantidad: 3 }] },
			{ items: [{ ...input.items[0], precioUnitario: 501 }] },
			{ items: [...input.items, input.items[0]] },
			{ items: [
				{ productoId: 'prod-1', cantidad: 1, precioUnitario: 500 },
				{ productoId: 'prod-2', cantidad: 1, precioUnitario: 250 },
			] },
			{ items: [
				{ productoId: 'prod-2', cantidad: 1, precioUnitario: 250 },
				{ productoId: 'prod-1', cantidad: 1, precioUnitario: 500 },
			] },
			{ metodoPago: 'EFECTIVO', montoEfectivo: 1000 },
			{ metodoPago: 'CREDITO', montoCredito: 1000 },
			{ montoTarjeta: 1 },
			{ clienteId: 'cliente-1' },
			{ empleadoId: 'empleado-1' },
			{ descuento: 1 },
			{ cargoTransporte: 1 },
			{ observaciones: 'note' },
			{ montoRecibidoEfectivo: 1 },
			{ cambioDevuelto: 1 },
			{ modoPedido: false },
			{ turnoId: 'turno-2' },
			{ tipoVencimiento: 'plazo' },
			{ fechaVencimiento: '2026-10-10' },
			{ cuentaBancariaId: 'account-1' },
			{ solicitarCreditoOverride: true },
			{ motivoCreditoOverride: 'approved' },
		];
		for (const change of changes) {
			expect(fingerprint({ ...input, ...change })).not.toBe(baseline);
		}
	});

	it('treats absent and null fields with identical sale semantics as equivalent', () => {
		const fingerprint = (candidate: Record<string, unknown>) => {
			const { idempotencyKey: _key, ...payload } = createVentaSchema.parse(candidate);
			return fingerprintVentaCreatePayload(payload);
		};
		expect(fingerprint(input)).toBe(fingerprint({
			...input,
			clienteId: null,
			empleadoId: null,
			observaciones: null,
			turnoId: 'turno-1',
			metodoPago: null,
			montoEfectivo: null,
			montoTarjeta: null,
			montoTransferencia: null,
			montoCredito: null,
			motivoCreditoOverride: null,
			montoRecibidoEfectivo: null,
			cambioDevuelto: null,
			tipoVencimiento: null,
			fechaVencimiento: null,
			cuentaBancariaId: null,
			modoPedido: true,
			solicitarCreditoOverride: false,
		}));
	});

	it('replays the original sale instead of creating a second sale for the same request', async () => {
		const first = await VentaMutationService.create({ input, user });
		const retry = await VentaMutationService.create({ input, user });

		expect(first.ventaId).toBe('venta-1');
		expect(retry).toEqual(originalSale);
		expect(tx.venta.create).toHaveBeenCalledOnce();
		expect(tx.ventaCreateIdempotency.create.mock.invocationCallOrder[0])
			.toBeLessThan(tx.puntoDeVenta.findFirst.mock.invocationCallOrder[0]);
		expect(tx.producto.findMany).toHaveBeenCalledOnce();
	});

	it('rejects a reused key when any canonical payload field changes', async () => {
		await VentaMutationService.create({ input, user });
		await expect(VentaMutationService.create({
			input: { ...input, descuento: 1 },
			user,
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
		expect(tx.venta.create).toHaveBeenCalledOnce();
		expect(tx.producto.findMany).toHaveBeenCalledOnce();
	});
});
