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

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-http-idem-${crypto.randomUUID()}`;
const fecha = '2026-02-20T12:00:00.000Z';
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
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

/**
 * @description Captura filas completas de negocio, posting, auditoría y outbox del fixture.
 * @returns {Promise<string>} Snapshot determinista, excluyendo sesión y caché del guard.
 */
async function financialSnapshot(): Promise<string> {
  const rows = await Promise.all([
    prisma.cuentaBancaria.findMany({ where: { tenantId }, orderBy: { cuentaId: 'asc' } }),
    prisma.venta.findMany({ where: { tenantId }, orderBy: { ventaId: 'asc' } }),
    prisma.factura.findMany({ where: { tenantId }, orderBy: { idFactura: 'asc' } }),
    prisma.cuentaPorCobrar.findMany({ where: { tenantId }, orderBy: { idCC: 'asc' } }),
    prisma.reconciliacionVenta.findMany({ where: { tenantId },
      orderBy: { reconciliacionId: 'asc' } }),
    prisma.asiento.findMany({ where: { tenantId }, orderBy: { asientoId: 'asc' },
      include: { lineas: { orderBy: { lineaId: 'asc' } } } }),
    prisma.auditLog.findMany({ where: { usuarioId: userId }, orderBy: { id: 'asc' } }),
    prisma.shadowPosteoOutbox.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify(rows, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value);
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
        fxEvidenceJson: JSON.parse(JSON.stringify(evidence.evidence)),
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
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
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

  it('revierte el pago y el asiento ante auditoría SQL tardía con sesión Bearer real', async () => {
    const operationKey = crypto.randomUUID();
    const successfulResponse = await POST(requestCobro({
      ventaId: saleId, cuentaId, tipoPagoId, monto: 10,
      moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
    }, operationKey));
    expect(successfulResponse.status, await successfulResponse.clone().text()).toBe(201);
    const successful = await successfulResponse.json();
    const successfulAudit = await prisma.auditLog.findFirstOrThrow({
      where: {
        usuarioId: userId,
        entidad: 'RECONCILIACION',
        entidadId: successful.reconciliacion.reconciliacionId,
        accion: 'CREATE',
      },
    });
    expect(successfulAudit.detalles).toMatchObject({ tipo: 'VENTA', ventaId: saleId });
    const successfulEntry = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'reconciliacion_venta',
      origenId: successful.reconciliacion.reconciliacionId,
    }, include: { lineas: true } });
    expect(successfulEntry.lineas.length).toBeGreaterThanOrEqual(2);
    const financialBefore = await financialSnapshot();

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
    const auditAntes = await prisma.auditLog.findMany({
      where: { usuarioId: userId, entidad: 'RECONCILIACION' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, accion: true, entidadId: true, detalles: true },
    });
    const asientoAntes = await prisma.asiento.findMany({
      where: { tenantId },
      orderBy: [{ fecha: 'asc' }, { asientoId: 'asc' }],
      include: { lineas: { orderBy: { lineaId: 'asc' } } },
    });
    const reconciliacionesSnapshotAntes = await prisma.reconciliacionVenta.findMany({
      where: { tenantId, ventaId: saleId },
      orderBy: [{ fechaReconciliacion: 'asc' }, { reconciliacionId: 'asc' }],
    });
    const cacheAntes = await prisma.periodoCache.findMany({
      where: { tenantId }, orderBy: [{ cacheKey: 'asc' }],
    });
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const functionName = `reject_reconciliation_audit_${suffix}_fn`;
    const triggerName = `reject_reconciliation_audit_${suffix}`;

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
      BEGIN
        IF NEW."usuarioId" = '${userId}' AND NEW."entidad" = 'RECONCILIACION'
          AND NEW."accion" = 'CREATE' THEN
          IF NOT EXISTS (SELECT 1 FROM "asientos" a
            WHERE a."tenantId" = '${tenantId}'
              AND a."origenTipo" = 'reconciliacion_venta'
              AND a."origenId" = NEW."entidadId") THEN
            RAISE EXCEPTION 'R6_RECONCILIATION_AUDIT_BEFORE_POSTING' USING ERRCODE = '22023';
          END IF;
          RAISE EXCEPTION 'physical reconciliation AuditLog rejected' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await POST(requestCobro({
        ventaId: saleId, cuentaId, tipoPagoId, monto: 10,
        moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
      }, crypto.randomUUID()));
      expect(response.status).toBe(500);
      const evidence = errors.mock.calls.map((args) => args.map((value: unknown) =>
        value instanceof Error ? `${value.message} ${JSON.stringify(value)}`
          : JSON.stringify(value)).join(' ')).join('\n');
      expect(evidence).toContain('physical reconciliation AuditLog rejected');
      expect(evidence).toContain('22012');
      expect(evidence).not.toContain('R6_RECONCILIATION_AUDIT_BEFORE_POSTING');
      expect(await financialSnapshot()).toBe(financialBefore);
    } finally {
      errors.mockRestore();
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
    expect(await prisma.auditLog.findMany({
      where: { usuarioId: userId, entidad: 'RECONCILIACION' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, accion: true, entidadId: true, detalles: true },
    })).toEqual(auditAntes);
    expect(await prisma.asiento.findMany({
      where: { tenantId },
      orderBy: [{ fecha: 'asc' }, { asientoId: 'asc' }],
      include: { lineas: { orderBy: { lineaId: 'asc' } } },
    })).toEqual(asientoAntes);
    expect(await prisma.reconciliacionVenta.findMany({
      where: { tenantId, ventaId: saleId },
      orderBy: [{ fechaReconciliacion: 'asc' }, { reconciliacionId: 'asc' }],
    })).toEqual(reconciliacionesSnapshotAntes);
    expect(await prisma.periodoCache.findMany({
      where: { tenantId }, orderBy: [{ cacheKey: 'asc' }],
    })).toEqual(cacheAntes);
  });
});
