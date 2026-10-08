import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockService, mockRequireFeature, mockRequireTenant, mockGetCurrentUser } = vi.hoisted(() => ({
	mockPrisma: {
		aperturaRevision: { findFirst: vi.fn() },
		aperturaPeriodo: { findFirst: vi.fn() },
		cuentaRolTenant: { findMany: vi.fn() },
		periodoContable: { findFirst: vi.fn() },
	},
	mockService: {
		createAperturaRevisionDraft: vi.fn(),
		submitAperturaRevision: vi.fn(),
		approveAperturaRevision: vi.fn(),
	},
	mockRequireFeature: vi.fn(),
	mockRequireTenant: vi.fn(() => 'tenant-authenticated'),
	mockGetCurrentUser: vi.fn(async () => ({ userId: 'actor-1', isActive: true, tenantId: 'tenant-authenticated' })),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireFeature: mockRequireFeature,
	requireTenant: mockRequireTenant,
}));
vi.mock('@/features/contabilidad-formal/services/apertura-revision-service', () => mockService);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: mockGetCurrentUser }));

import {
	approveAperturaRevisionAction,
	createAperturaRevisionDraftAction,
	getAperturaRevisionAction,
	getAperturaRevisionContextAction,
	submitAperturaRevisionAction,
} from '../actions-apertura-revisada';

describe('apertura revisada actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRequireTenant.mockReturnValue('tenant-authenticated');
	});

	it('scopes revision reads to the authenticated tenant', async () => {
		mockPrisma.aperturaRevision.findFirst.mockResolvedValue({ revisionId: 'rev-1' });
		const result = await getAperturaRevisionAction('rev-1');
		expect(mockPrisma.aperturaRevision.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { revisionId: 'rev-1', tenantId: 'tenant-authenticated' },
		}));
		expect(result.success).toBe(true);
	});

	it('returns only opening metadata, revision summaries, and active tenant roles', async () => {
		mockPrisma.aperturaPeriodo.findFirst.mockResolvedValue({
			aperturaId: 'opening-1',
			revisiones: [],
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue({ fechaInicio: new Date('2026-01-01') });
		mockPrisma.cuentaRolTenant.findMany.mockResolvedValue([{
			rol: 'CAJA_PRINCIPAL', cuentaId: 'cash-1',
			cuenta: { tenantId: 'tenant-authenticated', codigo: '1.1', nombre: 'Caja', naturaleza: 'DEUDORA' },
		}, {
			rol: 'BANCOS', cuentaId: 'foreign-bank',
			cuenta: { tenantId: 'tenant-other', codigo: '1.2', nombre: 'Foreign', naturaleza: 'DEUDORA' },
		}]);
		const result = await getAperturaRevisionContextAction('period-1');
		expect(mockPrisma.periodoContable.findFirst).toHaveBeenCalledWith({
			where: { periodoId: 'period-1', tenantId: 'tenant-authenticated' },
			select: { fechaInicio: true },
		});
		expect(result.success && result.data).toMatchObject({
			apertura: { aperturaId: 'opening-1', fechaCorte: '2026-01-01T00:00:00.000Z' },
			revisiones: [],
			roles: [{ role: 'CAJA_PRINCIPAL', accountId: 'cash-1', label: '1.1 - Caja', normalSide: 'DEUDORA' }],
		});
	});

	it('returns the latest revision cutoff when a revision exists', async () => {
		mockPrisma.aperturaPeriodo.findFirst.mockResolvedValue({
			aperturaId: 'opening-1',
			revisiones: [{ revisionId: 'rev-1', version: 1, estado: 'BORRADOR',
				fechaCorte: new Date('2026-01-01'), presentadaAt: null, revisadaAt: null }],
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue({ fechaInicio: new Date('2026-01-01') });
		mockPrisma.cuentaRolTenant.findMany.mockResolvedValue([{
			rol: 'CAJA_PRINCIPAL', cuentaId: 'cash-1',
			cuenta: { tenantId: 'tenant-authenticated', codigo: '1.1', nombre: 'Caja', naturaleza: 'DEUDORA' },
		}, {
			rol: 'BANCOS', cuentaId: 'foreign-bank',
			cuenta: { tenantId: 'tenant-other', codigo: '1.2', nombre: 'Foreign', naturaleza: 'DEUDORA' },
		}]);
		const result = await getAperturaRevisionContextAction('period-1');
		expect(mockPrisma.aperturaPeriodo.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { periodoId: 'period-1', tenantId: 'tenant-authenticated' },
			select: expect.objectContaining({
				aperturaId: true,
				revisiones: expect.any(Object),
			}),
		}));
		expect(mockPrisma.cuentaRolTenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { tenantId: 'tenant-authenticated', cuenta: {
				tenantId: 'tenant-authenticated', activa: true,
			} },
		}));
		expect(result.success && result.data).toMatchObject({
			apertura: { aperturaId: 'opening-1', fechaCorte: '2026-01-01T00:00:00.000Z' },
			revisiones: [{ revisionId: 'rev-1', version: 1, estado: 'BORRADOR' }],
			roles: [{ role: 'CAJA_PRINCIPAL', accountId: 'cash-1', label: '1.1 - Caja', normalSide: 'DEUDORA' }],
		});
	});

	it('rejects trusted source input before calling the draft service', async () => {
		const result = await createAperturaRevisionDraftAction({
			periodoId: 'period-1', aperturaId: 'opening-1', fechaCorte: '2026-01-01',
			lines: [{
				fechaEfectiva: '2026-01-01', lado: 'DEBE', rolCuenta: 'CAJA', cuentaId: 'cash-1',
				monedaNativa: 'CUP', importeNativo: '10', importeFuncional: '10', fuenteTipo: 'TRUSTED',
				fuenteId: 'source-1', evidenciaVersion: 1, fuenteSnapshot: {},
			}],
		} as never);
		expect(result.success).toBe(false);
		expect(mockService.createAperturaRevisionDraft).not.toHaveBeenCalled();
	});

	it('routes submit and approval to their guarded service operations', async () => {
		mockService.submitAperturaRevision.mockResolvedValue({ revisionId: 'rev-1' });
		mockService.approveAperturaRevision.mockResolvedValue({ estado: 'APROBADA', revisionId: 'rev-1' });
		await submitAperturaRevisionAction('rev-1');
		await approveAperturaRevisionAction('rev-1');
		expect(mockService.submitAperturaRevision).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'tenant-authenticated' }), 'rev-1',
		);
		expect(mockService.approveAperturaRevision).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'tenant-authenticated' }), 'rev-1',
		);
	});
});
