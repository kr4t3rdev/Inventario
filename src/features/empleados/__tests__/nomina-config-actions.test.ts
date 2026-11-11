/**
 * @description Tests F-5: NominaConfig por tenant (get/upsert).
 *
 * Contrato del spec nomina-config:
 * - `NominaConfig` es 1:1 por tenant (patrón TenantAccountingPolicy).
 * - `getNominaConfigAction` devuelve la config del tenant o null con los
 *   defaults vigentes (1.5 / 192 / CUP) para que la UI siempre tenga ambos.
 * - `upsertNominaConfigAction` valida rangos (tarifa > 0, horas estándar
 *   enteras positivas, moneda ISO 3 letras) y registra quién actualizó.
 * - Gating por feature `nomina` y permiso `rrhh.nomina.configurar`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    nominaConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getNominaConfigAction,
  upsertNominaConfigAction,
} from '../actions-nomina-config';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

const configRow = {
  tenantId: 'tenant-test',
  tarifaHoraExtra: 2,
  horasMensualesEstandar: 200,
  monedaPago: 'USD',
  updatedBy: 'user-1',
};

describe('F-5: getNominaConfigAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('devuelve la config del tenant junto a los defaults vigentes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.nominaConfig.findUnique).mockResolvedValue(configRow as any);
    const result = await getNominaConfigAction();
    expect(result.success).toBe(true);
    expect(prisma.nominaConfig.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-test' },
    });
    if (result.success) {
      expect(result.data.config).toEqual(configRow);
      expect(result.data.defaults).toEqual({
        tarifaHoraExtra: 1.5,
        horasMensualesEstandar: 192,
        monedaPago: 'CUP',
      });
    }
  });

  it('sin config devuelve null y los defaults (fallback)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.nominaConfig.findUnique).mockResolvedValue(null as any);
    const result = await getNominaConfigAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toBeNull();
      expect(result.data.defaults.tarifaHoraExtra).toBe(1.5);
    }
  });

  it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye nómina', async () => {
    const restrictedUser: AuthenticatedUser = {
      ...mockUser,
      role: 'user',
      planFeatures: { nomina: false },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
    const result = await getNominaConfigAction();
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FEATURE_NOT_AVAILABLE');
  });
});

describe('F-5: upsertNominaConfigAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('guarda la config del tenant con updatedBy', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.nominaConfig.upsert).mockResolvedValue(configRow as any);
    const result = await upsertNominaConfigAction({
      tarifaHoraExtra: 2,
      horasMensualesEstandar: 200,
      monedaPago: 'USD',
    });
    expect(result.success).toBe(true);
    expect(prisma.nominaConfig.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-test' },
      create: expect.objectContaining({
        tenantId: 'tenant-test',
        tarifaHoraExtra: 2,
        horasMensualesEstandar: 200,
        monedaPago: 'USD',
        updatedBy: 'user-1',
      }),
      update: expect.objectContaining({
        tarifaHoraExtra: 2,
        horasMensualesEstandar: 200,
        monedaPago: 'USD',
        updatedBy: 'user-1',
      }),
    });
  });

  it('aplica monedaPago CUP por defecto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.nominaConfig.upsert).mockResolvedValue(configRow as any);
    const result = await upsertNominaConfigAction({
      tarifaHoraExtra: 1.5,
      horasMensualesEstandar: 192,
    });
    expect(result.success).toBe(true);
    expect(prisma.nominaConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ monedaPago: 'CUP' }),
      }),
    );
  });

  it('rechaza tarifa no positiva con VALIDATION_ERROR', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const result = await upsertNominaConfigAction({
      tarifaHoraExtra: 0,
      horasMensualesEstandar: 192,
    });
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza horas estándar no enteras o fuera de rango', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const fraccion = await upsertNominaConfigAction({
      tarifaHoraExtra: 1.5,
      horasMensualesEstandar: 192.5,
    });
    expect(fraccion.success).toBe(false);
    expect(fraccion.error!.code).toBe('VALIDATION_ERROR');

    const exagerado = await upsertNominaConfigAction({
      tarifaHoraExtra: 1.5,
      horasMensualesEstandar: 9999,
    });
    expect(exagerado.success).toBe(false);
    expect(exagerado.error!.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza moneda que no es código ISO de 3 letras', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const result = await upsertNominaConfigAction({
      tarifaHoraExtra: 1.5,
      horasMensualesEstandar: 192,
      monedaPago: 'dolares',
    });
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('VALIDATION_ERROR');
  });

  it('retorna FORBIDDEN para un dependiente', async () => {
    const dependiente: AuthenticatedUser = {
      ...mockUser,
      role: 'user',
      tenantRole: 'dependiente',
      planFeatures: { nomina: true },
    };
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
    const result = await upsertNominaConfigAction({
      tarifaHoraExtra: 2,
      horasMensualesEstandar: 200,
    });
    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FORBIDDEN');
  });
});
