/**
 * @description Tests del enforcement SERVER del período contable cerrado en
 * gastos (Sesión A-5). El bloqueo client-side (usePeriodLock) es solo UX:
 * ninguna escritura de gasto (alta, edición, aprobación, rechazo, baja
 * individual o masiva, alta móvil) debe colarse sobre un período cerrado.
 *
 * @module features/gastosDE/__tests__/periodo-cerrado.test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockPrisma, mockTx } = vi.hoisted(() => {
	const mockPrisma = {
		gastosDE: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		gastoConcepto: { findFirst: vi.fn(), findUnique: vi.fn() },
		gastoElemento: { findFirst: vi.fn() },
		vendor: { findFirst: vi.fn() },
		periodoContable: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		auditoriaPeriodo: { findMany: vi.fn(), create: vi.fn() },
		periodoCache: {
			findUnique: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			delete: vi.fn(),
		},
	};
	const mockTx = {
		$queryRaw: vi.fn(),
		gastosDE: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
	};
	mockPrisma.$transaction = vi.fn((cb: any) =>
		typeof cb === 'function' ? cb(mockTx) : Promise.all(cb),
	);
	return { mockPrisma, mockTx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, default: mockPrisma }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/gastosDE/reversal', () => ({
	reverseExpenseEffects: vi.fn(),
}));
vi.mock('@/lib/auth-middleware', () => ({
	authenticateUser: vi.fn(async () => ({ user: { userId: 'u1', tenantId: 't1' } })),
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { clearCache } from '@/lib/services/periodo-contable-guard';
import {
	createGastosDEAction,
	updateGastosDEAction,
	deleteGastosDEAction,
	deleteGastosDEBulkAction,
	aprobarGastoDEAction,
	rechazarGastoDEAction,
} from '@/features/gastosDE/actions';
import { POST as postMobileExpense } from '@/app/api/mobile/expenses/route';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const u: AuthenticatedUser = {
	userId: 'u1',
	name: 'T',
	email: 't@t.com',
	role: 'admin',
	isActive: true,
	tenantId: 't1',
	tenantRole: 'admin',
};

const periodoCerrado = {
	periodoId: 'p-1',
	tipo: 'MENSUAL',
	estado: 'CERRADO',
	fechaInicio: new Date('2026-01-01T00:00:00Z'),
	fechaFin: new Date('2026-01-31T23:59:59Z'),
};

const periodoAbierto = {
	periodoId: 'p-2',
	tipo: 'MENSUAL',
	estado: 'ABIERTO',
	fechaInicio: new Date('2026-03-01T00:00:00Z'),
	fechaFin: new Date('2026-03-31T23:59:59Z'),
};

/** Resuelve el período según la fecha consultada (enero cerrado, resto abierto). */
function mockResolverPorFecha() {
	vi.mocked(mockPrisma.periodoContable.findFirst).mockImplementation(async (args: any) => {
		const fecha: Date = args?.where?.fechaInicio?.lte ?? new Date();
		return (fecha.getUTCMonth() === 0 ? periodoCerrado : periodoAbierto) as any;
	});
}

describe('Enforcement server del período cerrado en gastos (A-5)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.$transaction.mockImplementation((cb: any) =>
			typeof cb === 'function' ? cb(mockTx) : Promise.all(cb),
		);
		process.env.PERIODO_GUARD_ENABLED = 'true';
		process.env.PERIODO_CONTABLE_MODE = 'enforce';
		mockPrisma.periodoCache.findUnique.mockResolvedValue(null);
	});

	afterEach(() => {
		delete process.env.PERIODO_GUARD_ENABLED;
		delete process.env.PERIODO_CONTABLE_MODE;
		clearCache();
	});

	it('createGastosDEAction rechaza un gasto en período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();

		const r = await createGastosDEAction({
			proveedor: 'P1',
			monto: 5000,
			descripcion: 'Test',
			periodo: '2026-01',
		});

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.create).not.toHaveBeenCalled();
	});

	it('createGastosDEAction permite un gasto en período abierto', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		vi.mocked(mockPrisma.gastosDE.create).mockResolvedValue({ gastosDEId: 'g1' } as any);

		const r = await createGastosDEAction({
			proveedor: 'P1',
			monto: 5000,
			descripcion: 'Test',
			periodo: '2026-03',
		});

		expect(r.success).toBe(true);
		expect(mockPrisma.gastosDE.create).toHaveBeenCalled();
	});

	it('updateGastosDEAction rechaza editar un gasto de período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		vi.mocked(mockPrisma.gastosDE.findFirst).mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-01',
		} as any);

		const r = await updateGastosDEAction({ gastosDEId: 'g1', monto: 999 });

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.update).not.toHaveBeenCalled();
	});

	it('updateGastosDEAction rechaza mover un gasto a un período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		vi.mocked(mockPrisma.gastosDE.findFirst).mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-03',
		} as any);

		const r = await updateGastosDEAction({ gastosDEId: 'g1', periodo: '2026-01' });

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.update).not.toHaveBeenCalled();
	});

	it('aprobarGastoDEAction rechaza aprobar un gasto de período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		vi.mocked(mockPrisma.gastosDE.findFirst).mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-01',
		} as any);

		const r = await aprobarGastoDEAction({ id: 'g1' });

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.update).not.toHaveBeenCalled();
	});

	it('rechazarGastoDEAction rechaza operar un gasto de período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		vi.mocked(mockPrisma.gastosDE.findFirst).mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-01',
		} as any);

		const r = await rechazarGastoDEAction({ id: 'g1' });

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.update).not.toHaveBeenCalled();
	});

	it('deleteGastosDEAction rechaza eliminar un gasto de período cerrado sin revertir efectos', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		mockTx.gastosDE.findUnique.mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-01',
			cuentaPorPagar: null,
		} as any);

		const r = await deleteGastosDEAction('g1');

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockTx.gastosDE.deleteMany).not.toHaveBeenCalled();
		expect(mockTx.gastosDE.updateMany).not.toHaveBeenCalled();
	});

	it('deleteGastosDEBulkAction rechaza y no elimina nada si un gasto está en período cerrado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		mockResolverPorFecha();
		mockTx.gastosDE.findUnique.mockResolvedValue({
			gastosDEId: 'g1',
			tenantId: 't1',
			estado: 'PENDIENTE',
			periodo: '2026-01',
			cuentaPorPagar: null,
		} as any);

		const r = await deleteGastosDEBulkAction(['g1']);

		expect(r.success).toBe(false);
		if (!r.success) expect(r.error?.code).toBe('PERIODO_CERRADO');
		expect(mockTx.gastosDE.deleteMany).not.toHaveBeenCalled();
	});

	it('POST /api/mobile/expenses rechaza un alta en período cerrado', async () => {
		mockResolverPorFecha();

		const request = new Request('http://localhost/api/mobile/expenses', {
			method: 'POST',
			body: JSON.stringify({ conceptoId: 'c1', monto: 100, fecha: '2026-01-15T12:00:00Z' }),
		});
		const response = await postMobileExpense(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.code).toBe('PERIODO_CERRADO');
		expect(mockPrisma.gastosDE.create).not.toHaveBeenCalled();
	});
});
