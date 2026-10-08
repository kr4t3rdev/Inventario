/**
 * @description Sesión HTTP real y idempotencia del POST legacy
 * `/api/contabilidad/reconciliacion/ventas`:
 * 1) autenticación end-to-end con JWT + UserSession + membresía + licencia reales
 *    (sin sustituir `authenticateUser`);
 * 2) reintento con el header `Idempotency-Key` devuelve el resultado previo
 *    (200, mismo `reconciliacionId`, un único asiento y CxC sin doble cobro);
 * 3) misma clave con payload distinto se rechaza con 409 `IDEMPOTENCY_CONFLICT`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST } from '@/app/api/contabilidad/reconciliacion/ventas/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/secrets';
import { assertDisposableDatabase } from '../../../../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: async () => undefined,
    logStrict: async (params: {
      accion: string;
      entidad: string;
      entidadId: string;
      usuarioId: string;
      detalles?: Record<string, unknown>;
    }, client: { auditLog: { create: (args: unknown) => Promise<unknown> } }) =>
      client.auditLog.create({
        data: {
          accion: params.accion,
          entidad: params.entidad,
          entidadId: params.entidadId,
          usuarioId: params.usuarioId,
          detalles: params.detalles ?? {},
          ip: 'internal',
          userAgent: 'system',
        },
      }),
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-http-idem-${crypto.randomUUID()}`;
const fecha = '2026-02-20T12:00:00.000Z';
let tenantId = '';
let userId = '';
let token = '';
let cuentaId = '';
let tipoPagoId = '';
let saleId = '';
let cxcId = 0;
let firstReconciliacionId = '';

/** @description Solicitud POST autenticada con Bearer y clave de idempotencia opcional. */
function requestCobro(body: Record<string, unknown>, idempotencyKey?: string): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST reconciliación ventas — HTTP real e idempotencia', { timeout: 60_000 }, () => {
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
      data: {
        tenantId, planId: plan.planId, activa: true,
        expiracion: new Date('2099-01-01'),
      },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    token = jwt.sign(
      { userId, email: user.email, tenantId },
      getJwtSecret(),
    );
    await prisma.userSession.create({
      data: {
        userId, token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const puntoDeVentaId = (await prisma.puntoDeVenta.create({ data: {
      tenantId, nombre: `${prefix}-pv`,
    } })).pvId;
    const cliente = await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    });
    saleId = (await prisma.venta.create({
      data: { tenantId, puntoDeVentaId, clienteId: cliente.clienteId, cantidad: 1, total: 100 },
    })).ventaId;
    const serieId = (await prisma.serieFacturacion.create({
      data: { tenantId, prefijo: prefix, descripcion: prefix },
    })).serieId;
    const factura = await prisma.factura.create({
      data: {
        tenantId, serieId, numeroFactura: `${prefix}-f1`, clienteId: cliente.clienteId,
        subtotal: 100, total: 100, creadoPor: userId, ventaId: saleId,
      },
    });
    const evidence = buildAppliedFxEvidenceExact({
      originalAmount: '100',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24',
      convertedAmount: '2400',
      rateEffectiveAt: new Date(fecha),
      source: 'integration-fixture',
      fxProvenanceKind: 'MANUAL_GOVERNED',
    });
    cxcId = (await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: cliente.clienteId,
        facturaId: factura.idFactura,
        montoDeuda: 100,
        montoOriginal: 100,
        montoDeudaFuncional: 2400,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 24,
        rateEffectiveAt: evidence.rateEffectiveAt,
        fxProvenanceKind: evidence.evidence.fxProvenanceKind,
        fxProvenanceSource: evidence.evidence.fxProvenanceSource,
        fxEvidenceJson: evidence.evidence,
        fxEvidenceFingerprint: evidence.evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: evidence.evidence.fxEvidenceVersion,
      },
    })).idCC;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({ data: { tenantId, nombre: prefix } })).tipoId;
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date('2026-02-01T00:00:00Z'),
      fechaFin: new Date('2026-02-28T23:59:59Z'),
    } });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    const reconciliacionIds = (await prisma.reconciliacionVenta.findMany({
      where: { tenantId },
      select: { reconciliacionId: true },
    })).map((row) => row.reconciliacionId);
    await prisma.auditLog.deleteMany({
      where: { entidad: 'RECONCILIACION', entidadId: { in: reconciliacionIds } },
    });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.factura.deleteMany({ where: { tenantId } });
    await prisma.venta.deleteMany({ where: { tenantId } });
    await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.serieFacturacion.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it('rechaza 401 sin token y autentica sesión HTTP real con Bearer', async () => {
    const anonimo = await POST(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({ ventaId: saleId, cuentaId, tipoPagoId, monto: 40 }),
      },
    ));
    expect(anonimo.status).toBe(401);

    const response = await POST(requestCobro({
      ventaId: saleId, cuentaId, tipoPagoId, monto: 40,
      moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
    }, 'idem-1'));
    expect(response.status, await response.clone().text()).toBe(201);
    const data = await response.json();
    expect(data.reconciliacion?.reconciliacionId).toBeTruthy();
    firstReconciliacionId = data.reconciliacion.reconciliacionId;
    expect(data.reconciliacion.idempotencyKey).toBe('idem-1');
    expect(data.reconciliacion).toMatchObject({ montoCuenta: '1000', monedaCuenta: 'CUP' });
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
    });
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('1000');
    expect(await prisma.auditLog.count({
      where: { entidad: 'RECONCILIACION', entidadId: firstReconciliacionId },
    })).toBe(1);
  });

  it('reintento con Idempotency-Key devuelve el resultado previo sin doble cobro', async () => {
    const cxcAntes = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
    });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    const response = await POST(requestCobro({
      ventaId: saleId, cuentaId, tipoPagoId, monto: 40,
      moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
    }, 'idem-1'));

    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    expect(data.reconciliacion?.reconciliacionId).toBe(firstReconciliacionId);

    const cxcDespues = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
    });
    expect(cxcDespues.montoPagado.eq(cxcAntes.montoPagado)).toBe(true);
    expect(cxcDespues.montoPagadoFuncional?.eq(cxcAntes.montoPagadoFuncional!)).toBe(true);
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId, ventaId: saleId } }))
      .toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    expect(await prisma.auditLog.count({
      where: { entidad: 'RECONCILIACION', entidadId: firstReconciliacionId },
    })).toBe(1);
  });

  it('misma clave con payload distinto se rechaza con 409 IDEMPOTENCY_CONFLICT', async () => {
    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({ where: { tenantId } });

    const response = await POST(requestCobro({
      ventaId: saleId, cuentaId, tipoPagoId, monto: 60,
      moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
    }, 'idem-1'));

    expect(response.status, await response.clone().text()).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } }))
      .toBe(reconciliacionesAntes);
  });

  it('revierte el pago y el asiento si falla el insert del audit log en la transacción', async () => {
    const functionName = 'reject_reconciliation_audit_for_test';
    const triggerName = 'reject_reconciliation_audit_for_test';
    const saldoAntes = await prisma.cuentaBancaria.findFirstOrThrow({
      where: { cuentaId, tenantId },
      select: { saldo: true },
    });
    const cxcAntes = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
      select: { montoPagado: true, montoPagadoFuncional: true },
    });
    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, ventaId: saleId },
    });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "${functionName}"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit insert rejected' USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);

    try {
      const response = await POST(requestCobro({
        ventaId: saleId, cuentaId, tipoPagoId, monto: 10,
        moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
      }, 'idem-audit-fail'));
      expect(response.status).toBe(500);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }

    const saldoDespues = await prisma.cuentaBancaria.findFirstOrThrow({
      where: { cuentaId, tenantId },
      select: { saldo: true },
    });
    const cxcDespues = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
      select: { montoPagado: true, montoPagadoFuncional: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo));
    expect(Number(cxcDespues.montoPagado)).toBe(Number(cxcAntes.montoPagado));
    expect(Number(cxcDespues.montoPagadoFuncional)).toBe(Number(cxcAntes.montoPagadoFuncional));
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId, ventaId: saleId } }))
      .toBe(reconciliacionesAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
  });
});
