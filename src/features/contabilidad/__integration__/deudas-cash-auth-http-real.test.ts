import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { POST as postCreate } from '@/app/api/contabilidad/deudas-cash/route';
import { POST as postPayment } from '@/app/api/contabilidad/deudas-cash/[id]/pagar/route';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = crypto.randomUUID();
const prefix = `deuda-cash-auth-${suffix}`;
const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;
let tenantId = '';
let otherTenantId = '';
let planId = '';
let managerId = '';
let dependentId = '';
let managerToken = '';
let dependentToken = '';
let vendorId = '';
let accountId = '';
let paymentTypeId = '';
let foreignPaymentTypeId = '';
let dependentDebtId = '';
let dependentPayableId = '';

/** @description Construye una petición autenticada o anónima para crear la deuda. */
function createRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ proveedorId: vendorId, montoCapital: 100, moneda: 'CUP',
      cuentaBancariaId: accountId }),
  });
}

/** @description Construye una petición autenticada o anónima para pagar una deuda. */
function paymentRequest(
  deudaId: string,
  token?: string,
  tipoPagoId = paymentTypeId,
): NextRequest {
  return new NextRequest(`http://localhost/api/contabilidad/deudas-cash/${deudaId}/pagar`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ monto: 30, cuentaId: accountId, tipoPagoId }),
  });
}

describe('deudas cash — ambos POST con sesión HTTP real', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port`;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const otherTenant = await prisma.tenant.create({ data: {
      nombre: `${prefix}-other`, slug: `${prefix}-other`,
    } });
    otherTenantId = otherTenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix,
      duracionDias: 365,
      features: { 'deudas-cash': true, 'contabilidad-formal': true },
    } });
    planId = plan.planId;
    await prisma.tenantLicense.create({ data: {
      tenantId,
      planId,
      activa: true,
      expiracion: new Date('2099-01-01'),
    } });

    const manager = await prisma.user.create({ data: {
      name: `${prefix}-manager`, email: `${prefix}-manager@test.local`, password: 'x',
    } });
    managerId = manager.userId;
    const dependent = await prisma.user.create({ data: {
      name: `${prefix}-dependent`, email: `${prefix}-dependent@test.local`, password: 'x',
    } });
    dependentId = dependent.userId;
    // Política contable requerida por los writers y el guard fail-closed del motor.
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: managerId },
    });
    await prisma.tenantMembership.createMany({ data: [
      { tenantId, userId: managerId, tenantRole: 'manager' },
      { tenantId, userId: dependentId, tenantRole: 'dependiente' },
    ] });

    managerToken = jwt.sign({ userId: managerId, email: manager.email, tenantId }, getJwtSecret());
    dependentToken = jwt.sign({ userId: dependentId, email: dependent.email, tenantId }, getJwtSecret());
    await prisma.userSession.createMany({ data: [
      { userId: managerId, token: managerToken, expiresAt: new Date(Date.now() + 3_600_000) },
      { userId: dependentId, token: dependentToken, expiresAt: new Date(Date.now() + 3_600_000) },
    ] });

    vendorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    accountId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldo: 1000,
    } })).cuentaId;
    paymentTypeId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    foreignPaymentTypeId = (await prisma.tipoPago.create({
      data: { tenantId: otherTenantId, nombre: 'Foreign type' },
    })).tipoId;

    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    await PeriodoGuard.assertWritable(new Date(), tenantId, 'asiento', {
      actorId: managerId,
      actorTipo: 'USUARIO',
      origen: { tipo: 'deuda_cash', id: prefix },
    });

    const payable = await prisma.cuentaPorPagar.create({ data: {
      tenantId,
      numeroFactura: `${prefix}-dependent`,
      proveedorId: vendorId,
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      moneda: 'CUP',
      tipo: 'compra',
      tipoDeuda: 'DEUDA_CASH',
      estado: 'PENDIENTE',
    } });
    dependentPayableId = payable.cuentaPorPagarId;
    dependentDebtId = (await prisma.deudaCash.create({ data: {
      tenantId,
      proveedorId: vendorId,
      cuentaPorPagarId: dependentPayableId,
      montoCapital: 100,
      moneda: 'CUP',
      cuentaBancariaId: accountId,
      createdById: managerId,
    } })).id;
  });

  afterAll(async () => {
    if (originalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = originalMode;
    if (!tenantId) return;

    const reconciliaciones = await prisma.reconciliacionVenta.findMany({
      where: { tenantId },
      select: { reconciliacionId: true },
    });
    const deudaIds = await prisma.deudaCash.findMany({
      where: { tenantId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({ where: {
      OR: [
        { entidad: 'DEUDA_CASH', entidadId: { in: deudaIds.map(({ id }) => id) } },
        { entidad: 'PAGO_DEUDA', entidadId: {
          in: reconciliaciones.map(({ reconciliacionId }) => reconciliacionId),
        } },
      ],
    } });
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.deudaCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId: { in: [managerId, dependentId] } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { userId: { in: [managerId, dependentId] } } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.delete({ where: { tenantId: otherTenantId } });
    await prisma.plan.delete({ where: { planId } });
  });

  it('rechaza 401 anónimo, permite al manager y deniega ambos POST al dependiente', async () => {
    const anonymousCreate = await postCreate(createRequest(), {});
    const anonymousPayment = await postPayment(paymentRequest(dependentDebtId), {
      params: Promise.resolve({ id: dependentDebtId }),
    });
    expect(anonymousCreate.status).toBe(401);
    expect(anonymousPayment.status).toBe(401);

    const managerCreate = await postCreate(createRequest(managerToken), {});
    expect(managerCreate.status).toBe(201);
    const { deuda } = await managerCreate.json();
    expect(await prisma.auditLog.findFirst({ where: {
      entidad: 'DEUDA_CASH', entidadId: deuda.id, usuarioId: managerId,
    } })).not.toBeNull();
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'deuda_cash', origenId: deuda.id,
    } })).toBe(1);

    const managerPayment = await postPayment(paymentRequest(dependentDebtId, managerToken), {
      params: Promise.resolve({ id: dependentDebtId }),
    });
    expect(managerPayment.status).toBe(201);
    const { reconciliacion } = await managerPayment.json();
    expect(await prisma.auditLog.findFirst({ where: {
      entidad: 'PAGO_DEUDA', entidadId: reconciliacion.reconciliacionId,
      usuarioId: managerId,
    } })).not.toBeNull();
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: reconciliacion.reconciliacionId,
    } })).toBe(1);

    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH',
    } });
    const saldoAntesTipoAjeno = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: accountId },
    })).saldo;
    const tipoAjeno = await postPayment(
      paymentRequest(dependentDebtId, managerToken, foreignPaymentTypeId),
      { params: Promise.resolve({ id: dependentDebtId }) },
    );
    expect(tipoAjeno.status).toBe(404);
    expect((await tipoAjeno.json()).code).toBe('NOT_FOUND');
    expect(await prisma.reconciliacionVenta.count({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH',
    } })).toBe(reconciliacionesAntes);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: accountId } })).saldo)
      .toEqual(saldoAntesTipoAjeno);

    const debtCount = await prisma.deudaCash.count({ where: { tenantId } });
    const paymentCount = await prisma.reconciliacionVenta.count({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH',
    } });
    const payableBefore = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: dependentPayableId },
    });
    const saldoBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: accountId },
    })).saldo;

    const dependentCreate = await postCreate(createRequest(dependentToken), {});
    const dependentPayment = await postPayment(paymentRequest(dependentDebtId, dependentToken), {
      params: Promise.resolve({ id: dependentDebtId }),
    });
    expect(dependentCreate.status).toBe(403);
    expect(dependentPayment.status).toBe(403);
    expect(await prisma.deudaCash.count({ where: { tenantId } })).toBe(debtCount);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH' },
    })).toBe(paymentCount);
    expect((await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: dependentPayableId },
    })).montoPagado).toEqual(payableBefore.montoPagado);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: accountId } })).saldo)
      .toEqual(saldoBefore);
  });
});
