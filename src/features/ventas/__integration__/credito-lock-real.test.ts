import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { validarCreditoOrigen } from '@/features/ventas/services/credito-override';

const slug = `credito-lock-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
let tenantId: string | null = null;

const writer: AuthenticatedUser = {
  userId: 'integration-writer',
  role: 'user',
  tenantRole: 'manager',
  permissions: new Set(),
} as unknown as AuthenticatedUser;

describe('cupo común: lock por cliente en PostgreSQL', () => {
  afterAll(async () => {
    if (!tenantId) return;
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('serializa dos orígenes y no confirma ambos créditos que exceden juntos el límite', async () => {
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Crédito lock integration', slug },
    });
    tenantId = tenant.tenantId;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Cliente lock integration', tenantId, limiteCredito: 100 },
    });

    let arrivals = 0;
    let releaseBarrier!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const writerAttempt = (origen: 'VENTA_PRODUCTOS' | 'PRESTAMO_CASH') =>
      prisma.$transaction(async (tx) => {
        arrivals += 1;
        if (arrivals === 2) releaseBarrier();
        await bothArrived;

        const decision = await validarCreditoOrigen({
          tx,
          user: writer,
          tenantId: tenant.tenantId,
          clienteId: cliente.clienteId,
          moneda: 'CUP',
          montoNuevo: 60,
          permiso: origen === 'VENTA_PRODUCTOS'
            ? 'ventas.venta.credito-override'
            : 'financiero.prestamos-cash.credito-override',
        });

        if (decision.exceeded) throw new Error('Se detectó un exceso inesperado');
        await tx.cuentaPorCobrar.create({
          data: {
            tenantId: tenant.tenantId,
            clienteId: cliente.clienteId,
            montoDeuda: 60,
            montoPagado: 0,
            monedaOriginal: 'CUP',
            montoOriginal: 60,
            tipoCuenta: origen,
            estado: 'PENDIENTE',
          },
        });
        return origen;
      });

    const results = await Promise.allSettled([
      writerAttempt('VENTA_PRODUCTOS'),
      writerAttempt('PRESTAMO_CASH'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const accounts = await prisma.cuentaPorCobrar.findMany({
      where: { tenantId: tenant.tenantId, clienteId: cliente.clienteId },
      select: { montoDeuda: true, montoPagado: true },
    });
    expect(accounts).toHaveLength(1);
    expect(Number(accounts[0]?.montoDeuda) - Number(accounts[0]?.montoPagado)).toBe(60);
  });
});
