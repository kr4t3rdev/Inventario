import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST as POST_CREATE } from '@/app/api/contabilidad/prestamos-cash/route';
import { POST } from '@/app/api/contabilidad/prestamos-cash/[id]/pagar/route';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
    logStrict: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/services/validate-period-write', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/validate-period-write')>();
  return { ...original, validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }) };
});

const suffix = crypto.randomUUID();
const prefix = `prestamo-cash-auth-${suffix}`;
let tenantId = '';
let otherTenantId = '';
let planId = '';
let managerId = '';
let dependentId = '';
let managerToken = '';
let dependentToken = '';
let clienteId = '';
let cuentaId = '';
let cuentaCreateId = '';
let tipoPagoId = '';
let foreignTipoPagoId = '';
let managerPrestamoId = '';
let managerCxcId = '';
let dependentPrestamoId = '';
let dependentCxcId = '';
const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;

/** @description Construye POST de pago con la sesión JWT real en el header Bearer. */
function paymentRequest(
  prestamoId: string,
  token?: string,
  tipoPago = tipoPagoId,
): NextRequest {
  return new NextRequest(`http://localhost/api/contabilidad/prestamos-cash/${prestamoId}/pagar`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ monto: 30, cuentaId, tipoPagoId: tipoPago }),
  });
}

/** @description Construye POST del canal web de creación con JWT Bearer opcional. */
function createRequest(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({
      clienteId,
      montoCapital: 25,
      moneda: 'CUP',
      cuentaBancariaId: cuentaCreateId,
    }),
  });
}

/** @description Crea fixture aislada para certificar permiso en el pago legacy web. */
describe('pago de préstamo cash — permiso y sesión HTTP real', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({ db: target.pathname.slice(1), port: Number(target.port) });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const otherTenant = await prisma.tenant.create({ data: {
      nombre: `${prefix}-other`, slug: `${prefix}-other`,
    } });
    otherTenantId = otherTenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'prestamos-cash': true, 'contabilidad-formal': true },
    } });
    planId = plan.planId;
    await prisma.tenantLicense.create({ data: {
      tenantId, planId, activa: true, expiracion: new Date('2099-01-01'),
    } });

    const manager = await prisma.user.create({
      data: { name: `${prefix}-manager`, email: `${prefix}-manager@test.local`, password: 'x' },
    });
    managerId = manager.userId;
    const dependent = await prisma.user.create({
      data: { name: `${prefix}-dependent`, email: `${prefix}-dependent@test.local`, password: 'x' },
    });
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
      { userId: managerId, token: managerToken, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      { userId: dependentId, token: dependentToken, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    ] });

    clienteId = (await prisma.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldo: 0,
    } })).cuentaId;
    cuentaCreateId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-create`, numeroCuenta: `${prefix}-create`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000,
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } })).tipoId;
    foreignTipoPagoId = (await prisma.tipoPago.create({ data: {
      tenantId: otherTenantId, nombre: 'Foreign type',
    } })).tipoId;
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });

    const managerCxc = await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 100, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    managerCxcId = managerCxc.id;
    managerPrestamoId = (await prisma.prestamoCash.create({ data: {
      tenantId, clienteId, cuentaPorCobrarId: managerCxcId,
      montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaId, createdById: managerId,
    } })).id;

    const dependentCxc = await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 100, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    dependentCxcId = dependentCxc.id;
    dependentPrestamoId = (await prisma.prestamoCash.create({ data: {
      tenantId, clienteId, cuentaPorCobrarId: dependentCxcId,
      montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaId, createdById: managerId,
    } })).id;
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (originalMode !== undefined) process.env.CONTABILIDAD_FORMAL_MODE = originalMode;
    if (!tenantId) return;
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId: { in: [managerId, dependentId] } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
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
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.delete({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { userId: { in: [managerId, dependentId] } } });
    await prisma.plan.deleteMany({ where: { planId } });
  });

  it('certifies direct web loan creation with Bearer auth and rejects a dependent', async () => {
    const anonymous = await POST_CREATE(createRequest(), { params: Promise.resolve({}) });
    expect(anonymous.status).toBe(401);

    const managerResponse = await POST_CREATE(createRequest(managerToken), {
      params: Promise.resolve({}),
    });
    expect(managerResponse.status).toBe(201);
    const managerBody = await managerResponse.json();
    const createdLoanId = managerBody.prestamo.id as string;
    expect(createdLoanId).toBeTruthy();
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaCreateId } }))
      .saldo.toString()).toBe('975');
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: createdLoanId },
    })).toBe(1);

    const prestamosAntes = await prisma.prestamoCash.count({ where: { tenantId } });
    const dependentResponse = await POST_CREATE(createRequest(dependentToken), {
      params: Promise.resolve({}),
    });
    expect(dependentResponse.status).toBe(403);
    expect(await prisma.prestamoCash.count({ where: { tenantId } })).toBe(prestamosAntes);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaCreateId } }))
      .saldo.toString()).toBe('975');
  });

  it('rechaza 401 anónimo, permite manager autenticado y deniega dependiente antes de mutar', async () => {
    const anonymous = await POST(paymentRequest(managerPrestamoId), {
      params: Promise.resolve({ id: managerPrestamoId }),
    });
    expect(anonymous.status).toBe(401);

    const managerResponse = await POST(paymentRequest(managerPrestamoId, managerToken), {
      params: Promise.resolve({ id: managerPrestamoId }),
    });
    expect(managerResponse.status).toBe(201);
    const cxcPagada = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: managerCxcId } });
    expect(cxcPagada.montoPagado.toString()).toBe('30');
    expect(cxcPagada.estado).toBe('PARCIAL');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString()).toBe('30');

    const reconciliacionesAntesDeTipoAjeno = await prisma.reconciliacionVenta.count({
      where: { tenantId },
    });
    const tipoAjenoResponse = await POST(paymentRequest(
      dependentPrestamoId, managerToken, foreignTipoPagoId,
    ), { params: Promise.resolve({ id: dependentPrestamoId }) });
    expect(tipoAjenoResponse.status).toBe(404);
    expect((await tipoAjenoResponse.json()).code).toBe('NOT_FOUND');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } }))
      .toBe(reconciliacionesAntesDeTipoAjeno);
    expect((await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: dependentCxcId } }))
      .montoPagado.toString()).toBe('0');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString()).toBe('30');

    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({ where: { tenantId } });
    const dependienteResponse = await POST(paymentRequest(dependentPrestamoId, dependentToken), {
      params: Promise.resolve({ id: dependentPrestamoId }),
    });
    expect(dependienteResponse.status).toBe(403);
    const cxcDependiente = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: dependentCxcId } });
    expect(cxcDependiente.montoPagado.toString()).toBe('0');
    expect(cxcDependiente.estado).toBe('PENDIENTE');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(reconciliacionesAntes);
  });
});
