/**
 * @description Pagos CxC de servicios y FX de liquidación (fila 23 de la matriz R0.5),
 * más sesión HTTP real del canal `/api/contabilidad/reconciliacion/servicios`:
 * 1) venta de servicio a crédito en USD crea una CxC con snapshot FX v2
 *    (monedaOriginal USD, funcional CUP, tasa de catálogo, fingerprint);
 * 2) `reconcileService` liquida la CxC en su moneda original (USD) con cobros
 *    parciales y finales que actualizan `montoPagadoFuncional` y transmiten la
 *    diferencia FX al asiento (tasa de cobro 25 vs tasa de reconocimiento 24);
 * 3) autenticación end-to-end del POST HTTP con Bearer real (401 sin token).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { POST as POST_SERVICIOS } from '@/app/api/contabilidad/reconciliacion/servicios/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return {
    ...original,
    withAction: (handler: (input: unknown, user: AuthenticatedUser) => Promise<unknown>) =>
      async (input: unknown) => {
        const user = await getCurrentUser();
        if (!user) throw new Error('getCurrentUser mock no configurado');
        return { success: true, data: await handler(input, user) };
      },
  };
});
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/server-actions/get-current-user');

const prefix = `cta-serv-fx-${crypto.randomUUID()}`;
const fecha = '2026-02-25T12:00:00.000Z';
let tenantId = '';
let userId = '';
let token = '';
let serviceUsdId = '';
let serviceCupId = '';
let clienteId = '';
let cuentaId = '';
let tipoPagoId = '';
let ventaUsdId = '';
let ventaCupId = '';
let cxcUsdId = 0;
let fixtureRateId = '';
const admin = (targetTenantId: string): AuthenticatedUser => ({
  userId: 'actor-serv-fx', name: 'Actor Integracion', email: 'actor-integracion@test.local',
  role: 'admin', isActive: true, tenantId: targetTenantId,
  tenantRole: 'manager', planFeatures: { servicios: true },
});

/** @description Solicitud POST al canal HTTP de servicios con Bearer opcional. */
function requestServicios(body: Record<string, unknown>, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('fila 23 — pagos CxC servicios con FX de liquidación', { timeout: 90_000 }, () => {
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
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      update: {},
    });
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, servicios: true, contabilidad: true },
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
    token = jwt.sign({ userId, email: user.email, tenantId }, getJwtSecret());
    await prisma.userSession.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    })).clienteId;
    serviceUsdId = (await prisma.servicios.create({ data: {
      tenantId, nombre: `${prefix}-usd`, descripcion: prefix, precio: 100, moneda: 'USD',
    } })).servicioId;
    serviceCupId = (await prisma.servicios.create({ data: {
      tenantId, nombre: `${prefix}-cup`, descripcion: prefix, precio: 50, moneda: 'CUP',
    } })).servicioId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    fixtureRateId = (await prisma.tasaCambio.create({
      data: {
        monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24,
        fechaVigencia: new Date(),
      },
    })).tasaId;
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date('2026-02-01T00:00:00Z'),
      fechaFin: new Date('2026-02-28T23:59:59Z'),
    } });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({
      data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', fechaInicio: mesInicio, fechaFin: mesFin },
    });
  });

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin(tenantId));
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionServicio.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.ventaServicios.deleteMany({ where: { tenantId } });
    if (fixtureRateId) {
      await prisma.tasaCambio.deleteMany({ where: { tasaId: fixtureRateId } });
    }
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.servicios.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('venta USD a crédito crea CxC con snapshot FX v2 desde el catálogo', async () => {
    const { createVentaServicioAction } = await import('@/features/venta-servicios/actions');
    const venta = await createVentaServicioAction({
      servicioId: serviceUsdId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId,
    });
    expect(venta.success).toBe(true);
    if (!venta.success) expect.unreachable('La creación de venta debía completarse');
    expect(venta.data.mode).toBe('LEGACY');
    ventaUsdId = venta.data.ventaServicio.ventaServicioId;

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { tenantId, ventaServicioId: ventaUsdId },
    });
    cxcUsdId = cxc.idCC;
    expect(cxc.monedaOriginal).toBe('USD');
    expect(cxc.montoOriginal?.toString()).toBe('100');
    expect(cxc.montoDeuda.toString()).toBe('100');
    expect(cxc.montoDeudaFuncional?.toString()).toBe('2400');
    expect(cxc.tasaCambio?.toString()).toBe('24');
    expect(cxc.fxEvidenceFingerprint).toBeTruthy();
    expect(cxc.fxEvidenceVersion).toBe(2);
    expect(cxc.estado).toBe('PENDIENTE');
  });

  it('pago parcial en USD liquida al valor en libros y transmite la diferencia FX', async () => {
    const resultado = await AccountingReconciliationService.reconcileService({
      input: {
        ventaServicioId: ventaUsdId,
        idempotencyKey: `service-cxc-partial-${crypto.randomUUID()}`,
        distribuciones: [{
          cuentaId, tipoPagoId, monto: 40, moneda: 'USD', tasaCambio: 25, fechaTasa: fecha,
        }],
        fechaReconciliacion: fecha,
      },
      user: admin(tenantId),
    });
    expect(resultado.reconciliado).toBe(false);

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcUsdId, tenantId },
    });
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('1000');
    expect(cxc.estado).toBe('PARCIAL');
    const rec = await prisma.reconciliacionServicio.findFirstOrThrow({ where: {
      tenantId, ventaServicioId: ventaUsdId,
    } });
    expect(rec.montoConvertido?.toString()).toBe('1000');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const asiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'reconciliacion_servicio', origenId: rec.reconciliacionId,
    }, include: { lineas: true } });
    expect(asiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '40'], ['0', '960'], ['1000', '0']]);
  });

  it('pago final completa la CxC, marca reconciliado y contabiliza el cierre FX', async () => {
    const resultado = await AccountingReconciliationService.reconcileService({
      input: {
        ventaServicioId: ventaUsdId,
        idempotencyKey: `service-cxc-final-${crypto.randomUUID()}`,
        distribuciones: [{
          cuentaId, tipoPagoId, monto: 60, moneda: 'USD', tasaCambio: 25, fechaTasa: fecha,
        }],
        fechaReconciliacion: fecha,
      },
      user: admin(tenantId),
    });
    expect(resultado.reconciliado).toBe(true);

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcUsdId, tenantId },
    });
    expect(cxc.montoPagado.toString()).toBe('100');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('2500');
    expect(cxc.estado).toBe('PAGADA');
    const venta = await prisma.ventaServicios.findUniqueOrThrow({
      where: { ventaServicioId: ventaUsdId },
    });
    expect(venta.reconciliado).toBe(true);
    const recs = await prisma.reconciliacionServicio.findMany({ where: {
      tenantId, ventaServicioId: ventaUsdId,
    }, orderBy: { createdAt: 'asc' } });
    expect(recs).toHaveLength(2);
    const asiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'reconciliacion_servicio', origenId: recs[1].reconciliacionId,
    }, include: { lineas: true } });
    expect(asiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '1440'], ['0', '60'], ['1500', '0']]);
  });

  it('sesión HTTP real: 401 sin token y 200 con Bearer en el canal servicios', async () => {
    const anonimo = await POST_SERVICIOS(requestServicios({
      ventaServicioId: ventaCupId, cuentaId, tipoPagoId, monto: 50,
    }, false));
    expect(anonimo.status).toBe(401);

    const venta = await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: serviceCupId, cantidad: 1, total: 50, clienteId,
    } });
    ventaCupId = venta.ventaServicioId;
    const response = await POST_SERVICIOS(requestServicios({
      ventaServicioId: ventaCupId, cuentaId, tipoPagoId, monto: 50, moneda: 'CUP',
    }));
    expect(response.status, await response.clone().text()).toBe(201);
    const rec = await prisma.reconciliacionServicio.findFirstOrThrow({ where: {
      tenantId, ventaServicioId: ventaCupId,
    } });
    expect(rec.montoConvertido?.toString()).toBe('50');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(rec.reconciliadoPor).toBe(userId);
  });
});
