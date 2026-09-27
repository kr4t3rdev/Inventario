/**
 * @description Tests unitarios para Server Actions de contratos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(null) },
}));
vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
  crearContratoConConsecutivo: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    contratoVersion: { create: vi.fn() },
    cliente: { findFirst: vi.fn(), update: vi.fn() },
    vendor: { findFirst: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { generarProximoConsecutivo, formatearNumeroContrato, crearContratoConConsecutivo } from '@/features/contratos/lib/numeroContratoGenerator';
import {
  getContratosAction,
  getContratoByIdAction,
  createContratoAction,
  updateContratoAction,
  deleteContratoAction,
  bulkUpdateContratoStatusAction,
  cambiarEstadoContratoAction,
} from '@/features/contratos/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

const mockContrato = {
  contratoId: 'ct-1',
  tenantId: 'tenant-test',
  numeroContrato: 'COMPRA_VENTA-2025-001',
  tipo: 'COMPRA_VENTA',
  estado: 'BORRADOR',
  fechaInicio: new Date(),
  creadoPor: 'user-1',
};

describe('Contratos Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getContratosAction', () => {
    it('retorna lista paginada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([mockContrato]);
      vi.mocked(prisma.contrato.count).mockResolvedValue(1);

      const result = await getContratosAction({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data!.meta.total).toBe(1);
      expect(result.data!.data).toHaveLength(1);
    });
  });

  describe('getContratoByIdAction', () => {
    it('retorna contrato por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(mockContrato);
      const result = await getContratoByIdAction('ct-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null);
      const result = await getContratoByIdAction('ct-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createContratoAction', () => {
    const validInput = {
      tipo: 'COMPRA_VENTA',
      fechaInicio: new Date().toISOString(),
      clienteId: 'cli-1',
    };

    it('crea contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1' } as any);
      vi.mocked(crearContratoConConsecutivo).mockImplementation(async ({ create }: any) =>
        create({ numeroConsecutivo: 1, numeroContrato: 'CV-0001' }));
      vi.mocked(prisma.contrato.create).mockResolvedValue(mockContrato);
      vi.mocked(prisma.contratoVersion.create).mockResolvedValue({} as any);
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as any);

      const result = await createContratoAction(validInput as any);

      expect(result.success).toBe(true);
      expect(crearContratoConConsecutivo).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-test', tipo: 'COMPRA_VENTA' }),
      );
    });

    it('rechaza si faltan datos requeridos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createContratoAction({ fechaInicio: new Date().toISOString() } as any);

      expect(result.success).toBe(false);
    });
  });

  describe('updateContratoAction', () => {
    it('actualiza contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(mockContrato);
      vi.mocked(prisma.contrato.update).mockResolvedValue(mockContrato);

      const result = await updateContratoAction({ contratoId: 'ct-1', estado: 'ACTIVO' });

      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null);

      const result = await updateContratoAction({ contratoId: 'ct-noexiste', estado: 'ACTIVO' });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteContratoAction', () => {
    it('elimina contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, clienteId: 'cli-1', numeroContrato: 'CT-001' });
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as any);
      vi.mocked(prisma.contrato.delete).mockResolvedValue(mockContrato);

      const result = await deleteContratoAction('ct-1');
      expect(result.success).toBe(true);
    });
  });

  describe('bulkUpdateContratoStatusAction', () => {
    it('aplica solo los contratos con transición válida y reporta los fallidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([
        { contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' },
        { contratoId: 'ct-2', estado: 'PENDIENTE_APROBACION' },
        { contratoId: 'ct-3', estado: 'FINALIZADO' },
      ] as any);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 2 } as any);

      const result = await bulkUpdateContratoStatusAction({ ids: ['ct-1', 'ct-2', 'ct-3'], estado: 'APROBADO' });

      expect(result.success).toBe(true);
      expect(result.data!.actualizados).toEqual(['ct-1', 'ct-2']);
      expect(result.data!.fallidos).toEqual([
        { contratoId: 'ct-3', motivo: 'No se puede cambiar un contrato de FINALIZADO a APROBADO' },
      ]);
      expect(prisma.contrato.updateMany).toHaveBeenCalledWith({
        where: { contratoId: { in: ['ct-1', 'ct-2'] }, tenantId: 'tenant-test' },
        data: { estado: 'APROBADO' },
      });
    });

    it('reporta los ids inexistentes como fallidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([
        { contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' },
      ] as any);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 1 } as any);

      const result = await bulkUpdateContratoStatusAction({ ids: ['ct-1', 'ct-inexistente'], estado: 'APROBADO' });

      expect(result.success).toBe(true);
      expect(result.data!.actualizados).toEqual(['ct-1']);
      expect(result.data!.fallidos).toEqual([
        { contratoId: 'ct-inexistente', motivo: 'Contrato no encontrado' },
      ]);
    });

    it('no lanza error cuando todos los contratos tienen transición inválida', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([
        { contratoId: 'ct-1', estado: 'BORRADOR' },
      ] as any);

      const result = await bulkUpdateContratoStatusAction({ ids: ['ct-1'], estado: 'ACTIVO' });

      expect(result.success).toBe(true);
      expect(result.data!.actualizados).toEqual([]);
      expect(result.data!.fallidos).toHaveLength(1);
      expect(prisma.contrato.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstadoContratoAction', () => {
    it('persiste una transición válida sin tocar el aprobador', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, estado: 'BORRADOR' } as any);
      vi.mocked(prisma.contrato.update).mockResolvedValue({ ...mockContrato, estado: 'PENDIENTE_APROBACION' } as any);

      const result = await cambiarEstadoContratoAction({ contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION' });

      expect(result.success).toBe(true);
      expect(prisma.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contratoId: 'ct-1' },
          data: expect.objectContaining({ estado: 'PENDIENTE_APROBACION', aprobadoPor: null, fechaAprobacion: null }),
        }),
      );
    });

    it('al aprobar asigna aprobador y fecha de aprobación desde el servidor', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, estado: 'PENDIENTE_APROBACION' } as any);
      vi.mocked(prisma.contrato.update).mockResolvedValue({ ...mockContrato, estado: 'APROBADO' } as any);

      const result = await cambiarEstadoContratoAction({ contratoId: 'ct-1', estado: 'APROBADO' });

      expect(result.success).toBe(true);
      expect(prisma.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'APROBADO', aprobadoPor: 'user-1', fechaAprobacion: expect.any(Date) }),
        }),
      );
    });

    it('rechaza una transición inválida con TRANSICION_INVALIDA sin mutar el contrato', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, estado: 'BORRADOR' } as any);

      const result = await cambiarEstadoContratoAction({ contratoId: 'ct-1', estado: 'ACTIVO' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('TRANSICION_INVALIDA');
      expect(prisma.contrato.update).not.toHaveBeenCalled();
    });

    it('retorna NOT_FOUND para un contrato de otro tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null);

      const result = await cambiarEstadoContratoAction({ contratoId: 'ct-otro', estado: 'ACTIVO' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('audita la transición con entidad CONTRATO', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, estado: 'BORRADOR' } as any);
      vi.mocked(prisma.contrato.update).mockResolvedValue({ ...mockContrato, estado: 'PENDIENTE_APROBACION' } as any);

      await cambiarEstadoContratoAction({ contratoId: 'ct-1', estado: 'PENDIENTE_APROBACION', motivo: 'Revisión inicial' });

      expect(AuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'UPDATE',
          entidad: 'CONTRATO',
          entidadId: 'ct-1',
          usuarioId: 'user-1',
          detalles: expect.objectContaining({ desde: 'BORRADOR', hacia: 'PENDIENTE_APROBACION', motivo: 'Revisión inicial' }),
        }),
      );
    });

    it('conserva el aprobador al activar o finalizar', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, estado: 'APROBADO', aprobadoPor: 'user-2' } as any);
      vi.mocked(prisma.contrato.update).mockResolvedValue({ ...mockContrato, estado: 'ACTIVO' } as any);

      await cambiarEstadoContratoAction({ contratoId: 'ct-1', estado: 'ACTIVO' });

      expect(prisma.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'ACTIVO' }),
        }),
      );
      const call = vi.mocked(prisma.contrato.update).mock.calls[0][0] as any;
      expect(call.data.aprobadoPor).toBeUndefined();
      expect(call.data.fechaAprobacion).toBeUndefined();
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getContratosAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
