/**
 * @description Tests del cálculo de nómina con horas extras (B-05).
 * Contrato: las horas extras NO entran al devengado base; se pagan aparte
 * como `montoHorasExtras` = horas × (salarioBases / 192) × 1.5, y la
 * cantidad de horas se guarda en `horasExtrasHoras`. El campo legacy
 * `horasExtras` (horas) ya no se escribe. `salario` persiste el bruto
 * (antes de deducciones); deducciones van aparte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/vacation-accrual-service', () => ({
  VacationAccrualService: class {
    calculateAccrualForEmployee = vi.fn();
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pagosalario: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    empleado: {
      findMany: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { calculateNominaAction } from '@/features/empleados/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

const empleado = {
  empleadoId: 'emp-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  salarioBases: 1920,
  fechaContratacion: new Date('2025-01-01'),
};

const attendanceRows = (totalHours: number, days: number) =>
  Array.from({ length: days }, () => ({ totalHours }));

describe('calculateNominaAction — horas extras (B-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.pagosalario.findMany).mockResolvedValue([]);
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([empleado] as never);
    vi.mocked(prisma.pagosalario.create).mockImplementation(
      async (args: never) => ({ pgId: 'pg-1', ...(args as { data: object }).data }) as never,
    );
  });

  it('excluye las horas extras del devengado y las paga aparte a 1.5×', async () => {
    // 20 días × 10 h = 200 h totales → 40 h extras (2 por día), 160 h base.
    // devengado = (160/192) × 1920 = 1600
    // vacaciones 9.09% = 145.44 → baseImponible 1745.44 → salario bruto 1745
    // deducciones 22% (5+3+12.5+1.5) de 1745.44 = 383.9968 → 384
    // monto horas extras = 40 × (1920/192) × 1.5 = 600
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(
      attendanceRows(10, 20) as never,
    );

    const result = await calculateNominaAction({
      periodo: '2026-08',
      includeVacationAccrual: false,
      forceRecalculate: false,
    });

    expect(result.success).toBe(true);
    const createCall = vi.mocked(prisma.pagosalario.create).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      empleadoId: 'emp-1',
      salario: 1745,
      bonificaciones: 0,
      deducciones: 384,
      horasExtrasHoras: 40,
      montoHorasExtras: 600,
    });
    // El campo legacy (horas) ya no se escribe.
    expect((createCall.data as Record<string, unknown>).horasExtras).toBeUndefined();
    // Trazabilidad para el trabajador en el propio registro.
    expect(createCall.data.observaciones).toContain('Horas extras');
  });

  it('solo cuenta como extras las horas por encima de 8 en el mismo día', async () => {
    // Días de 10 h, 7 h y 9 h → 26 h totales, 3 h extra (2+0+1), 23 h base.
    // devengado = (23/192) × 1920 = 230; vacaciones 20.907 → base 250.907 → 251
    // deducciones 22% de 250.907 = 55.19954 → 55
    // monto horas extras = 3 × 10 × 1.5 = 45
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(
      [{ totalHours: 10 }, { totalHours: 7 }, { totalHours: 9 }] as never,
    );

    const result = await calculateNominaAction({
      periodo: '2026-08',
      includeVacationAccrual: false,
      forceRecalculate: false,
    });

    expect(result.success).toBe(true);
    const createCall = vi.mocked(prisma.pagosalario.create).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      salario: 251,
      deducciones: 55,
      horasExtrasHoras: 3,
      montoHorasExtras: 45,
    });
  });

  it('sin asistencias asume mes completo y no genera horas extras', async () => {
    // fallback actual: mes completo → devengado = 1920, vacaciones 174.528
    // base 2094.528 → 2095; deducciones 22% = 460.79616 → 461
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([] as never);

    const result = await calculateNominaAction({
      periodo: '2026-08',
      includeVacationAccrual: false,
      forceRecalculate: false,
    });

    expect(result.success).toBe(true);
    const createCall = vi.mocked(prisma.pagosalario.create).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      salario: 2095,
      deducciones: 461,
      horasExtrasHoras: 0,
      montoHorasExtras: 0,
    });
  });
});
