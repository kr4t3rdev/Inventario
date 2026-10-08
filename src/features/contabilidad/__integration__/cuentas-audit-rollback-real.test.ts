/**
 * @description R6-ROLLBACK — CxP/CxC revierten su mutación si falla AuditLog.
 *
 * Un trigger PostgreSQL BEFORE INSERT fuerza el fallo real de la auditoría.
 * La prueba verifica que cada operación conserva el estado persistido anterior.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const auth = vi.hoisted(() => ({
  userId: `audit-rollback-${crypto.randomUUID()}`,
  tenantId: '',
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => ({
    userId: auth.userId,
    tenantId: auth.tenantId,
    tenantRole: 'manager',
    role: 'admin',
    planFeatures: { 'cuentas-pagar': true, 'cuentas-cobrar': true },
    permissions: new Set(),
  }),
}));

const {
  createCuentaPorCobrarAction,
  createCuentaPorPagarAction,
  updateCuentaPorCobrarAction,
  anularCuentaPorCobrarAction,
} = await import(
  '@/features/contabilidad/actions-cuentas'
);

const prefix = `audit-rollback-${crypto.randomUUID()}`;
let tenantId = '';
let clienteId = '';
let cxcId = '';
let ventaId = '';
let puntoDeVentaId = '';
let triggerName = '';

const installAuditFailureTrigger = async () => {
  triggerName = `audit_fail_${crypto.randomUUID().replaceAll('-', '')}`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION "${triggerName}_fn"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'forced audit failure' USING ERRCODE = '22012';
      RETURN NEW;
    END $$`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "${triggerName}_fn"()`);
};

const removeAuditFailureTrigger = async () => {
  if (!triggerName) return;
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerName}_fn"()`);
  triggerName = '';
};

describe('R6-ROLLBACK — cuentas por pagar y cobrar ante fallo de AuditLog', {
  timeout: 120_000,
}, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    auth.tenantId = tenantId;
    puntoDeVentaId = (
      await prisma.puntoDeVenta.create({ data: { tenantId, nombre: `${prefix}-pv` } })
    ).pvId;
    clienteId = (
      await prisma.cliente.create({ data: { tenantId, nombre: `${prefix}-cliente` } })
    ).clienteId;
    ventaId = (
      await prisma.venta.create({
        data: {
          tenantId,
          puntoDeVentaId,
          clienteId,
          cantidad: 1,
          total: 300,
          estado: 'ENTREGADA',
        },
      })
    ).ventaId;
    cxcId = (
      await prisma.cuentaPorCobrar.create({
        data: {
          tenantId,
          clienteId,
          numeroFactura: `${prefix}-cxc`,
          montoDeuda: 125,
          montoPagado: 25,
          estado: 'PENDIENTE',
          tipoCuenta: 'VENTA',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await removeAuditFailureTrigger();
    if (!tenantId) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: auth.userId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.venta.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('revierte CxP create y CxC create/update/annul cuando AuditLog falla', async () => {
    const cxcAntes = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcId } });
    const cxpAntes = await prisma.cuentaPorPagar.count({ where: { tenantId } });
    const auditAntes = await prisma.auditLog.count({ where: { usuarioId: auth.userId } });

    await installAuditFailureTrigger();
    try {
      const cxpResult = await createCuentaPorPagarAction({
        numeroFactura: `${prefix}-cxp`,
        tipo: 'compra',
        proveedorId: `${prefix}-proveedor`,
        montoDeuda: 300,
      });
      expect(cxpResult.success).toBe(false);
      expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(cxpAntes);

      const cxcCreateResult = await createCuentaPorCobrarAction({
        ventaId,
        clienteId,
        monto: 300,
        moneda: 'CUP',
        numeroFactura: `${prefix}-cxc-create`,
      });
      expect(cxcCreateResult.success).toBe(false);
      expect(
        await prisma.cuentaPorCobrar.count({ where: { tenantId } }),
      ).toBe(1);

      const cxcResult = await anularCuentaPorCobrarAction({
        id: cxcId,
        motivo: 'rollback de auditoría',
      });
      expect(cxcResult.success).toBe(false);
      const cxcDespues = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcId } });
      expect(cxcDespues.estado).toBe(cxcAntes.estado);
      expect(cxcDespues.montoDeuda.toString()).toBe(cxcAntes.montoDeuda.toString());
      expect(cxcDespues.montoPagado.toString()).toBe(cxcAntes.montoPagado.toString());
      expect(await prisma.auditLog.count({ where: { usuarioId: auth.userId } })).toBe(auditAntes);

      const cxcUpdateResult = await updateCuentaPorCobrarAction({
        id: cxcId,
        montoPagado: 50,
      });
      expect(cxcUpdateResult.success).toBe(false);
      const cxcTrasUpdate = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcId } });
      expect(cxcTrasUpdate.estado).toBe(cxcAntes.estado);
      expect(cxcTrasUpdate.montoDeuda.toString()).toBe(cxcAntes.montoDeuda.toString());
      expect(cxcTrasUpdate.montoPagado.toString()).toBe(cxcAntes.montoPagado.toString());
    } finally {
      await removeAuditFailureTrigger();
    }
  });
});
