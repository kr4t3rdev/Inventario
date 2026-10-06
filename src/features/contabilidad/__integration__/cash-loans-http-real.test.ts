/**
 * @description Sesión HTTP Bearer real end-to-end y carrera multi-conexión del canal
 * móvil de préstamos cash (`/api/mobile/v1/accounting/cash-loans/**`), filas 9/10 de
 * la matriz R0.5:
 * 1) login Bearer exitoso end-to-end: JWT + UserSession + membresía manager +
 *    licencia/plan reales resuelven contexto y permisos sin sustituir `authenticateUser`;
 * 2) pago móvil acredita cuenta, actualiza CxC y contabiliza un asiento por origen;
 * 3) carrera multi-conexión: pagos concurrentes serializados por el lock del tenant
 *    no exceden el saldo del préstamo (uno gana, el otro CREDITO_CONFLICTO).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST as MOBILE_POST_CREAR } from '@/app/api/mobile/v1/accounting/cash-loans/route';
import { POST as MOBILE_POST_PAGO } from '@/app/api/mobile/v1/accounting/cash-loans/[id]/payments/route';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));

const prefix = `cta-loans-http-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let token = '';
let clienteId = '';
let cuentaOrigenId = '';
let cuentaPagoId = '';
let tipoPagoId = '';
let loanId = '';
let raceLoanId = '';

/** @description Solicitud POST al canal móvil con Bearer opcional. */
function requestMovil(url: string, body: Record<string, unknown>, withToken = true): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('canal móvil cash-loans — sesión Bearer real y carrera', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, 'prestamos-cash': true },
    } });
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.local`, password: 'x' },
    });
    userId = user.userId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
    });
    // Política contable requerida por los writers y el guard fail-closed del motor.
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    token = jwt.sign({ userId, email: user.email, tenantId }, getJwtSecret());
    await prisma.userSession.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    })).clienteId;
    cuentaOrigenId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-origen`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    cuentaPagoId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({
      data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', fechaInicio: mesInicio, fechaFin: mesFin },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('rechaza 401 sin token y crea préstamo con sesión Bearer real', async () => {
    const anonimo = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-loans',
      { clienteId, montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      false,
    ));
    expect(anonimo.status).toBe(401);

    const response = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-loans',
      { clienteId, montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
    ));
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    loanId = data.id;
    expect(loanId).toBeTruthy();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo.toString()).toBe('4900');
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', reconciliadoPor: userId,
    } });
    expect(rec.monto.toString()).toBe('100');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'prestamo_cash', origenId: loanId,
    } });
    expect(asientos).toHaveLength(1);
  });

  it('pago móvil con Bearer acredita cuenta, actualiza CxC y contabiliza un asiento', async () => {
    const response = await MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-loans/${loanId}/payments`,
      { monto: 40, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
    ), { params: Promise.resolve({ id: loanId }) });
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const rec = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: data.reconciliacionId },
    });
    expect(rec.tasaCambio?.toString()).toBe('1');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo.toString()).toBe('40');
    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: (await prisma.prestamoCash.findUniqueOrThrow({ where: { id: loanId } }))
        .cuentaPorCobrarId },
    });
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.estado).toBe('PARCIAL');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId,
    } });
    expect(asientos).toHaveLength(1);
  });

  it('convierte desembolso y pago USD en cuentas CUP del canal móvil Bearer', async () => {
    const saldoOrigenAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo);
    const createdResponse = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-loans',
      { clienteId, montoCapital: 100, moneda: 'USD', tasaCambioAlCrear: 24,
        cuentaBancariaId: cuentaOrigenId },
    ));
    expect(createdResponse.status, await createdResponse.clone().text()).toBe(200);
    const created = await createdResponse.json();
    const loan = await prisma.prestamoCash.findUniqueOrThrow({
      where: { id: created.id }, include: { cuentaPorCobrar: true },
    });
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo)).toBe(saldoOrigenAntes - 2400);

    const saldoPagoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo);
    const paymentResponse = await MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-loans/${loan.id}/payments`,
      { monto: 10, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'USD', tasaCambio: 25 },
    ), { params: Promise.resolve({ id: loan.id }) });
    expect(paymentResponse.status, await paymentResponse.clone().text()).toBe(200);
    const payment = await paymentResponse.json();
    const receipt = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: payment.reconciliacionId },
    });
    const receivable = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: loan.cuentaPorCobrarId },
    });
    expect(Number(receipt.montoConvertido)).toBe(250);
    expect(Number(receivable.montoPagado)).toBe(10);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo)).toBe(saldoPagoAntes + 250);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: receipt.reconciliacionId,
    } })).toBe(1);
  });

  it('carrera multi-conexión: pagos concurrentes no exceden el saldo del préstamo', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    raceLoanId = loan.id;
    const cxcRaceId = loan.cuentaPorCobrar.id;

    const resultados = await Promise.allSettled([
      MOBILE_POST_PAGO(requestMovil(
        `http://localhost/api/mobile/v1/accounting/cash-loans/${raceLoanId}/payments`,
        { monto: 600, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
      ), { params: Promise.resolve({ id: raceLoanId }) }),
      MOBILE_POST_PAGO(requestMovil(
        `http://localhost/api/mobile/v1/accounting/cash-loans/${raceLoanId}/payments`,
        { monto: 600, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
      ), { params: Promise.resolve({ id: raceLoanId }) }),
    ]);
    const respuestas = resultados
      .filter((r): r is PromiseSettledResult<import('next/server').NextResponse> =>
        r.status === 'fulfilled')
      .map((r) => r.value);
    expect(respuestas).toHaveLength(2);
    const cuerpos = await Promise.all(respuestas.map(async (r) => ({
      status: r.status,
      body: await r.clone().json(),
    })));
    const estados = respuestas.map((r) => r.status);
    expect(estados, JSON.stringify(cuerpos)).toEqual(expect.arrayContaining([200, 400]));
    expect(estados).toHaveLength(2);
    const perdedor = cuerpos.find((r) => r.status === 400);
    expect(perdedor?.body).toMatchObject({ code: 'CREDITO_CONFLICTO' });

    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcRaceId } });
    expect(cxc.montoPagado.toString()).toBe('600');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo.toString()).toBe('890');
  });

  it('reintento móvil de pago de préstamo ya pagado no duplica (idempotencia por estado)', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const pagar = () => MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-loans/${loan.id}/payments`,
      { monto: 500, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
    ), { params: Promise.resolve({ id: loan.id }) });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    });

    const primera = await pagar();
    expect(primera.status, await primera.clone().text()).toBe(200);
    expect((await prisma.prestamoCash.findUniqueOrThrow({ where: { id: loan.id } })).estado)
      .toBe('PAGADO');

    const reintento = await pagar();
    expect(reintento.status).toBe(400);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    })).toBe(recsAntes + 1);
  });
});
