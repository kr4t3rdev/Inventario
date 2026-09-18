/**
 * @description Integración del scope de TransaccionMoneda (AS-05 T.3).
 * Con el modelo en scoped y TENANT_ISOLATION_MODE=enforce: tenant A no ve ni
 * muta transacciones de B; create inyecta el tenant del contexto; create con
 * tenant ajeno es rechazado; sin contexto falla cerrado.
 * Requiere: DATABASE_URL_TEST=... pnpm test:integration -- transaccion-moneda
 * @module src/lib/db/__integration__/transaccion-moneda-tenant.test
 */
process.env.TENANT_ISOLATION_MODE = 'enforce';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { prismaPlatform } from '@/lib/db/platform-prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { TenantMismatchError, TenantContextRequiredError } from '@/lib/db/scoped-prisma';

describe('AS-05 TransaccionMoneda tenant-scoped', { timeout: 30_000 }, () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let tenantA = '';
  let tenantB = '';
  let gastoA = '';
  let gastoB = '';

  beforeAll(async () => {
    await prismaPlatform.moneda.upsert({
      where: { codigo: 'USD' },
      create: { codigo: 'USD', nombre: 'Dolar', simbolo: '$' },
      update: {},
    });
    const a = await prismaPlatform.tenant.create({
      data: { nombre: `TM A ${suffix}`, slug: `tm-a-${suffix}` },
    });
    const b = await prismaPlatform.tenant.create({
      data: { nombre: `TM B ${suffix}`, slug: `tm-b-${suffix}` },
    });
    tenantA = a.tenantId;
    tenantB = b.tenantId;
    const ga = await prismaPlatform.gastosDE.create({
      data: { tenantId: tenantA, proveedor: 'A', monto: 10, periodo: '2026-09' },
    });
    const gb = await prismaPlatform.gastosDE.create({
      data: { tenantId: tenantB, proveedor: 'B', monto: 10, periodo: '2026-09' },
    });
    gastoA = ga.gastosDEId;
    gastoB = gb.gastosDEId;
  });

  afterAll(async () => {
    await prismaPlatform.transaccionMoneda.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prismaPlatform.gastosDE.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prismaPlatform.tenant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  });

  it('create inyecta el tenant desde el contexto', async () => {
    const tx = await withTestTenant(tenantA, async () => {
      return await prisma.transaccionMoneda.create({
        data: {
          tipoTransaccion: 'gasto',
          referenciaId: gastoA,
          monedaId: 'USD',
          montoOriginal: 5,
          tasaCambio: 24,
          montoConvertido: 120,
        },
      });
    });
    expect(tx.tenantId).toBe(tenantA);
  });

  it('create con tenant ajeno es rechazado antes de tocar la base', async () => {
    let error: unknown;
    try {
      await withTestTenant(tenantA, async () => {
        return await prisma.transaccionMoneda.create({
          data: {
            tenantId: tenantB,
            tipoTransaccion: 'gasto',
            referenciaId: gastoB,
            monedaId: 'USD',
            montoOriginal: 1,
            tasaCambio: 24,
            montoConvertido: 24,
          },
        });
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantMismatchError);
  });

  it('lectura cruzada devuelve vacío aunque se pida el id ajeno', async () => {
    const cross = await withTestTenant(tenantA, async () => {
      return await prisma.transaccionMoneda.findFirst({
        where: { referenciaId: gastoB },
      });
    });
    expect(cross).toBeNull();

    const all = await withTestTenant(tenantA, async () => {
      return await prisma.transaccionMoneda.findMany({});
    });
    expect(all.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it('update/delete cruzados no afectan (P2025)', async () => {
    const created = await prismaPlatform.transaccionMoneda.create({
      data: {
        tenantId: tenantB,
        tipoTransaccion: 'gasto',
        referenciaId: gastoB,
        monedaId: 'USD',
        montoOriginal: 3,
        tasaCambio: 24,
        montoConvertido: 72,
      },
    });

    const updateErr = await withTestTenant(tenantA, async () => {
      return await prisma.transaccionMoneda
        .update({ where: { transaccionId: created.transaccionId }, data: { montoOriginal: 99 } })
        .catch((e: unknown) => e);
    }) as { code?: string };
    expect(updateErr?.code).toBe('P2025');

    const deleteErr = await withTestTenant(tenantA, async () => {
      return await prisma.transaccionMoneda
        .delete({ where: { transaccionId: created.transaccionId } })
        .catch((e: unknown) => e);
    }) as { code?: string };
    expect(deleteErr?.code).toBe('P2025');

    const intact = await prismaPlatform.transaccionMoneda.findUnique({
      where: { transaccionId: created.transaccionId },
    });
    expect(intact?.tenantId).toBe(tenantB);
  });

  it('sin contexto en enforce falla cerrado', async () => {
    let error: unknown;
    try {
      await prisma.transaccionMoneda.findMany({});
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TenantContextRequiredError);
  });
});