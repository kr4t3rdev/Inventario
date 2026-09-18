/**
 * @description Tests del emisor fiscal y su ciclo (FE-T2): orquestador idempotente
 * por factura y procesamiento con adaptador LOCAL (sin red).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: {
		fiscalDocument: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			upsert: vi.fn(),
			findMany: vi.fn(),
		},
		fiscalEmisionEvent: { create: vi.fn() },
	},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { FiscalEmisionService } from '@/features/facturas/services/fiscal-emision-service';
import { LocalAdapter } from '@/features/facturas/services/fiscal/local-adapter';

const facturaStub = {
	idFactura: 'fac-1',
	tenantId: 'tenant-1',
	numeroFactura: 'FV-000001',
	tipoDocumento: 'FACTURA',
	total: 1000,
	subtotal: 1000,
	descuento: 0,
	cliente: { nombre: 'Cliente' },
};

describe('FiscalEmisionService (FE-T2)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.fiscalDocument.upsert.mockImplementation(({ create }: any) =>
			Promise.resolve({ fiscalDocumentId: 'doc-1', estado: 'PENDIENTE', ...create }),
		);
		mockPrisma.fiscalDocument.update.mockImplementation(({ where, data }: any) =>
			Promise.resolve({ fiscalDocumentId: where.fiscalDocumentId, ...data }),
		);
	});

	it('registrarEmisionPendiente crea documento + evento y es idempotente', async () => {
		const r1 = await FiscalEmisionService.registrarEmisionPendiente({
			tenantId: 'tenant-1',
			factura: facturaStub as never,
		});
		expect(r1.fiscalDocumentId).toBe('doc-1');
		expect(mockPrisma.fiscalDocument.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { facturaId: 'fac-1' },
				create: expect.objectContaining({
					tenantId: 'tenant-1',
					facturaId: 'fac-1',
					estado: 'PENDIENTE',
					eventos: {
						create: expect.objectContaining({ estado: 'GENERADO' }),
					},
				}),
				update: {},
			}),
		);

		// Segundo llamado con la misma factura: upsert es idempotente por `facturaId`
		const r2 = await FiscalEmisionService.registrarEmisionPendiente({
			tenantId: 'tenant-1',
			factura: facturaStub as never,
		});
		expect(r2.fiscalDocumentId).toBe('doc-1');
		// No se crea dos veces: el upsert se invoca dos veces pero `update:{}` es no-op.
		expect(mockPrisma.fiscalDocument.upsert).toHaveBeenCalledTimes(2);
	});

	it('procesarSiguientePendiente con LocalAdapter → TIMBRADA con uuid y eventos', async () => {
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			estado: 'PENDIENTE',
			factura: facturaStub,
		});
		const r = await FiscalEmisionService.procesarSiguientePendiente('tenant-1', LocalAdapter);
		expect(r?.estado).toBe('TIMBRADA');
		expect(r?.uuidExterno).toMatch(/^LOCAL-/);
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estado: 'PROCESANDO' }) }),
		);
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estado: 'TIMBRADO' }) }),
		);
	});

	it('error del adaptador → RECHAZADA con intento y mensaje', async () => {
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			estado: 'PENDIENTE',
			intentos: 0,
			factura: facturaStub,
		});
		const adapterRoto = {
			jurisdiccion: 'LOCAL',
			generar: vi.fn().mockRejectedValue(new Error('PAC fuera de servicio')),
		};
		const r = await FiscalEmisionService.procesarSiguientePendiente('tenant-1', adapterRoto as never);
		expect(r?.estado).toBe('RECHAZADA');
		expect(mockPrisma.fiscalDocument.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					estado: 'RECHAZADA',
					intentos: { increment: 1 },
				}),
			}),
		);
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estado: 'RECHAZADO' }) }),
		);
	});

	it('sin pendientes devuelve null', async () => {
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue(null);
		const r = await FiscalEmisionService.procesarSiguientePendiente('tenant-1', LocalAdapter);
		expect(r).toBeNull();
	});
});
