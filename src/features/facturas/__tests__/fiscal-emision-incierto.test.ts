/**
 * @description Tests de la máquina de estados fiscal dirigida e incierta
 * (Phase 5, tareas 5.1/5.3/5.4 del change remediacion-integridad-ventas-credito-fiscal):
 * procesamiento dirigido a la factura solicitada (no al pendiente más
 * antiguo), claim atómico con attemptId, clasificación de fallos post-envío
 * como INCIERTA salvo rechazo definitivo autenticado, y bloqueo de
 * históricos ambiguos (PROCESANDO/INCIERTA nunca se reprocesan solos).
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
		},
		fiscalEmisionEvent: { create: vi.fn() },
	},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import {
	FiscalEmisionService,
} from '@/features/facturas/services/fiscal-emision-service';
import {
	FiscalRechazoDefinitivoError,
} from '@/features/facturas/services/fiscal/fiscal-adapter';
import { LocalAdapter } from '@/features/facturas/services/fiscal/local-adapter';

const facturaB = {
	idFactura: 'fac-B',
	tenantId: 'tenant-1',
	numeroFactura: 'FV-000002',
	tipoDocumento: 'FACTURA',
	total: 2000,
	subtotal: 2000,
	descuento: 0,
	cliente: { nombre: 'Cliente B' },
	tenant: {},
};

/** Claim exitoso por defecto (updateMany del claim). */
function claimGana() {
	mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 1 });
}
/** CAS perdedor (otro worker ganó el claim). */
function claimPierde() {
	mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 0 });
}

beforeEach(() => {
	vi.clearAllMocks();
	mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 1 });
	// Lookup post-claim y lectura final: devuelven el documento con su factura.
	mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
		fiscalDocumentId: 'doc-1',
		facturaId: 'fac-B',
		estado: 'TIMBRADA',
		factura: facturaB,
	});
});

describe('procesarFacturaPendiente (5.3): dirigido y con attemptId', () => {
	it('procesa exactamente la factura solicitada, no el pendiente más antiguo', async () => {
		claimGana();
		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: LocalAdapter,
		});

		expect(r?.estado).toBe('TIMBRADA');
		// El claim y el lookup van anclados a la factura solicitada.
		const claimArgs = mockPrisma.fiscalDocument.updateMany.mock.calls[0][0];
		expect(claimArgs.where).toMatchObject({ facturaId: 'fac-B', tenantId: 'tenant-1', estado: 'PENDIENTE' });
		// La finalización TIMBRADA es CAS por attemptId.
		const finalArgs = mockPrisma.fiscalDocument.updateMany.mock.calls.at(-1)![0];
		expect(finalArgs.where).toMatchObject({ facturaId: 'fac-B', estado: 'PROCESANDO' });
		expect(finalArgs.where).toHaveProperty('attemptId');
		expect(finalArgs.data).toMatchObject({ estado: 'TIMBRADA' });
	});

	it('CAS perdedor del claim: no invoca al adaptador y devuelve null', async () => {
		claimPierde();
		const adapterEspia = { jurisdiccion: 'LOCAL', generar: vi.fn() };

		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: adapterEspia as never,
		});

		expect(r).toBeNull();
		expect(adapterEspia.generar).not.toHaveBeenCalled();
		expect(mockPrisma.fiscalEmisionEvent.create).not.toHaveBeenCalled();
	});

	it('el evento PROCESANDO y la finalización llevan el attemptId del intento', async () => {
		claimGana();
		await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: LocalAdapter,
		});

		const eventoClaim = mockPrisma.fiscalEmisionEvent.create.mock.calls[0][0];
		expect(eventoClaim.data.attemptId).toEqual(expect.any(String));
	});
});

describe('clasificación de fallos (5.4): INCIERTA por defecto post-envío', () => {
	it('error genérico del adaptador → INCIERTA, no RECHAZADA', async () => {
		claimGana();
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			facturaId: 'fac-B',
			estado: 'INCIERTA',
			factura: facturaB,
		});
		const adapterRoto = {
			jurisdiccion: 'LOCAL',
			generar: vi.fn().mockRejectedValue(new Error('timeout del PAC')),
		};

		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: adapterRoto as never,
		});

		expect(r?.estado).toBe('INCIERTA');
		const finalArgs = mockPrisma.fiscalDocument.updateMany.mock.calls.at(-1)![0];
		expect(finalArgs.data).toMatchObject({ estado: 'INCIERTA' });
		expect(finalArgs.data).toHaveProperty('intentos');
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estado: 'INCIERTO' }) }),
		);
	});

	it('sólo un rechazo definitivo autenticado (error marcado) queda RECHAZADA', async () => {
		claimGana();
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			facturaId: 'fac-B',
			estado: 'RECHAZADA',
			factura: facturaB,
		});
		const rechazo = new FiscalRechazoDefinitivoError('Rechazo autenticado del PAC', 'R-401');
		const adapterQueRechaza = {
			jurisdiccion: 'MX-SAT',
			generar: vi.fn().mockRejectedValue(rechazo),
		};

		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: adapterQueRechaza as never,
		});

		expect(r?.estado).toBe('RECHAZADA');
		const finalArgs = mockPrisma.fiscalDocument.updateMany.mock.calls.at(-1)![0];
		expect(finalArgs.data).toMatchObject({ estado: 'RECHAZADA' });
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'RECHAZADO', detalle: expect.objectContaining({ codigo: 'R-401' }) }),
			}),
		);
	});

	it('la finalización exitosa es CAS: un intento tardío no pisa el estado', async () => {
		claimGana();
		// El CAS final falla (otro proceso ya resolvió el documento).
		mockPrisma.fiscalDocument.updateMany
			.mockResolvedValueOnce({ count: 1 })  // claim
			.mockResolvedValueOnce({ count: 0 }); // CAS final

		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: 'tenant-1',
			facturaId: 'fac-B',
			adapter: LocalAdapter,
		});

		// No confirma un estado que ya no le pertenece.
		expect(r).toBeNull();
	});
});

describe('procesarSiguientePendiente delega en el dirigido', () => {
	it('sólo selecciona PENDIENTE (INCIERTA/PROCESANDO nunca se reprocesan solas)', async () => {
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			facturaId: 'fac-B',
			estado: 'TIMBRADA',
			factura: facturaB,
		});
		claimGana();

		const r = await FiscalEmisionService.procesarSiguientePendiente('tenant-1', LocalAdapter);

		expect(mockPrisma.fiscalDocument.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', estado: 'PENDIENTE' }) }),
		);
		expect(r?.estado).toBe('TIMBRADA');
	});
});
