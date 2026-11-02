/**
 * @description Tests de coherencia del DELETE móvil de transferencias (Sesión B).
 *
 * El DELETE móvil es un segundo camino de cancelación y debe compartir la
 * semántica del desktop (`deleteTransferenciaAction`): revertir exactamente
 * las unidades que la transferencia movió (COMPLETADA y PARCIAL) y compensar
 * el kardex. Antes solo revertía stock y solo para COMPLETADA, de modo que una
 * PARCIAL dejaba unidades sin devolver y el kardex nunca se compensaba.
 */
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    transferencia: { findFirst: vi.fn(), updateMany: vi.fn() },
  };
  prismaMock.$transaction = vi.fn((cb: any) => cb(prismaMock));
  return { prismaMock };
});

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: { userId: 'user-test', tenantId: 'tenant-1' },
  })),
}));

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(async () => undefined),
}));

vi.mock('@/features/inventario/movimientos', async () => ({
  ...(await vi.importActual('@/features/inventario/movimientos')),
  registrarMovimiento: vi.fn(async () => undefined),
  revertirMovimientosDeOrigen: vi.fn(async () => undefined),
}));

import { DELETE as deleteTransfer } from '../transfers/[id]/route';
import { revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/**
 * @description Construye la fila de transferencia que devuelve el findFirst.
 * @param {Partial<Record<string, unknown>>} overrides - Campos a sobrescribir.
 * @returns {object} Fila de transferencia para el mock de Prisma.
 */
function transferenciaRow(overrides: Record<string, unknown> = {}) {
  return {
    transferenciaId: 't1',
    tenantId: 'tenant-1',
    estado: 'COMPLETADA',
    deletedAt: null,
    productoId: 'p1',
    cantidad: 10,
    cantidadRecibida: null,
    origenId: 'a1',
    destinoId: 'a2',
    puntoDeVentaOrigenId: null,
    puntoDeVentaDestinoId: null,
    ...overrides,
  };
}

describe('Mobile API: DELETE de transferencias — coherencia con el desktop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prismaMock.transferencia.updateMany as Mock).mockResolvedValue({ count: 1 });
  });

  it('revierte exactamente lo recibido de una PARCIAL y compensa el kardex', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(
      transferenciaRow({ estado: 'PARCIAL', cantidad: 10, cantidadRecibida: 4 }),
    );

    const response = await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(response.status).toBe(200);
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a1', delta: 4 }),
    );
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a2', delta: -4 }),
    );
    expect(revertirMovimientosDeOrigen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipoOrigen: 'TRANSFERENCIA', origenId: 't1' }),
    );
  });

  it('revierte el stock y el kardex de una COMPLETADA', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(transferenciaRow());

    const response = await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(response.status).toBe(200);
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a1', delta: 10 }),
    );
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a2', delta: -10 }),
    );
    expect(revertirMovimientosDeOrigen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipoOrigen: 'TRANSFERENCIA', origenId: 't1' }),
    );
  });

  it('revierte solo lo recibido de una COMPLETADA recibida parcialmente', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(
      transferenciaRow({ estado: 'COMPLETADA', cantidad: 10, cantidadRecibida: 4 }),
    );

    await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a1', delta: 4 }),
    );
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ubicacionId: 'a2', delta: -4 }),
    );
  });

  it('revierte el claim con la cantidad recibida para impedir una doble reversión', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(
      transferenciaRow({ estado: 'PARCIAL', cantidad: 10, cantidadRecibida: 4 }),
    );

    await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(prismaMock.transferencia.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transferenciaId: 't1',
          tenantId: 'tenant-1',
          deletedAt: null,
          estado: 'PARCIAL',
          cantidadRecibida: 4,
        }),
      }),
    );
  });

  it('responde 409 cuando otra cancelación ganó el claim', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(transferenciaRow());
    (prismaMock.transferencia.updateMany as Mock).mockResolvedValue({ count: 0 });

    const response = await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(response.status).toBe(409);
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(revertirMovimientosDeOrigen).not.toHaveBeenCalled();
  });

  it('oculta una transferencia legacy CANCELADA que todavía no tiene deletedAt', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(
      transferenciaRow({ estado: 'CANCELADA' }),
    );

    const response = await deleteTransfer(
      new NextRequest('http://localhost/api/mobile/transfers/t1'),
      ctx('t1'),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.transferencia.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'CANCELADA', deletedAt: null }),
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });
});
