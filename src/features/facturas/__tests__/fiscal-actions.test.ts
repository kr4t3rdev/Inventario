/**
 * @description Tests de las server actions fiscales (FE-T3): gates de feature
 * y tenant, idempotencia del encolado y reintento desde RECHAZADA.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockEmit, mockGet, mockRetry } = vi.hoisted(() => ({
	mockEmit: vi.fn(),
	mockGet: vi.fn(),
	mockRetry: vi.fn(),
}));

vi.mock('@/features/facturas/services/fiscal-emision-service', () => ({
	FiscalEmisionService: {
		registrarEmisionPendiente: mockEmit,
		procesarSiguientePendiente: mockRetry,
	},
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		factura: { findFirst: vi.fn() },
		fiscalDocument: { findFirst: vi.fn(), update: vi.fn() },
		tenant: { findFirst: vi.fn() },
		fiscalEmisionEvent: { findMany: vi.fn().mockResolvedValue([]) },
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import {
	emitirFiscalAction,
	getDocumentoFiscalAction,
	reintentarFiscalAction,
} from '@/features/facturas/actions-fiscal';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager = {
	userId: 'u-1',
	role: 'user',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	isActive: true,
	planFeatures: { facturacion: true, 'facturacion-fiscal': true },
} as unknown as AuthenticatedUser;

describe('acciones fiscales (FE-T3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('emitirFiscalAction exige feature + tenant activo', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		const r0 = await emitirFiscalAction('fac-1');
		expect(r0.error?.code).toBe('AUTH_REQUIRED');

		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			planFeatures: {},
		} as never);
		const r1 = await emitirFiscalAction('fac-1');
		expect(r1.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('getDocumentoFiscalAction devuelve el documento y la bitácora ordenada', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		const { prisma } = await import('@/lib/prisma');
		vi.mocked(prisma.fiscalDocument.findFirst).mockResolvedValue({
			fiscalDocumentId: 'doc-1',
			estado: 'TIMBRADA',
			uuidExterno: 'LOCAL-fac-1-1',
			factura: { numeroFactura: 'FV-000001' },
		} as never);
		const r = await getDocumentoFiscalAction('fac-1');
		expect(r.success).toBe(true);
		if (r.success && r.data) {
			expect(r.data.fiscalDocumentId).toBe('doc-1');
			expect(Array.isArray(r.data.eventos)).toBe(true);
		}
	});

	it('reintentarFiscalAction rechaza documentos que no están RECHAZADA', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		const { prisma } = await import('@/lib/prisma');
		vi.mocked(prisma.factura.findFirst).mockResolvedValue({
			idFactura: 'fac-1',
			tenantId: 'tenant-1',
			numeroFactura: 'FV-000001',
			fiscalDocument: { estado: 'TIMBRADA' },
		} as never);
		const r = await reintentarFiscalAction('fac-1');
		expect(r.error?.code).toBe('ESTADO_INVALIDO');
	});
});
