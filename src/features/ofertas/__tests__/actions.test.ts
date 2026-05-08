/**
 * @description Tests unitarios para Server Actions de ofertas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', () => ({ applyFacturacionCobroWorkflow: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));

const mockTx = {
  oferta: { update: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getOfertasAction,
  getOfertaByIdAction,
  createOfertaAction,
  updateOfertaAction,
  deleteOfertaAction,
  facturarOfertaAction,
} from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('Ofertas Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getOfertasAction', () => {
    it('retorna lista del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findMany).mockResolvedValue([]);
      const result = await getOfertasAction();
      expect(result.success).toBe(true);
    });
  });

  describe('getOfertaByIdAction', () => {
    it('retorna oferta por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' } as any);
      const result = await getOfertaByIdAction('of-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null);
      const result = await getOfertaByIdAction('of-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createOfertaAction', () => {
    it('crea oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1', nombre: 'Test' });
      vi.mocked(prisma.oferta.create).mockResolvedValue({ ofertaId: 'of-1' } as any);

      const result = await createOfertaAction({
        clienteId: 'cli-1', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(true);
    });

    it('rechaza si cliente no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

      const result = await createOfertaAction({
        clienteId: 'cli-noexiste', subtotal: 1000, impuestos: 0, total: 1000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 1000, total: 1000 }],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateOfertaAction', () => {
    it('actualiza estado exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' });
      vi.mocked(prisma.oferta.update).mockResolvedValue({} as any);

      const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });
      expect(result.success).toBe(true);
    });
  });

  describe('facturarOfertaAction', () => {
    it('factura oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        ofertaId: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1',
        tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
        items: [],
        cliente: { clienteId: 'cli-1', nombre: 'Test' },
      });
      vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({ ventaId: 'ven-1' });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(true);
    });

    it('rechaza oferta ya facturada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
        ofertaId: 'of-1', estado: 'FACTURADA', tenantId: 'tenant-test',
      });

      const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('ya fue facturada');
    });
  });

  describe('deleteOfertaAction', () => {
    it('elimina oferta exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ofertaId: 'of-1' });
      vi.mocked(prisma.oferta.delete).mockResolvedValue({} as any);
      const result = await deleteOfertaAction('of-1');
      expect(result.success).toBe(true);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getOfertasAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
