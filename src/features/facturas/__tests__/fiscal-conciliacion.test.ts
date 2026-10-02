/**
 * @description Tests de las acciones de conciliación y reintento con
 * evidencia (Phase 5, 5.7 del change remediacion-integridad-ventas-credito-fiscal):
 * un documento INCIERTA sólo se resuelve con evidencia externa del operador
 * autorizado (permiso config.fiscal.conciliar); confirmar no reenvía; probar
 * no emisión lo devuelve a PENDIENTE; el reintento de RECHAZADA exige prueba
 * de no emisión del mismo intento.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockProcesarDirigido, mockProcesarCola } = vi.hoisted(() => ({
	mockProcesarDirigido: vi.fn(),
	mockProcesarCola: vi.fn(),
}));

vi.mock('@/features/facturas/services/fiscal-emision-service', () => ({
	FiscalEmisionService: {
		registrarEmisionPendiente: vi.fn().mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			estado: 'PENDIENTE',
		}),
		procesarFacturaPendiente: mockProcesarDirigido,
		procesarSiguientePendiente: mockProcesarCola,
	},
}));

vi.mock('@/features/facturas/services/fiscal/local-adapter', () => ({
	LocalAdapter: { jurisdiccion: 'LOCAL', generar: vi.fn() },
}));

vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn().mockResolvedValue(undefined) },
}));

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: {
		factura: { findFirst: vi.fn() },
		fiscalDocument: { findFirst: vi.fn(), updateMany: vi.fn() },
		fiscalEmisionEvent: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
	},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

// Espías pass-through para verificar el permiso exigido por cada action.
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
import { requirePermission } from '@/lib/services/tenant-scope';
import {
	conciliarFiscalAction,
	emitirFiscalAction,
	reintentarFiscalAction,
} from '@/features/facturas/actions-fiscal';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerConciliar = {
	userId: 'u-1',
	role: 'user',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	isActive: true,
	planFeatures: { facturacion: true, 'facturacion-fiscal': true },
	permissions: new Set(['config.fiscal.conciliar']),
} as unknown as AuthenticatedUser;

const dependiente = {
	...managerConciliar,
	tenantRole: 'dependiente',
	permissions: new Set<string>(),
} as unknown as AuthenticatedUser;

const facturaFiscal = {
	idFactura: 'fac-1',
	tenantId: 'tenant-1',
	numeroFactura: 'FV-000001',
	total: 1000,
	tenant: { fiscalActivado: true },
};

describe('emitirFiscalAction procesa la factura exacta (5.3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('resuelve el documento de la factura solicitada, no el pendiente más antiguo', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue(facturaFiscal as never);
		mockProcesarDirigido.mockResolvedValue({ estado: 'TIMBRADA' });

		const r = await emitirFiscalAction('fac-1');

		expect(r.success).toBe(true);
		if (r.success) expect(r.data?.estado).toBe('TIMBRADA');
		expect(mockProcesarDirigido).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'tenant-1', facturaId: 'fac-1' }),
		);
		expect(mockProcesarCola).not.toHaveBeenCalled();
	});
});

describe('reintentarFiscalAction exige prueba de no emisión (5.4)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sin evidencia de no emisión se rechaza, aunque el documento esté RECHAZADA', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'RECHAZADA' },
		} as never);

		const r = await reintentarFiscalAction({ facturaId: 'fac-1' });

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('EVIDENCIA_REQUERIDA');
		expect(mockPrisma.fiscalDocument.updateMany).not.toHaveBeenCalled();
	});

	it('RECHAZADA con prueba de no emisión y permiso vuelve a PENDIENTE', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'RECHAZADA', fiscalDocumentId: 'doc-1' },
		} as never);
		mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 1 });
		mockProcesarDirigido.mockResolvedValue({ estado: 'TIMBRADA' });

		const r = await reintentarFiscalAction({
			facturaId: 'fac-1',
			pruebaNoEmision: 'Ack-PAC-2026-000123: no existe el comprobante',
		});

		expect(r.success).toBe(true);
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(), 'config.fiscal.conciliar', expect.any(String),
		);
		expect(mockPrisma.fiscalDocument.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ facturaId: 'fac-1', tenantId: 'tenant-1', estado: 'RECHAZADA' }),
				data: expect.objectContaining({ estado: 'PENDIENTE' }),
			}),
		);
	});

	it('sin el permiso de conciliación el reintento con evidencia es FORBIDDEN', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'RECHAZADA' },
		} as never);

		const r = await reintentarFiscalAction({
			facturaId: 'fac-1',
			pruebaNoEmision: 'Ack-PAC-2026-000123',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('FORBIDDEN');
	});

	it('INCIERTA nunca se reintenta directamente (sólo conciliación)', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'INCIERTA' },
		} as never);

		const r = await reintentarFiscalAction({
			facturaId: 'fac-1',
			pruebaNoEmision: 'Ack-PAC-2026-000123',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('ESTADO_INVALIDO');
	});
});

describe('conciliarFiscalAction (5.7): INCIERTA sólo con evidencia del operador', () => {
	beforeEach(() => vi.clearAllMocks());

	it('confirma TIMBRADA con uuid externo SIN nuevo envío al adaptador', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'INCIERTA', fiscalDocumentId: 'doc-1' },
		} as never);
		mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 1 });
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({ estado: 'TIMBRADA', uuidExterno: 'PAC-UUID-9' });

		const r = await conciliarFiscalAction({
			facturaId: 'fac-1',
			resultado: 'TIMBRADA',
			uuidExterno: 'PAC-UUID-9',
			folio: 'FOLIO-9',
			motivo: 'Confirmación en el portal del PAC',
		});

		expect(r.success).toBe(true);
		if (r.success) expect(r.data?.estado).toBe('TIMBRADA');
		// CAS INCIERTA→TIMBRADA sin pasar por el adaptador.
		expect(mockPrisma.fiscalDocument.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ facturaId: 'fac-1', tenantId: 'tenant-1', estado: 'INCIERTA' }),
				data: expect.objectContaining({ estado: 'TIMBRADA', uuidExterno: 'PAC-UUID-9' }),
			}),
		);
		expect(mockProcesarDirigido).not.toHaveBeenCalled();
		expect(mockPrisma.fiscalEmisionEvent.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'CONCILIADO', detalle: expect.objectContaining({ uuidExterno: 'PAC-UUID-9' }) }),
			}),
		);
	});

	it('prueba de no emisión devuelve el documento a PENDIENTE (reintentable)', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'INCIERTA', fiscalDocumentId: 'doc-1' },
		} as never);
		mockPrisma.fiscalDocument.updateMany.mockResolvedValue({ count: 1 });
		mockPrisma.fiscalDocument.findFirst.mockResolvedValue({ estado: 'PENDIENTE' });

		const r = await conciliarFiscalAction({
			facturaId: 'fac-1',
			resultado: 'NO_EMITIDA',
			motivo: 'El PAC confirma que el comprobante no existe (caso 000123)',
		});

		expect(r.success).toBe(true);
		expect(mockPrisma.fiscalDocument.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: 'PENDIENTE', ultimoError: null }),
			}),
		);
	});

	it('sin permiso config.fiscal.conciliar la conciliación es FORBIDDEN', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'INCIERTA' },
		} as never);

		const r = await conciliarFiscalAction({
			facturaId: 'fac-1',
			resultado: 'TIMBRADA',
			uuidExterno: 'PAC-UUID-9',
			motivo: 'x',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('FORBIDDEN');
	});

	it('un documento que no está INCIERTA no se concilia', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'PROCESANDO' },
		} as never);

		const r = await conciliarFiscalAction({
			facturaId: 'fac-1',
			resultado: 'TIMBRADA',
			uuidExterno: 'PAC-UUID-9',
			motivo: 'x',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('ESTADO_INVALIDO');
	});

	it('confirmar TIMBRADA exige uuid externo verificable', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerConciliar);
		mockPrisma.factura.findFirst.mockResolvedValue({
			...facturaFiscal,
			fiscalDocument: { estado: 'INCIERTA' },
		} as never);

		const r = await conciliarFiscalAction({
			facturaId: 'fac-1',
			resultado: 'TIMBRADA',
			motivo: 'sin uuid',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('VALIDATION_ERROR');
	});
});
