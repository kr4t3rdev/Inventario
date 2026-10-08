/**
 * @description Sesión HTTP Bearer real end-to-end y numeración concurrente del canal
 * móvil de deudas cash (`/api/mobile/v1/accounting/cash-debts/**`), filas 11/12 de
 * la matriz R0.5:
 * 1) login Bearer exitoso end-to-end: JWT + UserSession + membresía manager +
 *    licencia/plan reales resuelven contexto y permisos sin sustituir `authenticateUser`;
 * 2) pago móvil debita cuenta, actualiza CxP y contabiliza un asiento por origen;
 * 3) carrera multi-conexión: creaciones concurrentes serializadas por el lock del
 *    tenant asignan numeración `DC-N` distinta sin duplicar `numeroFactura`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST as MOBILE_POST_CREAR } from '@/app/api/mobile/v1/accounting/cash-debts/route';
import { POST as MOBILE_POST_PAGO } from '@/app/api/mobile/v1/accounting/cash-debts/[id]/payments/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));

const prefix = `cta-debts-http-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let token = '';
let proveedorId = '';
let cuentaOrigenId = '';
let cuentaPagoId = '';
let tipoPagoId = '';
let deudaId = '';

/** @description Solicitud POST al canal móvil de deudas con Bearer opcional. */
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

describe('canal móvil cash-debts — sesión Bearer real y numeración', { timeout: 90_000 }, () => {
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
      features: { 'contabilidad-formal': true, 'deudas-cash': true },
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
    proveedorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    cuentaOrigenId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-origen`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
    } })).cuentaId;
    cuentaPagoId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
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
    await prisma.deudaCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('rechaza 401 sin token y crea deuda con sesión Bearer real', async () => {
    const anonimo = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-debts',
      { proveedorId, montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      false,
    ));
    expect(anonimo.status).toBe(401);

    const response = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-debts',
      { proveedorId, montoCapital: 100, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
    ));
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    deudaId = data.id;
    expect(deudaId).toBeTruthy();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo.toString()).toBe('100');
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', reconciliadoPor: userId,
    } });
    expect(rec.monto.toString()).toBe('100');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const deuda = await prisma.deudaCash.findUniqueOrThrow({ where: { id: deudaId } });
    expect(deuda.estado).toBe('ACTIVO');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'deuda_cash', origenId: deudaId,
    } });
    expect(asientos).toHaveLength(1);
  });

  it('pago móvil con Bearer debita cuenta, actualiza CxP y contabiliza un asiento', async () => {
    const response = await MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-debts/${deudaId}/payments`,
      { monto: 40, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
    ), { params: Promise.resolve({ id: deudaId }) });
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const rec = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: data.reconciliacionId },
    });
    expect(rec.tasaCambio?.toString()).toBe('1');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo.toString()).toBe('4960');
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({
      where: { tenantId, tipoDeuda: 'DEUDA_CASH', montoPagado: { gt: 0 } },
    });
    expect(cxp.montoPagado.toString()).toBe('40');
    expect(cxp.estado).toBe('PARCIAL');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId,
    } });
    expect(asientos).toHaveLength(1);
  });

  it('crea deuda USD y acredita CUP convertido en el canal móvil Bearer', async () => {
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo);
    const response = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-debts',
      { proveedorId, montoCapital: 100, moneda: 'USD', tasaCambio: 24,
        cuentaBancariaId: cuentaOrigenId },
    ));
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', deudaCashId: null,
      monto: 100, moneda: 'USD',
    } });
    expect(Number(rec.montoConvertido)).toBe(2400);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
    })).saldo)).toBe(saldoAntes + 2400);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'deuda_cash', origenId: data.id,
    } })).toBe(1);
  });

  it('convierte pago USD a deuda CUP y debita CUP funcional en el canal móvil', async () => {
    const create = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-debts',
      { proveedorId, montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
    ));
    expect(create.status, await create.clone().text()).toBe(200);
    const created = await create.json();
    const debt = await prisma.deudaCash.findUniqueOrThrow({
      where: { id: created.id },
      include: { cuentaPorPagar: true },
    });
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo);

    const response = await MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-debts/${debt.id}/payments`,
      { monto: 10, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'USD', tasaCambio: 25 },
    ), { params: Promise.resolve({ id: debt.id }) });
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const receipt = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: data.reconciliacionId },
    });
    const payable = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: debt.cuentaPorPagarId },
    });

    expect(Number(receipt.monto)).toBe(10);
    expect(receipt.moneda).toBe('USD');
    expect(Number(receipt.montoConvertido)).toBe(250);
    expect(Number(payable.montoPagado)).toBe(250);
    expect(Number(payable.saldoPendiente)).toBe(750);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
    })).saldo)).toBe(saldoAntes - 250);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: receipt.reconciliacionId,
    } })).toBe(1);
  });

  it('carrera multi-conexión: creaciones concurrentes serializan la numeración DC-N', async () => {
    const resultados = await Promise.allSettled([
      MOBILE_POST_CREAR(requestMovil(
        'http://localhost/api/mobile/v1/accounting/cash-debts',
        { proveedorId, montoCapital: 50, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      )),
      MOBILE_POST_CREAR(requestMovil(
        'http://localhost/api/mobile/v1/accounting/cash-debts',
        { proveedorId, montoCapital: 50, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      )),
    ]);
    const respuestas = resultados
      .filter((r): r is PromiseFulfilledResult<import('next/server').NextResponse> =>
        r.status === 'fulfilled')
      .map((r) => r.value);
    const cuerpos = await Promise.all(respuestas.map(async (r) => ({
      status: r.status,
      body: await r.clone().json(),
    })));
    expect(cuerpos, JSON.stringify(cuerpos)).toHaveLength(2);
    expect(cuerpos.every((r) => r.status === 200)).toBe(true);

    const deudas = await prisma.deudaCash.findMany({
      where: { tenantId, montoCapital: 50 },
    });
    expect(deudas).toHaveLength(2);
    const numeros = (await prisma.cuentaPorPagar.findMany({
      where: { tenantId, numeroFactura: { startsWith: 'DC-' } },
    })).map((c) => c.numeroFactura);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('reintento móvil de pago de deuda ya pagada no duplica (idempotencia por estado)', async () => {
    const crear = await MOBILE_POST_CREAR(requestMovil(
      'http://localhost/api/mobile/v1/accounting/cash-debts',
      { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
    ));
    expect(crear.status, await crear.clone().text()).toBe(200);
    const nuevaId = (await crear.json()).id as string;
    const pagar = () => MOBILE_POST_PAGO(requestMovil(
      `http://localhost/api/mobile/v1/accounting/cash-debts/${nuevaId}/payments`,
      { monto: 500, cuentaId: cuentaPagoId, tipoPagoId, moneda: 'CUP' },
    ), { params: Promise.resolve({ id: nuevaId }) });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: nuevaId },
    });

    const primera = await pagar();
    expect(primera.status, await primera.clone().text()).toBe(200);
    expect((await prisma.deudaCash.findUniqueOrThrow({ where: { id: nuevaId } })).estado)
      .toBe('PAGADO');

    const reintento = await pagar();
    expect(reintento.status).toBe(400);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: nuevaId },
    })).toBe(recsAntes + 1);
  });
});
