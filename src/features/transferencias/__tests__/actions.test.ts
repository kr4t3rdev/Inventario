/**
 * @description Tests unitarios para Server Actions de transferencias.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/notificaciones-utils', () => ({ notificarTransferencia: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

const mockTx = {
  transferencia: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
  producto: { update: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transferencia: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    producto: { findUnique: vi.fn() },
    almacen: { findUnique: vi.fn() },
    puntoDeVenta: { findUnique: vi.fn() },
    ventaItem: { aggregate: vi.fn() },
    venta: { aggregate: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getTransferenciasAction,
  getTransferenciaByIdAction,
  createTransferenciaAction,
  deleteTransferenciaAction,
} from '@/features/transferencias/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('Transferencias Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getTransferenciasAction', () => {
    it('retorna lista paginada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.transferencia.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transferencia.count).mockResolvedValue(0);

      const result = await getTransferenciasAction({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data!.pagination.total).toBe(0);
    });
  });

  describe('getTransferenciaByIdAction', () => {
    it('retorna transferencia por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({ transferenciaId: 'tr-1' } as any);
      const result = await getTransferenciaByIdAction('tr-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue(null);
      const result = await getTransferenciaByIdAction('tr-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createTransferenciaAction', () => {
    it('crea transferencia exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue({ id: 'prod-1', nombre: 'Test', stock: 100, precioCosto: 1000, tenantId: 'tenant-test' });
      vi.mocked(prisma.almacen.findUnique).mockResolvedValue({ almacenId: 'alm-1', nombre: 'Almacén 1' });
      vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue({ pvId: 'pv-1', nombre: 'PV 1' });
      mockTx.transferencia.count.mockResolvedValue(0);
      mockTx.transferencia.create.mockResolvedValue({ transferenciaId: 'tr-1' });

      const result = await createTransferenciaAction({
        productos: [{ productoId: 'prod-1', cantidad: 5 }],
        tipoOrigen: 'almacen', origenId: 'alm-1',
        tipoDestino: 'punto_venta', destinoId: 'pv-1',
      });

      expect(result.success).toBe(true);
    });

    it('rechaza origen=destino', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const result = await createTransferenciaAction({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        tipoOrigen: 'almacen', origenId: 'alm-1',
        tipoDestino: 'almacen', destinoId: 'alm-1',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza stock insuficiente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue({ id: 'prod-1', nombre: 'Test', stock: 2, precioCosto: 1000, tenantId: 'tenant-test' });
      vi.mocked(prisma.almacen.findUnique).mockResolvedValue({ almacenId: 'alm-1', nombre: 'Almacén 1' });
      vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue({ pvId: 'pv-1', nombre: 'PV 1' });

      const result = await createTransferenciaAction({
        productos: [{ productoId: 'prod-1', cantidad: 5 }],
        tipoOrigen: 'almacen', origenId: 'alm-1',
        tipoDestino: 'punto_venta', destinoId: 'pv-1',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('STOCK_INSUFICIENTE');
    });
  });

  describe('deleteTransferenciaAction', () => {
    it('cancela transferencia exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1', estado: 'COMPLETADA', cantidad: 5,
        origenId: 'alm-1', destinoId: null, productoId: 'prod-1',
        tenantId: 'tenant-test', deletedAt: null,
        producto: { unidad: { simbolo: 'u' }, nombre: 'Test' } as any,
        origen: { nombre: 'Almacén 1' } as any,
        destino: null, puntoDeVentaOrigen: null, puntoDeVentaDestino: null,
      });

      const result = await deleteTransferenciaAction('tr-1');
      expect(result.success).toBe(true);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getTransferenciasAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
