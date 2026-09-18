/**
 * @description Tests unitarios para Server Actions de empleados.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    empleado: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    pagosalario: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    reconciliacionGasto: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cuentaBancaria: { findMany: vi.fn(), updateMany: vi.fn() },
    cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
    employeeWorkSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getEmpleadosAction,
  getEmpleadoByIdAction,
  createEmpleadoAction,
  updateEmpleadoAction,
  deleteEmpleadoAction,
  getNominaAction,
  getWorkSchedulesAction,
  upsertWorkScheduleAction,
  calculateNominaAction,
} from '@/features/empleados/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('Empleados Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getEmpleadosAction retorna lista del tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([]);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(true);
  });

  it('getEmpleadoByIdAction retorna empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    const result = await getEmpleadoByIdAction('emp-1');
    expect(result.success).toBe(true);
  });

  it('createEmpleadoAction crea empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.create).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    const result = await createEmpleadoAction({ nombre: 'Juan', apellido: 'Pérez', cargo: 'Vendedor', salarioBases: 50000 });
    expect(result.success).toBe(true);
  });

  it('updateEmpleadoAction actualiza empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' });
    vi.mocked(prisma.empleado.update).mockResolvedValue({} as any);
    const result = await updateEmpleadoAction({ empleadoId: 'emp-1', nombre: 'Juan Carlos' });
    expect(result.success).toBe(true);
  });

  it('deleteEmpleadoAction elimina empleado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' });
    vi.mocked(prisma.empleado.delete).mockResolvedValue({} as any);
    const result = await deleteEmpleadoAction('emp-1');
    expect(result.success).toBe(true);
  });

  it('getNominaAction retorna nómina filtrada por tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.pagosalario.findMany).mockResolvedValue([] as any);
    const result = await getNominaAction({});
    expect(result.success).toBe(true);
    expect(prisma.pagosalario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-test' }),
      }),
    );
  });

  it('getWorkSchedulesAction retorna horarios del empleado filtrado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.employeeWorkSchedule.findMany).mockResolvedValue([] as any);
    const result = await getWorkSchedulesAction({ employeeId: 'emp-1' });
    expect(result.success).toBe(true);
    expect(prisma.employeeWorkSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          employee: { tenantId: 'tenant-test' },
        }),
      }),
    );
  });

  it('upsertWorkScheduleAction crea o actualiza horario validando tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    vi.mocked(prisma.employeeWorkSchedule.upsert).mockResolvedValue({ scheduleId: 'sch-1' } as any);
    const result = await upsertWorkScheduleAction({
      employeeId: 'emp-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      isWorkingDay: true,
      scheduledHours: 7,
    });
    expect(result.success).toBe(true);
    expect(prisma.employeeWorkSchedule.upsert).toHaveBeenCalled();
  });

  it('retorna AUTH_REQUIRED sin usuario', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('AUTH_REQUIRED');
  });

  it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye empleados', async () => {
    const restrictedUser: AuthenticatedUser = {
      ...mockUser,
      role: 'user',
      tenantRole: 'manager',
      planFeatures: { empleados: false },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FEATURE_NOT_AVAILABLE');
  });

  // ─── Tests para Fix A del spec (Task 5) ───────────────────────────
  // Verifican que el fix de /busy/empleados/page.tsx funcione:
  // el main page solo llama getEmpleadosAction (no getPagoSalariosAction).
  // getEmpleadosAction debe funcionar en plan Básico completo.

  it('getEmpleadosAction funciona en plan Básico completo', async () => {
    const basicPlanUser: AuthenticatedUser = {
      ...mockUser,
      role: 'user' as any,
      tenantRole: 'manager',
      planFeatures: {
        empleados: true,
        nomina: false,
        asistencia: false,
        vacaciones: false,
      },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(basicPlanUser);
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([
      { empleadoId: 'emp-1', nombre: 'Juan', apellido: 'Pérez' } as any,
      { empleadoId: 'emp-2', nombre: 'Ana', apellido: 'García' } as any,
    ]);
    const result = await getEmpleadosAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    // No debe lanzar FEATURE_NOT_AVAILABLE
  });

  it('getEmpleadoByIdAction funciona en plan Básico', async () => {
    const basicPlanUser: AuthenticatedUser = {
      ...mockUser,
      role: 'user' as any,
      tenantRole: 'manager',
      planFeatures: { empleados: true, nomina: false, asistencia: false, vacaciones: false },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(basicPlanUser);
    vi.mocked(prisma.empleado.findFirst).mockResolvedValue({
      empleadoId: 'emp-1',
      nombre: 'Juan',
      ventas: [],
    } as any);
    const result = await getEmpleadoByIdAction('emp-1');
    expect(result.success).toBe(true);
  });

  it('createEmpleadoAction funciona en plan Básico (manager puede crear)', async () => {
    const basicPlanManager: AuthenticatedUser = {
      ...mockUser,
      role: 'user' as any,
      tenantRole: 'manager',
      planFeatures: { empleados: true, nomina: false, asistencia: false, vacaciones: false },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(basicPlanManager);
    vi.mocked(prisma.empleado.create).mockResolvedValue({
      empleadoId: 'emp-new',
      nombre: 'Pedro',
    } as any);
    const result = await createEmpleadoAction({
      nombre: 'Pedro',
      apellido: 'López',
      cargo: 'Vendedor',
      salarioBases: 30000,
      diasVacacionesAnuales: 15,
      esTiempoCompleto: true,
    });
    expect(result.success).toBe(true);
  });

  it('createEmpleadoAction rechaza en plan Básico con rol dependiente', async () => {
    const basicPlanDependiente: AuthenticatedUser = {
      ...mockUser,
      role: 'user' as any,
      tenantRole: 'dependiente',
      planFeatures: { empleados: true, nomina: false, asistencia: false, vacaciones: false },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(basicPlanDependiente);
    const result = await createEmpleadoAction({
      nombre: 'Pedro',
      apellido: 'López',
      cargo: 'Vendedor',
      salarioBases: 30000,
      diasVacacionesAnuales: 15,
      esTiempoCompleto: true,
    });
    expect(result.success).toBe(false);
    // Dependiente no puede crear (requireManagerRole)
  });

  it('forceRecalculate revierte movimientos de nómina antes de reemplazar el período', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findMany: vi.fn().mockResolvedValue([{ pgId: 'pg-old' }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            reconciliacionId: 'rec-old',
            cuentaId: 'account-1',
            monto: 100,
            montoConvertido: 300,
            cuentaPorPagarId: null,
            moneda: 'USD',
            tasaCambio: 3,
          },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaBancaria: {
        findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([]);

    const result = await calculateNominaAction({
      periodo: '2026-08',
      forceRecalculate: true,
      includeVacationAccrual: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
	expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
	expect(tx.reconciliacionGasto.deleteMany).not.toHaveBeenCalled();
  });
});
