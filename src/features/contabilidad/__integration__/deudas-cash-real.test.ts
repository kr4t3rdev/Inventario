import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { POST as POST_CREAR } from '@/app/api/contabilidad/deudas-cash/route';
import { PUT as PUT_ACTUALIZAR } from '@/app/api/contabilidad/deudas-cash/[id]/route';
import { POST as POST_PAGAR } from '@/app/api/contabilidad/deudas-cash/[id]/pagar/route';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { NextRequest } from 'next/server';

/**
 * Límites sustituidos (no prueban autenticación real): withAuthPost (que
 * inyecta el usuario sin validar token), validarEscrituraPeriodo y
 * AuditLogService. El motor formal corre con postEvento real en modo enforce
 * durante este archivo únicamente.
 */
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-middleware')>();
  return { ...original, withAuthPost: (handler: (
    request: NextRequest, context: unknown, user: { userId: string; tenantId: string },
  ) => Promise<Response>) => async (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'actor-real', tenantId,
      planFeatures: { 'deudas-cash': true, contabilidad: true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    }) };
});
vi.mock('@/lib/services/validate-period-write', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/validate-period-write')>();
  return { ...original, validarEscrituraPeriodo: async () => ({ permitido: true }) };
});
const auditControl = vi.hoisted(() => ({ failNext: false }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: {
  log: async () => undefined,
  logStrict: async () => {
    if (auditControl.failNext) {
      auditControl.failNext = false;
      throw new Error('cash audit write rejected');
    }
  },
} }));

const prefix = `cta-deuda-${crypto.randomUUID()}`;
let tenantId = '';
let otherTenantId = '';
let proveedorId = '';
let otherProveedorId = '';
let cuentaId = '';
let cuentaFxId = '';
let otherCuentaId = '';
let cuentaIdPagar = '';
let deudaPagarId = '';
let cuentaPorPagarPagarId = '';
let trigger = '';

/** @description Ejercita los POST legacy de deudas cash con filas PostgreSQL reales. */
describe('deudas cash legacy — PostgreSQL aislado', { timeout: 90_000 }, () => {
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
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const other = await prisma.tenant.create({ data: { nombre: `${prefix}-other`, slug: `${prefix}-other` } });
    otherTenantId = other.tenantId;
    proveedorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    otherProveedorId = (await prisma.vendor.create({ data: {
      tenantId: otherTenantId, nombre: `${prefix}-other`,
    } })).vendorId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    cuentaFxId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-fx`, numeroCuenta: `${prefix}-fx`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    otherCuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId: otherTenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-other`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    cuentaIdPagar = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-pago`, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    await prisma.tipoPago.create({ data: { tenantId: otherTenantId, nombre: 'Transferencia' } });
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365, features: { 'contabilidad-formal': true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    // Política contable requerida por los writers y el guard fail-closed del motor.
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-real' },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: mesInicio,
      fechaFin: mesFin,
    } });
    // Precalienta la resolución de período fuera del writer para evitar que la
    // conexión raíz dependa de los locks del TransactionClient del writer.
    await PeriodoGuard.assertWritable(new Date(), tenantId, 'asiento', {
      actorId: 'actor-real', actorTipo: 'USUARIO', origen: { tipo: 'deuda_cash', id: prefix },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (trigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
    if (!tenantId) return;
    for (const id of [tenantId, otherTenantId]) {
      await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId: id } } });
      await prisma.asiento.deleteMany({ where: { tenantId: id } });
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: id } });
      await prisma.deudaCash.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId: id } });
      await prisma.vendor.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId: id } });
      await prisma.diario.deleteMany({ where: { tenantId: id } });
      await prisma.periodoCache.deleteMany({ where: { tenantId: id } });
      await prisma.periodoContable.deleteMany({ where: { tenantId: id } });
      await prisma.tipoPago.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId: id } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId: id } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { tenantId: id } });
    }
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
  });

  it('aisla referencias de otro tenant antes de abrir transacción', async () => {
    const crearAjeno = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST', body: JSON.stringify({ proveedorId: otherProveedorId,
          montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaId }),
      }));
    expect(crearAjeno.status).toBe(404);

    const pagarAjeno = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/deudas-cash/inexistente/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 100, cuentaId: otherCuentaId,
          tipoPagoId: 'inexistente' }),
      }), { params: Promise.resolve({ id: 'inexistente' }) });
    expect(pagarAjeno.status).toBe(404);

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo.toString())
      .toBe('0');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: otherCuentaId } }))
      .saldo.toString()).toBe('0');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.deudaCash.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.deudaCash.count({ where: { tenantId: otherTenantId } })).toBe(0);
  });

  it('crea deuda CUP, acredita saldo y contabiliza un asiento por origen', async () => {
    const response = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST', body: JSON.stringify({ proveedorId, montoCapital: 3000,
          moneda: 'CUP', cuentaBancariaId: cuentaId }),
      }));
    expect(response.status).toBe(201);
    const { deuda } = await response.json();
    expect(deuda.proveedorId).toBe(proveedorId);

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString()).toBe('3000');
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
    } });
    expect(rec.montoConvertido?.toString()).toBe('3000');
    expect(rec.tasaCambio?.toString()).toBe('1');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(rec.deudaCashId).toBeNull();
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'deuda_cash', origenId: deuda.id,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint)).toBe(true);
  });

  it('revierte el POST de deuda si falla la auditoría antes del commit', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const deudasAntes = await prisma.deudaCash.count({ where: { tenantId } });
    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({ where: { tenantId } });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });
    auditControl.failNext = true;

    const response = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST',
        body: JSON.stringify({ proveedorId, montoCapital: 125, moneda: 'CUP', cuentaBancariaId: cuentaId }),
      },
    ));

    expect(response.status).toBe(500);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(saldoAntes);
    expect(await prisma.deudaCash.count({ where: { tenantId } })).toBe(deudasAntes);
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(reconciliacionesAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
  });

  it('scopea la edición y revierte el cambio si falla la auditoría transaccional', async () => {
    const createResponse = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST',
        body: JSON.stringify({ proveedorId, montoCapital: 90, moneda: 'CUP', cuentaBancariaId: cuentaId }),
      },
    ));
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const before = await prisma.deudaCash.findFirstOrThrow({
      where: { id: created.deuda.id, tenantId },
      select: { observaciones: true },
    });
    auditControl.failNext = true;

    const updateResponse = await PUT_ACTUALIZAR(new NextRequest(
      `http://localhost/api/contabilidad/deudas-cash/${created.deuda.id}`, {
        method: 'PUT',
        body: JSON.stringify({ observaciones: 'Cambio que debe revertirse' }),
        headers: { 'content-type': 'application/json' },
      },
    ), { params: Promise.resolve({ id: created.deuda.id }) }, {
      userId: 'actor-real', tenantId, planFeatures: { 'deudas-cash': true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    } as never);

    expect(updateResponse.status).toBe(500);
    expect(await prisma.deudaCash.findFirstOrThrow({
      where: { id: created.deuda.id, tenantId },
      select: { observaciones: true },
    })).toEqual(before);
  });

  it('crea deuda extranjera con tasa y hereda evidencia FX en el asiento', async () => {
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo);
    const response = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST', body: JSON.stringify({ proveedorId, montoCapital: 3000,
          moneda: 'USD', tasaCambio: 24, cuentaBancariaId: cuentaFxId }),
      }));
    expect(response.status).toBe(201);
    const { deuda } = await response.json();

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO', moneda: 'USD',
    } });
    expect(rec.montoConvertido?.toString()).toBe('72000');
    expect(rec.tasaCambio?.toString()).toBe('24');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo)).toBe(saldoAntes + 72_000);
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'deuda_cash', origenId: deuda.id,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('paga deuda CUP, debita saldo y contabiliza un asiento por origen', async () => {
    const cxp = await prisma.cuentaPorPagar.create({ data: {
      tenantId, numeroFactura: `DC-${prefix.slice(0, 12)}`, proveedorId,
      proveedorNombre: prefix, montoDeuda: 1000, montoPagado: 0, saldoPendiente: 1000,
      moneda: 'CUP', tipo: 'compra', tipoDeuda: 'DEUDA_CASH', estado: 'PENDIENTE',
    } });
    cuentaPorPagarPagarId = cxp.cuentaPorPagarId;
    const deuda = await prisma.deudaCash.create({ data: {
      tenantId, proveedorId, cuentaPorPagarId: cxp.cuentaPorPagarId,
      montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaIdPagar,
      createdById: 'actor-real',
    } });
    deudaPagarId = deuda.id;

    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/deudas-cash/${deudaPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 400, cuentaId: cuentaIdPagar,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId }),
      }), { params: Promise.resolve({ id: deudaPagarId }) });
    expect(response.status).toBe(201);
    const { reconciliacion } = await response.json();

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaIdPagar } }))
      .saldo.toString()).toBe('4600');
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deudaPagarId,
    } });
    expect(rec.reconciliacionId).toBe(reconciliacion.reconciliacionId);
    expect(rec.montoConvertido?.toString()).toBe('400');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const cxpActualizada = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: cuentaPorPagarPagarId },
    });
    expect(cxpActualizada.montoPagado.toString()).toBe('400');
    expect(cxpActualizada.estado).toBe('PARCIAL');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: reconciliacion.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint)).toBe(true);
  });

  it('servicio canónico crea deuda USD y hereda la FX persistida al único asiento', async () => {
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo);
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: {
        proveedorId,
        montoCapital: 100,
        moneda: 'USD',
        tasaCambio: 24,
        cuentaBancariaId: cuentaFxId,
      },
      user: { userId: 'actor-real', tenantId, tenantRole: 'manager', planFeatures: { 'deudas-cash': true } } as never,
    });

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId,
      tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
      deudaCashId: null,
      monto: 100,
      moneda: 'USD',
    } });
    expect(rec.montoConvertido?.toString()).toBe('2400');
    expect(rec.tasaCambio?.toString()).toBe('24');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo)).toBe(saldoAntes + 2_400);

    const asientos = await prisma.asiento.findMany({ where: {
      tenantId,
      origenTipo: 'deuda_cash',
      origenId: deuda.id,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('servicio canónico scopea pago al tenant y hereda la FX persistida al asiento', async () => {
    const cxp = await prisma.cuentaPorPagar.create({ data: {
      tenantId,
      numeroFactura: `DC-CANON-${crypto.randomUUID()}`,
      proveedorId,
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      moneda: 'USD',
      tipo: 'compra',
      tipoDeuda: 'DEUDA_CASH',
      estado: 'PENDIENTE',
    } });
    const deuda = await prisma.deudaCash.create({ data: {
      tenantId,
      proveedorId,
      cuentaPorPagarId: cxp.cuentaPorPagarId,
      montoCapital: 100,
      moneda: 'USD',
      cuentaBancariaId: cuentaFxId,
      createdById: 'actor-real',
    } });
    const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;

    const pago = await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: {
        id: deuda.id,
        monto: 10,
        cuentaId: cuentaFxId,
        tipoPagoId,
        moneda: 'USD',
        tasaCambio: 25,
      },
      user: { userId: 'actor-real', tenantId, tenantRole: 'manager', planFeatures: { 'deudas-cash': true } } as never,
    });

    const rec = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: pago.reconciliacionId },
    });
    expect(rec.montoConvertido?.toString()).toBe('250');
    expect(rec.tasaCambio?.toString()).toBe('25');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId,
      origenTipo: 'reconciliacion_venta',
      origenId: rec.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '25')).toBe(true);
  });

  it.each(['web', 'servicio'] as const)(
    'serializa pagos 600+600 sobre saldo 1000 en el canal %s', async (channel) => {
      const cxp = await prisma.cuentaPorPagar.create({ data: {
        tenantId,
        numeroFactura: `DC-RACE-${channel}-${crypto.randomUUID()}`,
        proveedorId,
        montoDeuda: 1000,
        montoPagado: 0,
        saldoPendiente: 1000,
        moneda: 'CUP',
        tipo: 'compra',
        tipoDeuda: 'DEUDA_CASH',
        estado: 'PENDIENTE',
      } });
      const deuda = await prisma.deudaCash.create({ data: {
        tenantId,
        proveedorId,
        cuentaPorPagarId: cxp.cuentaPorPagarId,
        montoCapital: 1000,
        moneda: 'CUP',
        cuentaBancariaId: cuentaIdPagar,
        createdById: 'actor-real',
      } });
      const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
        where: { tenantId, nombre: 'Transferencia' },
      })).tipoId;
      const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaIdPagar },
      })).saldo);

      const pagar = () => channel === 'web'
        ? POST_PAGAR(new NextRequest(
          `http://localhost/api/contabilidad/deudas-cash/${deuda.id}/pagar`, {
            method: 'POST',
            body: JSON.stringify({ monto: 600, cuentaId: cuentaIdPagar, tipoPagoId }),
          }), { params: Promise.resolve({ id: deuda.id }) })
        : AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: { id: deuda.id, monto: 600, cuentaId: cuentaIdPagar, tipoPagoId },
          user: {
            userId: 'actor-real', tenantId, tenantRole: 'manager',
            planFeatures: { 'deudas-cash': true },
          } as never,
        });
      const results = await Promise.allSettled([pagar(), pagar()]);

      if (channel === 'web') {
        const statuses = await Promise.all(results.map(async (result) => {
          expect(result.status).toBe('fulfilled');
          return (await (result as PromiseFulfilledResult<Response>).value).status;
        }));
        expect(statuses.sort()).toEqual([201, 409]);
      } else {
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      }

      const receipts = await prisma.reconciliacionVenta.findMany({ where: {
        tenantId, deudaCashId: deuda.id, tipoReconciliacion: 'DEUDA_CASH',
      } });
      const updatedPayable = await prisma.cuentaPorPagar.findUniqueOrThrow({
        where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
      });
      expect(receipts).toHaveLength(1);
      expect(Number(receipts[0].monto)).toBe(600);
      expect(Number(updatedPayable.montoPagado)).toBe(600);
      expect(Number(updatedPayable.saldoPendiente)).toBe(400);
      expect(updatedPayable.estado).toBe('PARCIAL');
      expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaIdPagar },
      })).saldo)).toBe(saldoAntes - 600);
      expect(await prisma.asiento.count({ where: {
        tenantId, origenTipo: 'reconciliacion_venta', origenId: receipts[0].reconciliacionId,
      } })).toBe(1);
    },
  );

  it.each(['web', 'servicio'] as const)(
    'convierte pago USD a principal y caja CUP en el canal %s', async (channel) => {
      const cxp = await prisma.cuentaPorPagar.create({ data: {
        tenantId,
        numeroFactura: `DC-FX-${channel}-${crypto.randomUUID()}`,
        proveedorId,
        montoDeuda: 1000,
        montoPagado: 0,
        saldoPendiente: 1000,
        moneda: 'CUP',
        tipo: 'compra',
        tipoDeuda: 'DEUDA_CASH',
        estado: 'PENDIENTE',
      } });
      const deuda = await prisma.deudaCash.create({ data: {
        tenantId,
        proveedorId,
        cuentaPorPagarId: cxp.cuentaPorPagarId,
        montoCapital: 1000,
        moneda: 'CUP',
        cuentaBancariaId: cuentaIdPagar,
        createdById: 'actor-real',
      } });
      const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
        where: { tenantId, nombre: 'Transferencia' },
      })).tipoId;
      const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaIdPagar },
      })).saldo);

      if (channel === 'web') {
        const response = await POST_PAGAR(new NextRequest(
          `http://localhost/api/contabilidad/deudas-cash/${deuda.id}/pagar`, {
            method: 'POST',
            body: JSON.stringify({ monto: 10, cuentaId: cuentaIdPagar, tipoPagoId,
              moneda: 'USD', tasaCambio: 25 }),
          }), { params: Promise.resolve({ id: deuda.id }) });
        expect(response.status).toBe(201);
      } else {
        await AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: { id: deuda.id, monto: 10, cuentaId: cuentaIdPagar, tipoPagoId,
            moneda: 'USD', tasaCambio: 25 },
          user: { userId: 'actor-real', tenantId, tenantRole: 'manager',
            planFeatures: { 'deudas-cash': true } } as never,
        });
      }

      const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
        tenantId, deudaCashId: deuda.id, tipoReconciliacion: 'DEUDA_CASH',
      } });
      const payable = await prisma.cuentaPorPagar.findUniqueOrThrow({
        where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
      });
      const saldoDespues = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaIdPagar },
      })).saldo);
      expect(Number(rec.monto)).toBe(10);
      expect(rec.moneda).toBe('USD');
      expect(Number(rec.montoConvertido)).toBe(250);
      expect(Number(payable.montoPagado)).toBe(250);
      expect(Number(payable.saldoPendiente)).toBe(750);
      expect(saldoDespues).toBe(saldoAntes - 250);
      const asiento = await prisma.asiento.findFirstOrThrow({ where: {
        tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId,
      }, include: { lineas: true } });
      expect(asiento.lineas.reduce((sum, linea) => sum + Number(linea.debe), 0)).toBe(250);
      expect(asiento.lineas.reduce((sum, linea) => sum + Number(linea.haber), 0)).toBe(250);
    },
  );

  it('revierte el desembolso cuando falla SQL dentro de postEvento', async () => {
    trigger = `cta_deuda_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);

    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo.toString();
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' },
    });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    const response = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST', body: JSON.stringify({ proveedorId, montoCapital: 777,
          moneda: 'CUP', cuentaBancariaId: cuentaId }),
      }));
    expect(response.status).toBe(500);

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString()).toBe(saldoAntes);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' },
    })).toBe(recsAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    expect(await prisma.deudaCash.count({
      where: { tenantId, montoCapital: 777 },
    })).toBe(0);
  });

  it('revierte el pago cuando falla SQL dentro de postEvento', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString();
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH' },
    });
    const montoPagadoAntes = (await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: cuentaPorPagarPagarId },
    })).montoPagado.toString();

    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/deudas-cash/${deudaPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 111, cuentaId: cuentaIdPagar,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId }),
      }), { params: Promise.resolve({ id: deudaPagarId }) });
    expect(response.status).toBe(500);
    // El fallo proviene del trigger dentro de postEvento, no de un TypeError
    // de contexto: la reconciliación no existe y el saldo no cambió.
    // El fallo proviene del trigger dentro de postEvento, no de un TypeError
    // de contexto: la reconciliación no existe y el saldo no cambió.

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString()).toBe(saldoAntes);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH' },
    })).toBe(recsAntes);
    expect((await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: cuentaPorPagarPagarId },
    })).montoPagado.toString()).toBe(montoPagadoAntes);
  });
  it('rechaza el reintento de pago de una deuda ya pagada (idempotencia por estado)', async () => {
    // El test anterior deja un trigger que falla los asientos; lo retiramos.
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    // El test anterior pagó 400/1000 (parcial). Completamos el pago aquí.
    const tipoPago = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    const pagar = (monto: number) => POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/deudas-cash/${deudaPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto, cuentaId: cuentaIdPagar, tipoPagoId: tipoPago }),
      }), { params: Promise.resolve({ id: deudaPagarId }) });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deudaPagarId },
    });

    const completar = await pagar(600);
    expect(completar.status).toBe(201);
    expect((await prisma.deudaCash.findUniqueOrThrow({ where: { id: deudaPagarId } })).estado)
      .toBe('PAGADO');

    const reintento = await pagar(100);
    expect(reintento.status).toBe(400);

    // Sin duplicados por el reintento: solo la reconciliación del pago de 600.
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deudaPagarId },
    })).toBe(recsAntes + 1);
  });
});

