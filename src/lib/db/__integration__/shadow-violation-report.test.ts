/**
 * @description Reporte de violaciones en modo shadow (AS-04 T1).
 * Ejecuta los patrones de query reales que emiten las features críticas
 * (ventas, productos, contabilidad, contratos, ofertas) dentro de contexto
 * tenant y con TENANT_ISOLATION_MODE=shadow: la suite falla si alguna
 * operación olvida el filtro (missing-scope) o usa tenant ajeno (mismatch),
 * y expone el reporte consolidado. Complementa a Correcciones Urgentes:
 * estos son los bugs que el enforcement hará imposibles.
 * Requiere: DATABASE_URL_TEST=... pnpm test:integration -- shadow-violation
 * @module src/lib/db/__integration__/shadow-violation-report.test
 */
process.env.TENANT_ISOLATION_MODE = 'shadow';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { prismaPlatform } from '@/lib/db/platform-prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { createViolationCollector } from '@/lib/db/scoped-prisma';

describe('AS-04 shadow: cero violaciones en features críticas', { timeout: 40_000 }, () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let tenantId = '';
  let userId = '';
  let clienteId = '';
  let catId = '';
  let prodId = '';
  const collector = createViolationCollector();

  beforeAll(async () => {
    const tenant = await prismaPlatform.tenant.create({
      data: { nombre: `Shadow ${suffix}`, slug: `shadow-${suffix}` },
    });
    tenantId = tenant.tenantId;

    const user = await prismaPlatform.user.create({
      data: { name: `Shadow ${suffix}`, email: `shadow-${suffix}@test.local`, password: 'x' },
    });
    userId = user.userId;

    const cat = await prismaPlatform.categoria.create({
      data: { nombre: `ShadowCat ${suffix}`, tenantId },
    });
    catId = cat.catId;

    const cliente = await prismaPlatform.cliente.create({
      data: { nombre: `ShadowCliente ${suffix}`, tenantId },
    });
    clienteId = cliente.clienteId;
  });

  afterAll(async () => {
    await prismaPlatform.oferta.deleteMany({ where: { tenantId } });
    await prismaPlatform.contrato.deleteMany({ where: { tenantId } });
    await prismaPlatform.categoria.deleteMany({ where: { tenantId } });
    await prismaPlatform.cliente.deleteMany({ where: { tenantId } });
    await prismaPlatform.tenant.deleteMany({ where: { tenantId } });
    await prismaPlatform.user.deleteMany({ where: { userId } });
  });

  it('patrones de lectura/agregación de ventas, productos y contabilidad no violan scope', async () => {
    // Ventas: findMany + aggregate + count (patrón de reportes-financieros)
    const ventas = await withTestTenant(tenantId, async () => {
      return await prisma.venta.findMany({});
    });
    expect(ventas).toEqual([]);

    await withTestTenant(tenantId, async () => {
      await prisma.venta.aggregate({ _sum: { total: true } });
      await prisma.venta.count({});
      await prisma.gastoCompra.findMany({});
      await prisma.merma.findMany({});
    });

    // Productos: findMany + findUnique + count
    await withTestTenant(tenantId, async () => {
      await prisma.producto.findMany({});
      await prisma.producto.count({});
      await prisma.categoria.findUnique({ where: { catId } });
    });
  });

  it('patrones de escritura de contratos y ofertas no violan scope', async () => {
    // Contrato: create + update + delete (con tenantId explícito como las actions)
    const contrato = await withTestTenant(tenantId, async () => {
      return await prisma.contrato.create({
        data: {
          tenantId,
          numeroContrato: `S-${suffix}`,
          numeroConsecutivo: 1,
          tipo: 'shadow',
          fechaInicio: new Date(),
          creadoPor: userId,
        },
      });
    });

    await withTestTenant(tenantId, async () => {
      await prisma.contrato.update({
        where: { contratoId: contrato.contratoId },
        data: { tipo: 'shadow2' },
      });
    });

    // Oferta: create + items anidados
    await withTestTenant(tenantId, async () => {
      const oferta = await prisma.oferta.create({
        data: {
          tenantId,
          numeroOferta: `O-${suffix}`,
          clienteId,
          subtotal: 0,
          total: 0,
          items: { create: [{ cantidad: 1, precioUnitario: 10, total: 10 }] },
        },
      });
      await prisma.oferta.delete({ where: { id: oferta.id } });
    });

    await withTestTenant(tenantId, async () => {
      await prisma.contrato.delete({ where: { contratoId: contrato.contratoId } });
    });
  });

  it('el reporte consolidado de violaciones está vacío', () => {
    const violations = collector.flush();
    expect(
      violations,
      `Violaciones de aislamiento detectadas:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
});