import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  pagosalario: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  reconciliacionGasto: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  cuentaBancaria: {
    updateMany: vi.fn(),
  },
  cuentaPorPagar: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { deleteNominaHandler } from '@/features/empleados/api/nomina';

const user = {
  userId: 'user-1',
  name: 'Manager',
  email: 'manager@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
} as any;

const request = new NextRequest('http://localhost/api/empleados/nomina/pay-1', {
  method: 'DELETE',
});

describe('deleteNominaHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revierte únicamente reconciliaciones del mismo tenant antes de eliminar la nómina', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue({ pgId: 'pay-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            reconciliacionId: 'rec-1',
            tenantId: 'tenant-a',
            pgId: 'pay-1',
            cuentaId: 'account-1',
            monto: 125,
            montoConvertido: 125,
            cuentaPorPagarId: null,
          },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaBancaria: {
        findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaPorPagar: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(200);
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1', tenantId: 'tenant-a' },
      data: { saldo: { increment: 125 } },
    });
    expect(tx.reconciliacionGasto.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', pgId: 'pay-1' },
    });
    expect(tx.pagosalario.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', pgId: 'pay-1' },
    });
  });

  it('no elimina ni revierte cuando el salario no pertenece al tenant', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn(),
      },
      reconciliacionGasto: { findMany: vi.fn(), deleteMany: vi.fn() },
      cuentaBancaria: { findMany: vi.fn(), updateMany: vi.fn() },
      cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(404);
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.pagosalario.deleteMany).not.toHaveBeenCalled();
  });

  it('rechaza la reversión si la cuenta no existe y conserva la nómina', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue({ pgId: 'pay-1' }),
        deleteMany: vi.fn(),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            reconciliacionId: 'rec-1',
            tenantId: 'tenant-a',
            pgId: 'pay-1',
            cuentaId: 'account-1',
            monto: 125,
            montoConvertido: 125,
            cuentaPorPagarId: null,
          },
        ]),
        deleteMany: vi.fn(),
      },
      cuentaBancaria: {
        findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(409);
    expect(tx.pagosalario.deleteMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionGasto.deleteMany).not.toHaveBeenCalled();
  });

  it('restaura montoConvertido y revierte el saldo enlazado de CxP', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue({ pgId: 'pay-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            reconciliacionId: 'rec-1',
            tenantId: 'tenant-a',
            pgId: 'pay-1',
            cuentaId: 'account-1',
            monto: 100,
            montoConvertido: 300,
            cuentaPorPagarId: 'cxp-1',
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
      cuentaPorPagar: {
        findUnique: vi.fn().mockResolvedValue({
          cuentaPorPagarId: 'cxp-1',
          tenantId: 'tenant-a',
          montoDeuda: 300,
          montoPagado: 200,
          saldoPendiente: 100,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      pagoCuentaPorPagar: {
        findMany: vi.fn().mockResolvedValue([
          { pagoCuentaPorPagarId: 'payment-1', monto: 100, numeroTransaccion: 'rec-1' },
        ]),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(200);
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
      where: { cuentaId: 'account-1', tenantId: 'tenant-a' },
      data: { saldo: { increment: 300 } },
    });
    expect(tx.cuentaPorPagar.update).toHaveBeenCalledWith({
      where: { cuentaPorPagarId: 'cxp-1' },
      data: {
        montoPagado: 100,
        saldoPendiente: 200,
        estado: 'PARCIAL',
      },
    });
    expect(tx.pagoCuentaPorPagar.delete).toHaveBeenCalledWith({
      where: { pagoCuentaPorPagarId: 'payment-1' },
    });
  });

  it('no restaura cuentas para reconciliaciones PENDIENTE que nunca debitaron saldo', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue({ pgId: 'pay-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([
          {
            reconciliacionId: 'rec-pending',
            cuentaId: 'account-1',
            monto: 100,
            montoConvertido: 300,
            cuentaPorPagarId: null,
            estado: 'PENDIENTE',
          },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaBancaria: { findMany: vi.fn(), updateMany: vi.fn() },
      cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(200);
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
  });

  it('falla cerrado si el historial CxP no está enlazado a la reconciliación', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pagosalario: {
        findFirst: vi.fn().mockResolvedValue({ pgId: 'pay-1' }),
        deleteMany: vi.fn(),
      },
      reconciliacionGasto: {
        findMany: vi.fn().mockResolvedValue([{
          reconciliacionId: 'rec-1', cuentaId: 'account-1', monto: 100,
          montoConvertido: 100, cuentaPorPagarId: 'cxp-1', moneda: 'CUP', estado: 'PAGADA',
        }]),
        deleteMany: vi.fn(),
      },
      cuentaBancaria: {
        findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cuentaPorPagar: {
        findUnique: vi.fn().mockResolvedValue({
          cuentaPorPagarId: 'cxp-1', tenantId: 'tenant-a', montoDeuda: 100,
          montoPagado: 100, saldoPendiente: 0,
        }),
        update: vi.fn(),
      },
      pagoCuentaPorPagar: {
        findMany: vi.fn().mockResolvedValue([
          { pagoCuentaPorPagarId: 'payment-other', monto: 100, numeroTransaccion: 'other' },
        ]),
        delete: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const response = await deleteNominaHandler(
      request,
      { params: Promise.resolve({ id: 'pay-1' }) },
      user,
    );

    expect(response.status).toBe(409);
    expect(tx.pagoCuentaPorPagar.delete).not.toHaveBeenCalled();
    expect(tx.pagosalario.deleteMany).not.toHaveBeenCalled();
  });
});
