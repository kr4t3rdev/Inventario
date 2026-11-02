/**
 * @description Tests de coherencia de cancelación y transición de transferencias
 *              (Sesión B).
 *
 * Cubre tres brechas detectadas al auditar el flujo completo:
 * - cancelar una COMPLETADA heredada que solo recibió parte devuelve lo
 *   recibido, no la cantidad enviada (el stock movido es lo recibido);
 * - aprobar y rechazar aplican un claim atómico tenant-scoped, de modo que dos
 *   decisiones concurrentes no puedan contradecirse;
 * - editar una COMPLETADA registra la nueva versión del kardex con una
 *   secuencia libre, para que el `upsert` no descarte silenciosamente el
 *   movimiento por colisión de clave de evento.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/notificaciones-utils', () => ({
  notificarTransferencia: vi.fn(),
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));

const mockTx = {
  transferencia: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  producto: { update: vi.fn(), findUnique: vi.fn() },
  stockMoveLine: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transferencia: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    producto: { findUnique: vi.fn() },
    stockUbicacion: { findUnique: vi.fn() },
    almacen: { findUnique: vi.fn(), findFirst: vi.fn() },
    puntoDeVenta: { findUnique: vi.fn(), findFirst: vi.fn() },
    ventaItem: { aggregate: vi.fn() },
    venta: { aggregate: vi.fn() },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { prisma } from '@/lib/prisma';
import {
  deleteTransferenciaAction,
  aprobarTransferenciaAction,
  rechazarTransferenciaAction,
  updateTransferenciaAction,
} from '@/features/transferencias/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'manager',
  permissions: new Set([
    'inventario.transferencias.aprobar',
    'inventario.transferencias.gestionar',
  ]),
};

describe('Sesión B — coherencia de cancelación y transición', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    mockTx.stockMoveLine.findMany.mockResolvedValue([]);
    mockTx.transferencia.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('H4 — COMPLETADA recibida parcialmente', () => {
    it('revierte solo las unidades recibidas y no la cantidad enviada', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'COMPLETADA',
        productoId: 'prod-1',
        cantidad: 10,
        cantidadRecibida: 4,
        origenId: 'alm-1',
        destinoId: 'alm-2',
        puntoDeVentaOrigenId: null,
        puntoDeVentaDestinoId: null,
      } as never);
      mockTx.transferencia.findUnique.mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'COMPLETADA',
        productoId: 'prod-1',
        cantidad: 10,
        cantidadRecibida: 4,
        origenId: 'alm-1',
        destinoId: 'alm-2',
        puntoDeVentaOrigenId: null,
        puntoDeVentaDestinoId: null,
      } as never);

      const result = await deleteTransferenciaAction('tr-1');

      expect(result.success).toBe(true);
      expect(upsertStockUbicacion).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ ubicacionId: 'alm-1', delta: 4 }),
      );
      expect(upsertStockUbicacion).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ ubicacionId: 'alm-2', delta: -4 }),
      );
      expect(upsertStockUbicacion).not.toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ delta: 10 }),
      );
    });
  });

  describe('H5 — claim atómico en aprobar/rechazar', () => {
    it('rechaza con un claim atómico acotado al tenant y al estado PENDIENTE', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'PENDIENTE',
      } as never);

      const result = await rechazarTransferenciaAction({
        transferenciaId: 'tr-1',
        motivo: 'Sin stock disponible',
      });

      expect(result.success).toBe(true);
      expect(mockTx.transferencia.updateMany).toHaveBeenCalledWith({
        where: {
          transferenciaId: 'tr-1',
          tenantId: 'tenant-test',
          deletedAt: null,
          estado: 'PENDIENTE',
        },
        data: { estado: 'RECHAZADA', descripcion: 'Sin stock disponible' },
      });
      expect(upsertStockUbicacion).not.toHaveBeenCalled();
    });

    it('devuelve CONFLICT cuando otra transición ganó el claim del rechazo', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'PENDIENTE',
      } as never);
      mockTx.transferencia.updateMany.mockResolvedValue({ count: 0 });

      const result = await rechazarTransferenciaAction({
        transferenciaId: 'tr-1',
        motivo: 'Sin stock disponible',
      });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error!.code).toBe('CONFLICT');
    });

    it('aprueba con un claim atómico acotado al tenant y al estado PENDIENTE', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'PENDIENTE',
        producto: { id: 'prod-1', precioCosto: 5 },
      } as never);

      const result = await aprobarTransferenciaAction({ transferenciaId: 'tr-1' });

      expect(result.success).toBe(true);
      expect(mockTx.transferencia.updateMany).toHaveBeenCalledWith({
        where: {
          transferenciaId: 'tr-1',
          tenantId: 'tenant-test',
          deletedAt: null,
          estado: 'PENDIENTE',
        },
        data: { estado: 'APROBADA' },
      });
    });

    it('devuelve CONFLICT cuando otra transición ganó el claim de la aprobación', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        tenantId: 'tenant-test',
        deletedAt: null,
        estado: 'PENDIENTE',
        producto: { id: 'prod-1', precioCosto: 5 },
      } as never);
      mockTx.transferencia.updateMany.mockResolvedValue({ count: 0 });

      const result = await aprobarTransferenciaAction({ transferenciaId: 'tr-1' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error!.code).toBe('CONFLICT');
    });
  });

  describe('H3 — secuencia del kardex al editar una COMPLETADA', () => {
    it('registra la nueva versión con una secuencia libre', async () => {
      vi.mocked(prisma.transferencia.findFirst).mockResolvedValue({
        transferenciaId: 'tr-1',
        cantidad: 3,
        cantidadRecibida: 3,
        estado: 'COMPLETADA',
        origenId: 'alm-1',
        destinoId: 'alm-2',
        productoId: 'prod-1',
        puntoDeVentaOrigenId: null,
        puntoDeVentaDestinoId: null,
        tenantId: 'tenant-test',
        deletedAt: null,
      } as never);
      mockTx.transferencia.update.mockResolvedValue({
        transferenciaId: 'tr-1',
        cantidad: 5,
      } as never);
      // La fila ya tiene SALIDA-1/ENTRADA-1 (segundo producto de un alta
      // múltiple): reescribir con la misma secuencia perdería el movimiento.
      mockTx.stockMoveLine.findMany.mockResolvedValue([
        {
          id: 'mv-1',
          tenantId: 'tenant-test',
          productoId: 'prod-1',
          tipoOrigen: 'TRANSFERENCIA',
          origenId: 'tr-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
          cantidad: -3,
          costoUnitario: 5,
          costoTotal: -15,
          secuencia: 'SALIDA-1',
          creadoPorId: 'user-1',
          createdAt: new Date(),
        },
        {
          id: 'mv-2',
          tenantId: 'tenant-test',
          productoId: 'prod-1',
          tipoOrigen: 'TRANSFERENCIA',
          origenId: 'tr-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-2',
          cantidad: 3,
          costoUnitario: 5,
          costoTotal: 15,
          secuencia: 'ENTRADA-1',
          creadoPorId: 'user-1',
          createdAt: new Date(),
        },
      ]);

      const result = await updateTransferenciaAction({
        transferenciaId: 'tr-1',
        productoId: 'prod-1',
        cantidad: 5,
        tipoOrigen: 'almacen',
        origenId: 'alm-1',
        tipoDestino: 'almacen',
        destinoId: 'alm-2',
      });

      expect(result.success).toBe(true);
      const secuencias = mockTx.stockMoveLine.upsert.mock.calls.map(
        (call) => (call[0] as { create: { secuencia: string } }).create.secuencia,
      );
      expect(secuencias).toContain('SALIDA-2');
      expect(secuencias).toContain('ENTRADA-2');
      expect(secuencias).not.toContain('SALIDA-1');
    });
  });
});
