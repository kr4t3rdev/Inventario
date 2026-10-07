import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { POST as POST_CREAR } from '@/app/api/contabilidad/prestamos-cash/route';
import { POST as POST_PAGAR } from '@/app/api/contabilidad/prestamos-cash/[id]/pagar/route';
import { POST as MOBILE_POST_CREAR } from '@/app/api/mobile/v1/accounting/cash-loans/route';
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
    request: NextRequest, context: unknown, user: {
      userId: string;
      tenantId: string;
      tenantRole: string;
      planFeatures: Record<string, boolean>;
      permissions: Set<string>;
    },
  ) => Promise<Response>) => async (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'actor-real',
      tenantId,
      tenantRole: 'manager',
      planFeatures: { 'prestamos-cash': true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    }) };
});
vi.mock('@/lib/services/validate-period-write', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/validate-period-write')>();
  return { ...original, validarEscrituraPeriodo: async () => ({ permitido: true }) };
});
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: {
  log: async () => undefined, logStrict: async () => undefined,
} }));

const prefix = `cta-prest-${crypto.randomUUID()}`;
let tenantId = '';
let otherTenantId = '';
let clienteId = '';
let cuentaId = '';
let cuentaFxId = '';
let otherCuentaId = '';
let cuentaIdPagar = '';
let prestamoPagarId = '';
let cxcPagarId = '';
let prestamoFxId = '';
let cxcFxId = '';
let canonicalLoanId = '';
let trigger = '';
const temporaryTriggers: string[] = [];

/** @description Ejercita el POST legacy de pago de préstamos cash con filas PostgreSQL reales. */
describe('préstamos cash legacy [id]/pagar — PostgreSQL aislado', { timeout: 90_000 }, () => {
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
    clienteId = (await prisma.cliente.create({ data: {
      tenantId, nombre: prefix,
    } })).clienteId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
      saldo: 5000,
    } })).cuentaId;
    cuentaFxId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-fx`, numeroCuenta: `${prefix}-fx`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    cuentaIdPagar = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-pago`, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
    } })).cuentaId;
    otherCuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId: otherTenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-other`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    await prisma.tipoPago.create({ data: { tenantId: otherTenantId, nombre: 'Transferencia' } });
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, 'prestamos-cash': true },
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
      actorId: 'actor-real', actorTipo: 'USUARIO', origen: { tipo: 'prestamo_cash', id: prefix },
    });

    // Préstamo CUP pendiente para el pago parcial.
    const cxcPagar = await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 1000, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    cxcPagarId = cxcPagar.id;
    prestamoPagarId = (await prisma.prestamoCash.create({ data: {
      tenantId, clienteId, cuentaPorCobrarId: cxcPagar.id,
      montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaIdPagar,
      createdById: 'actor-real',
    } })).id;

    // Préstamo en moneda extranjera pendiente para el pago con tasa.
    const cxcFx = await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 1000, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    cxcFxId = cxcFx.id;
    prestamoFxId = (await prisma.prestamoCash.create({ data: {
      tenantId, clienteId, cuentaPorCobrarId: cxcFx.id,
      montoCapital: 1000, moneda: 'USD', cuentaBancariaId: cuentaFxId,
      createdById: 'actor-real',
    } })).id;
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    for (const name of temporaryTriggers) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`);
    }
    if (trigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
    if (!tenantId) return;
    for (const id of [tenantId, otherTenantId]) {
      await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId: id } } });
      await prisma.asiento.deleteMany({ where: { tenantId: id } });
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: id } });
      await prisma.prestamoCash.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: id } });
      await prisma.cliente.deleteMany({ where: { tenantId: id } });
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
    const pagarAjeno = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/inexistente/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 100, cuentaId: otherCuentaId,
          tipoPagoId: 'inexistente' }),
      }), { params: Promise.resolve({ id: 'inexistente' }) });
    expect(pagarAjeno.status).toBe(404);

    // Préstamo legítimo del tenant pero cuenta bancaria del otro tenant.
    const cuentaAjena = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 100, cuentaId: otherCuentaId,
          tipoPagoId: 'inexistente' }),
      }), { params: Promise.resolve({ id: prestamoPagarId }) });
    expect(cuentaAjena.status).toBe(400);

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaIdPagar } }))
      .saldo.toString()).toBe('0');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: otherCuentaId } }))
      .saldo.toString()).toBe('0');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.prestamoCash.count({ where: { tenantId, estado: 'PAGADO' } })).toBe(0);
    expect((await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcPagarId } }))
      .montoPagado.toString()).toBe('0');
  });

  it('paga préstamo CUP, acredita saldo y contabiliza un asiento por origen', async () => {
    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 400, cuentaId: cuentaIdPagar,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId }),
      }), { params: Promise.resolve({ id: prestamoPagarId }) });
    expect(response.status).toBe(201);
    const { reconciliacion } = await response.json();

    // El cobro acredita (incrementa) el saldo de la cuenta que recibe el pago.
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaIdPagar } }))
      .saldo.toString()).toBe('400');
    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: prestamoPagarId,
    } });
    expect(rec.reconciliacionId).toBe(reconciliacion.reconciliacionId);
    expect(rec.montoConvertido?.toString()).toBe('400');
    expect(rec.tasaCambio?.toString()).toBe('1');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    const cxcActualizada = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: cxcPagarId },
    });
    expect(cxcActualizada.montoPagado.toString()).toBe('400');
    expect(cxcActualizada.estado).toBe('PARCIAL');
    expect((await prisma.prestamoCash.findUniqueOrThrow({ where: { id: prestamoPagarId } }))
      .estado).toBe('ACTIVO');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: reconciliacion.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint)).toBe(true);
  });

  it('preserva 4 decimales en montoPagadoFuncional al pagar 0.0123 CUP (A5)', async () => {
    // Prestamo dedicado para no interferir con el estado compartido.
    const cxcA5 = await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 1000, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    const prestamoA5 = (await prisma.prestamoCash.create({ data: {
      tenantId, clienteId, cuentaPorCobrarId: cxcA5.id,
      montoCapital: 1000, moneda: 'CUP', cuentaBancariaId: cuentaIdPagar,
      createdById: 'actor-real',
    } })).id;
    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoA5}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 0.0123, cuentaId: cuentaIdPagar,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId }),
      }), { params: Promise.resolve({ id: prestamoA5 }) });
    expect(response.status).toBe(201);
    const cxcActualizada = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: cxcA5.id },
    });
    // A5: no debe truncarse a 0.01
    expect(cxcActualizada.montoPagadoFuncional?.toString()).toBe('0.0123');
    expect(cxcActualizada.montoPagado.toString()).toBe('0.0123');
  });

  it('paga préstamo extranjero con tasa y hereda evidencia FX en el asiento', async () => {
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo);
    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoFxId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 400, cuentaId: cuentaFxId,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId, moneda: 'USD', tasaCambio: 24 }),
      }), { params: Promise.resolve({ id: prestamoFxId }) });
    expect(response.status).toBe(201);
    const { reconciliacion } = await response.json();

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: prestamoFxId,
    } });
    expect(rec.montoConvertido?.toString()).toBe('9600');
    expect(rec.tasaCambio?.toString()).toBe('24');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaFxId },
    })).saldo)).toBe(saldoAntes + 9600);
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: reconciliacion.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('servicio canónico crea préstamo USD con un asiento y FX heredada', async () => {
    const user = {
      userId: 'actor-real', tenantId, tenantRole: 'manager',
      planFeatures: { 'prestamos-cash': true },
    } as never;
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo);
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId, montoCapital: 100, moneda: 'USD', tasaCambioAlCrear: 24,
        cuentaBancariaId: cuentaId,
      },
      user,
    });
    canonicalLoanId = loan.id;

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
      monto: 100, moneda: 'USD', reconciliadoPor: 'actor-real',
    } });
    expect(rec.montoConvertido?.toString()).toBe('2400');
    expect(rec.tasaCambio?.toString()).toBe('24');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo)).toBe(saldoAntes - 2400);

    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'prestamo_cash', origenId: loan.id,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('POST web convierte desembolso USD al saldo de cuenta CUP', async () => {
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo);
    const response = await POST_CREAR(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash', {
        method: 'POST',
        body: JSON.stringify({ clienteId, montoCapital: 100, moneda: 'USD',
          tasaCambioAlCrear: 24, cuentaBancariaId: cuentaId }),
      }), {});
    expect(response.status, await response.clone().text()).toBe(201);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo)).toBe(saldoAntes - 2400);
  });

  it('servicio canónico registra pago USD con un asiento y FX heredada', async () => {
    const user = {
      userId: 'actor-real', tenantId, tenantRole: 'manager',
      planFeatures: { 'prestamos-cash': true },
    } as never;
    const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    const saldoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo);
    const pago = await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: canonicalLoanId, monto: 10, cuentaId: cuentaIdPagar, tipoPagoId,
        moneda: 'USD', tasaCambio: 25,
      },
      user,
    });

    const rec = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: pago.reconciliacionId },
    });
    expect(rec.montoConvertido?.toString()).toBe('250');
    expect(rec.tasaCambio?.toString()).toBe('25');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo)).toBe(saldoAntes + 250);
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '25')).toBe(true);
  });

  it('deniega crear préstamo si el rol autenticado no tiene acceso contable', async () => {
    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId, montoCapital: 10, moneda: 'CUP', cuentaBancariaId: cuentaId,
      },
      user: {
        userId: 'actor-limited', tenantId, tenantRole: 'dependiente',
        planFeatures: { 'prestamos-cash': true },
      } as never,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await prisma.prestamoCash.count({ where: { tenantId, createdById: 'actor-limited' } }))
      .toBe(0);
  });

  it('deniega el canal móvil/compartido si el plan no habilita préstamos cash', async () => {
    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId, montoCapital: 10, moneda: 'CUP', cuentaBancariaId: cuentaId,
      },
      user: {
        userId: 'actor-no-feature', tenantId, tenantRole: 'manager', planFeatures: {},
      } as never,
    })).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
    expect(await prisma.prestamoCash.count({ where: { tenantId, createdById: 'actor-no-feature' } }))
      .toBe(0);
  });

  it('el adaptador móvil rechaza la solicitud sin token antes de escribir', async () => {
    const prestamosAntes = await prisma.prestamoCash.count({ where: { tenantId } });
    const response = await MOBILE_POST_CREAR(new NextRequest(
      'http://localhost/api/mobile/v1/accounting/cash-loans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clienteId, montoCapital: 10, moneda: 'CUP', cuentaBancariaId: cuentaId,
        }),
      },
    ));
    expect(response.status).toBe(401);
    expect(await prisma.prestamoCash.count({ where: { tenantId } })).toBe(prestamosAntes);
  });

  it('revierte creación canónica, cuenta por cobrar y reconciliación si falla postEvento', async () => {
    const failingTrigger = `cta_prest_create_${crypto.randomUUID().replaceAll('-', '')}`;
    temporaryTriggers.push(failingTrigger);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${failingTrigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${failingTrigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${failingTrigger}()`);

    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString();
    const prestamosAntes = await prisma.prestamoCash.count({ where: { tenantId } });
    const cxcAntes = await prisma.cuentaPorCobrar.count({ where: { tenantId } });
    const recAntes = await prisma.reconciliacionVenta.count({ where: { tenantId } });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId, montoCapital: 25, moneda: 'CUP', cuentaBancariaId: cuentaId,
      },
      user: {
        userId: 'actor-real', tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true },
      } as never,
    })).rejects.toThrow('posteo SQL rechazado');

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString()).toBe(saldoAntes);
    expect(await prisma.prestamoCash.count({ where: { tenantId } })).toBe(prestamosAntes);
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(cxcAntes);
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(recAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);

    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failingTrigger} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failingTrigger}()`);
    temporaryTriggers.splice(temporaryTriggers.indexOf(failingTrigger), 1);
  });

  it('revierte el pago canónico y todos sus efectos si falla postEvento', async () => {
    const failingTrigger = `cta_prest_pay_${crypto.randomUUID().replaceAll('-', '')}`;
    temporaryTriggers.push(failingTrigger);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${failingTrigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${failingTrigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${failingTrigger}()`);

    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString();
    const cxcAntes = (await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: (await prisma.prestamoCash.findUniqueOrThrow({
        where: { id: canonicalLoanId },
      })).cuentaPorCobrarId },
    })).montoPagado.toString();
    const recAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, prestamoCashId: canonicalLoanId },
    });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });
    const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;

    await expect(AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: canonicalLoanId, monto: 5, cuentaId: cuentaIdPagar, tipoPagoId,
        moneda: 'USD', tasaCambio: 24,
      },
      user: {
        userId: 'actor-real', tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true },
      } as never,
    })).rejects.toThrow('posteo SQL rechazado');

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString()).toBe(saldoAntes);
    expect((await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: (await prisma.prestamoCash.findUniqueOrThrow({
        where: { id: canonicalLoanId },
      })).cuentaPorCobrarId },
    })).montoPagado.toString()).toBe(cxcAntes);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, prestamoCashId: canonicalLoanId },
    })).toBe(recAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);

    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failingTrigger} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failingTrigger}()`);
    temporaryTriggers.splice(temporaryTriggers.indexOf(failingTrigger), 1);
  });

  it('revierte el pago cuando falla SQL dentro de postEvento', async () => {
    trigger = `cta_prest_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);

    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString();
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH' },
    });
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });
    const montoPagadoAntes = (await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: cxcPagarId },
    })).montoPagado.toString();

    const response = await POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto: 111, cuentaId: cuentaIdPagar,
          tipoPagoId: (await prisma.tipoPago.findFirstOrThrow({
            where: { tenantId, nombre: 'Transferencia' },
          })).tipoId }),
      }), { params: Promise.resolve({ id: prestamoPagarId }) });
    expect(response.status).toBe(500);
    // El fallo proviene del trigger dentro de postEvento, no de un TypeError
    // de contexto: la reconciliación no existe y el saldo no cambió.

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaIdPagar },
    })).saldo.toString()).toBe(saldoAntes);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH' },
    })).toBe(recsAntes);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    expect((await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: cxcPagarId },
    })).montoPagado.toString()).toBe(montoPagadoAntes);
  });
  it('rechaza el reintento de pago de un préstamo ya pagado (idempotencia por estado)', async () => {
    // El test anterior deja un trigger que falla los asientos; lo retiramos.
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    // El test anterior pagó 400/1000 (parcial). Completamos el pago aquí.
    const tipoPago = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    const pagar = (monto: number) => POST_PAGAR(new NextRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${prestamoPagarId}/pagar`, {
        method: 'POST', body: JSON.stringify({ monto, cuentaId: cuentaIdPagar, tipoPagoId: tipoPago }),
      }), { params: Promise.resolve({ id: prestamoPagarId }) });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: prestamoPagarId },
    });

    const completar = await pagar(600);
    expect(completar.status).toBe(201);
    expect((await prisma.prestamoCash.findUniqueOrThrow({ where: { id: prestamoPagarId } })).estado)
      .toBe('PAGADO');

    const reintento = await pagar(100);
    expect(reintento.status).toBe(400);

    // Sin duplicados por el reintento: solo la reconciliación del pago de 600.
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: prestamoPagarId },
    })).toBe(recsAntes + 1);
  });
});

