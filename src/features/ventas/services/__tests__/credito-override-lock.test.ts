import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { validarCreditoOrigen } from '@/features/ventas/services/credito-override';

describe('validarCreditoOrigen: lock compartido por cliente', () => {
  it('adquiere FOR UPDATE tenant-scoped antes de leer límite y CxC', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ clienteId: 'cliente-1' }]),
      cliente: {
        findFirst: vi.fn().mockResolvedValue({ clienteId: 'cliente-1', limiteCredito: 500 }),
      },
      cuentaPorCobrar: {
        findMany: vi.fn().mockResolvedValue([
          { montoDeuda: 100, montoPagado: 0, monedaOriginal: 'CUP' },
        ]),
      },
    } as unknown as Prisma.TransactionClient;

    await validarCreditoOrigen({
      tx,
      user: {
        userId: 'manager-1',
        role: 'user',
        tenantRole: 'manager',
        permissions: new Set(),
      } as unknown as AuthenticatedUser,
      tenantId: 'tenant-1',
      clienteId: 'cliente-1',
      moneda: 'CUP',
      montoNuevo: 50,
      permiso: 'ventas.venta.credito-override',
    });

    const raw = vi.mocked(tx.$queryRaw);
    expect(raw).toHaveBeenCalledOnce();
    const sql = String(raw.mock.calls[0]?.[0]);
    expect(sql).toContain('FOR UPDATE');
    expect(raw.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(tx.cliente.findFirst).mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(vi.mocked(tx.cliente.findFirst).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(tx.cuentaPorCobrar.findMany).mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('falla cerrada si el cliente no puede bloquearse en la transacción', async () => {
    const tx = {
      cliente: { findFirst: vi.fn() },
      cuentaPorCobrar: { findMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      validarCreditoOrigen({
        tx,
        user: { userId: 'manager-1' } as AuthenticatedUser,
        tenantId: 'tenant-1',
        clienteId: 'cliente-1',
        moneda: 'CUP',
        montoNuevo: 50,
        permiso: 'ventas.venta.credito-override',
      }),
    ).rejects.toMatchObject({ code: 'CREDITO_LOCK_NO_DISPONIBLE' });
  });
});
