/**
 * @description Tests de las actions de comisiones (CMV-T3): gates y validaciones.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockEmpleados, mockUpdate, mockAggregate } = vi.hoisted(() => ({
	mockEmpleados: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
	mockUpdate: vi.fn(),
	mockAggregate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		empleado: { findFirst: mockEmpleados.findFirst, findMany: mockEmpleados.findMany, update: mockEmpleados.update },
		venta: { findMany: vi.fn().mockResolvedValue([]) },
		devolucionVenta: { findMany: vi.fn().mockResolvedValue([]) },
	},
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import {
	updateComisionEmpleadoAction,
	getComisionesDelMesAction,
} from '@/features/empleados/actions-comisiones';

const manager = {
	userId: 'u-1',
	role: 'user',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	isActive: true,
	planFeatures: { empleados: true },
} as const;

describe('actions de comisiones (CMV-T3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('updateComisionEmpleadoAction exige sesión', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		const r = await updateComisionEmpleadoAction({ empleadoId: 'e-1', comisionPct: 5, metaMensual: 100000 });
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('AUTH_REQUIRED');
	});

	it('updateComisionEmpleadoAction exige el permiso sensible', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			tenantRole: 'dependiente', // dependiente no tiene rrhh.comisiones.gestionar
		} as never);
		const r = await updateComisionEmpleadoAction({ empleadoId: 'e-1', comisionPct: 5, metaMensual: 100000 });
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FORBIDDEN');
	});

	it('updateComisionEmpleadoAction con permiso valida y persiste', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager as never);
		mockEmpleados.findFirst.mockResolvedValue({ empleadoId: 'e-1', nombre: 'Ana', apellido: 'Z.' } as never);
		const r = await updateComisionEmpleadoAction({ empleadoId: 'e-1', comisionPct: 10, metaMensual: 50000 });
		expect(r.success).toBe(true);
		expect(mockEmpleados.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { empleadoId: 'e-1' },
				data: { comisionPct: 10, metaMensual: 50000 },
			}),
		);
	});

	it('getComisionesDelMesAction exige el permiso en modo consulta', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			tenantRole: 'dependiente',
		} as never);
		const r = await getComisionesDelMesAction({ anio: 2026, mes: 9 });
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FORBIDDEN');
	});
});
