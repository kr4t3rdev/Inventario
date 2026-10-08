import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transaction, tx, postEvento } = vi.hoisted(() => {
  const tx = {
    ordenProduccion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    producto: { findUnique: vi.fn(), update: vi.fn() },
    ordenProduccionHistorial: { create: vi.fn() },
    reconciliacionGasto: { create: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({
        tenantId: 'tenant-a', functionalCurrencyCode: 'CUP',
      }),
    },
  };
  return { transaction: vi.fn(), tx, postEvento: vi.fn() };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    reconciliacionGasto: { create: vi.fn(() => Promise.reject(new Error('outside tx'))) },
  },
}));
vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: (...args: unknown[]) => unknown) => handler,
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-a',
  requireFeature: vi.fn(),
  requirePermission: vi.fn((user: { allowed?: boolean }) => {
    if (!user.allowed) throw new Error('No tienes permisos');
  }),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento }));

import { POST as _POST } from './route';
const POST: RawHandler = _POST as unknown as RawHandler;
import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
type RawHandler = (request: NextRequest, context: any, user: AuthenticatedUser) => Promise<Response>;

describe('atomicidad al completar producción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.ordenProduccion.findUnique.mockResolvedValue({
      tenantId: 'tenant-a', estado: 'EN_PROCESO', cantidad: 1,
      Receta: { Producto: { id: 'producto' }, productoId: 'producto', rendimiento: 1,
        RecetaIngrediente: [{ productoId: 'insumo', cantidad: 1, unidadSimbolo: 'u', desperdicio: 0 }] },
    });
    tx.producto.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'insumo' ? { precioCosto: 10 } : { id: 'producto', almacenId: null, stock: 0 });
    tx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'orden', tenantId: 'tenant-a', cantidad: 1 });
    transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta', tenantId: 'tenant-a', moneda: 'CUP' });
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'efectivo', tenantId: 'tenant-a' });
  });

  it('revierte la operación si falla la reconciliación y usa el mismo cliente que el asiento', async () => {
    tx.reconciliacionGasto.create.mockRejectedValue(new Error('reconciliación fallida'));
    const response = await POST(
      new Request('http://localhost/api/produccion/ordenes/orden/completar', {
        method: 'POST', body: JSON.stringify({ cuentaId: 'cuenta', tipoPagoId: 'efectivo' }),
      }) as never,
      { params: Promise.resolve({ id: 'orden' }) },
      { userId: 'usuario', tenantId: 'tenant-a', allowed: true } as never,
    );
    expect(response.status).toBe(500);
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledOnce();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('registra reconciliación y posteo dentro de la transacción exitosa', async () => {
    tx.reconciliacionGasto.create.mockResolvedValue({ reconciliacionId: 'rec' });
    const response = await POST(
      new Request('http://localhost/api/produccion/ordenes/orden/completar', {
        method: 'POST', body: JSON.stringify({ cuentaId: 'cuenta' }),
      }) as never,
      { params: Promise.resolve({ id: 'orden' }) },
      { userId: 'usuario', tenantId: 'tenant-a', allowed: true } as never,
    );
    expect(response.status).toBe(200);
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledOnce();
    expect(postEvento).toHaveBeenCalledWith(tx, expect.anything(), expect.anything());
    expect(tx.cuentaBancaria.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cuentaId: 'cuenta', tenantId: 'tenant-a', moneda: 'CUP' }),
    }));
    expect(tx.tipoPago.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tipoId: 'efectivo', tenantId: 'tenant-a' }),
    }));
  });

  it.each([
    [{ cuentaId: 'cuenta', tipoPagoId: 'efectivo' }, 'cuentaBancaria'],
    [{ cuentaId: 'cuenta', tipoPagoId: 'efectivo' }, 'tipoPago'],
  ] as const)('rechaza referencias ajenas antes de cambiar stock (%s, %s)', async (body, model) => {
    tx[model].findFirst.mockResolvedValue(null);
    const response = await POST(new Request('http://localhost/completar', {
      method: 'POST', body: JSON.stringify(body),
    }) as never, { params: Promise.resolve({ id: 'orden' }) },
    { userId: 'usuario', tenantId: 'tenant-a', allowed: true } as never);
    expect(response.status).toBe(400);
    expect(tx.producto.update).not.toHaveBeenCalled();
  });

  it('rechaza cuenta omitida con costo positivo sin modificar stock', async () => {
    const response = await POST(new Request('http://localhost/completar', {
      method: 'POST', body: '{}',
    }) as never, { params: Promise.resolve({ id: 'orden' }) },
    { userId: 'usuario', tenantId: 'tenant-a', allowed: true } as never);
    expect(response.status).toBe(400);
    expect(tx.producto.update).not.toHaveBeenCalled();
  });

  it('rechaza actor sin permiso antes de abrir la transacción', async () => {
    const response = await POST(new Request('http://localhost/completar', {
      method: 'POST', body: JSON.stringify({ cuentaId: 'cuenta' }),
    }) as never, { params: Promise.resolve({ id: 'orden' }) },
    { userId: 'usuario', tenantId: 'tenant-a', allowed: false } as never);
    expect(response.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });
});
