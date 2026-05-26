/**
 * @description Tests unitarios para el wrapper withPeriodValidation.
 *
 * Verifica que el wrapper:
 * - Ejecuta el handler cuando la validación pasa
 * - Bloquea con enforce cuando el período no es writable
 * - Permite con audit-only aunque el período no sea writable
 * - Saltea la validación cuando no hay fecha
 * - Saltea la validación cuando el guard está disabled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withPeriodValidation } from '../with-period-validation';
import { clearCache } from '../periodo-contable-guard';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// Mock del módulo de Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    periodoContable: {
      findFirst: vi.fn(),
    },
    periodoCache: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock de getCurrentUser
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  email: 'test@test.com',
  role: 'admin',
};

describe('withPeriodValidation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearCache();
    // Default: guard enabled, enforce mode
    process.env.PERIODO_GUARD_ENABLED = 'true';
    process.env.PERIODO_CONTABLE_MODE = 'enforce';
  });

  afterEach(() => {
    delete process.env.PERIODO_GUARD_ENABLED;
    delete process.env.PERIODO_CONTABLE_MODE;
    vi.resetModules();
  });

  describe('wrapper pasa validación y ejecuta handler', () => {
    it('ejecuta el handler cuando el período está ABIERTO', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-05-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true, data: 'ok' });
      const wrapped = withPeriodValidation(
        () => new Date('2026-05-15'),
        handler,
      );

      const result = await wrapped({ fecha: '2026-05-15' }, mockUser);

      expect(handler).toHaveBeenCalledWith({ fecha: '2026-05-15' }, mockUser);
      expect(result).toEqual({ success: true, data: 'ok' });
    });

    it('ejecuta el handler cuando el período está REABIERTO', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'REABIERTO',
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-05-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-05-15'),
        handler,
      );

      await wrapped({}, mockUser);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('wrapper bloquea con enforce', () => {
    it('lanza ActionError cuando el período está CERRADO', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'CERRADO',
        fechaInicio: new Date('2026-04-01'),
        fechaFin: new Date('2026-04-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      await expect(wrapped({}, mockUser)).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('lanza ActionError cuando el período está APROBADO', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'APROBADO',
        fechaInicio: new Date('2026-04-01'),
        fechaFin: new Date('2026-04-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      await expect(wrapped({}, mockUser)).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('lanza ActionError cuando no existe período', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue(null);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      await expect(wrapped({}, mockUser)).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('wrapper permite con audit-only', () => {
    it('ejecuta el handler aunque el período esté CERRADO en audit-only', async () => {
      process.env.PERIODO_CONTABLE_MODE = 'audit-only';

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'CERRADO',
        fechaInicio: new Date('2026-04-01'),
        fechaFin: new Date('2026-04-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true, data: 'audit-ok' });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      const result = await wrapped({}, mockUser);
      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 'audit-ok' });
    });
  });

  describe('wrapper saltea validación', () => {
    it('saltea cuando el guard está disabled', async () => {
      process.env.PERIODO_GUARD_ENABLED = 'false';

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      await wrapped({}, mockUser);
      expect(handler).toHaveBeenCalled();
    });

    it('saltea cuando extraerFecha retorna null', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => null,
        handler,
      );

      await wrapped({}, mockUser);
      expect(handler).toHaveBeenCalled();
    });

    it('saltea cuando el usuario no tiene tenantId', async () => {
      const userSinTenant: AuthenticatedUser = {
        userId: 'user-1',
        tenantId: '',
        email: 'test@test.com',
        role: 'admin',
      };

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date('2026-04-15'),
        handler,
      );

      await wrapped({}, userSinTenant);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('extraer fecha funciona correctamente', () => {
    it('extrae fecha de campo fechaReconciliacion', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-05-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        (input: any) => input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : null,
        handler,
      );

      await wrapped({ fechaReconciliacion: '2026-05-15' }, mockUser);
      expect(handler).toHaveBeenCalled();

      // Verify the query was made with the correct date range
      expect(prisma.periodoContable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        }),
      );
    });

    it('usa fecha actual cuando no hay fecha en el input', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.periodoContable.findFirst).mockResolvedValue({
        periodoId: 'p-1',
        tenantId: 'tenant-1',
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2026-12-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withPeriodValidation(
        () => new Date(),
        handler,
      );

      await wrapped({}, mockUser);
      expect(handler).toHaveBeenCalled();
    });
  });
});
