import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { POST } from '@/app/api/contabilidad/reconciliacion/servicios/route';
import { POST as POST_MOBILE_SERVICIOS } from '@/app/api/mobile/v1/accounting/reconciliation/services/route';
import { POST as POST_LEGACY_VENTA } from '@/app/api/contabilidad/reconciliacion/ventas/route';
import { NextRequest } from 'next/server';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth-middleware')>();
  return { ...original, authenticateUser: async () => ({
    user: {
      userId: 'actor-real', tenantId, tenantRole: 'manager',
      planFeatures: { servicios: true, contabilidad: true },
    },
  }) };
});
vi.mock('@/lib/services/validate-period-write', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/validate-period-write')>();
  return { ...original, validarEscrituraPeriodo: async () => ({ permitido: true }) };
});
vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return { ...original, withAction: (fn: (...args: never[]) => unknown) => fn };
});
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import {
  reconciliarServicioAction as _reconciliarServicioAction,
  reconciliarVentaAction as _reconciliarVentaAction,
} from '@/features/contabilidad/actions-reconciliacion'
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { ServerAction } from '@/lib/server-actions/types';
type RawAction<A> = A extends ServerAction<infer I, infer O> ? (input: I, user: AuthenticatedUser) => Promise<O> : never;
const reconciliarServicioAction = _reconciliarServicioAction as unknown as RawAction<typeof _reconciliarServicioAction>;
const reconciliarVentaAction = _reconciliarVentaAction as unknown as RawAction<typeof _reconciliarVentaAction>;

const prefix = `cta-servicio-${crypto.randomUUID()}`;
const fecha = '2026-02-15T12:00:00.000Z';
let tenantId = '';
let otherTenantId = '';
let ventaServicioId = '';
let rollbackServicioId = '';
let creditoServicioId = '';
let rollbackCreditoServicioId = '';
let concurrentCreditoServicioId = '';
let creditoServicioCxcId = 0;
let rollbackCreditoServicioCxcId = 0;
let concurrentCreditoServicioCxcId = 0;
let otherServicioId = '';
let cuentaId = '';
let otherCuentaId = '';
let tipoPagoId = '';
let otherTipoPagoId = '';
let ventaId = '';
let rollbackVentaId = '';
let legacySaleId = '';
let cxcSaleId = '';
let rollbackCxcSaleId = '';
let cxcId = 0;
let rollbackCxcId = 0;
let cxcClienteId = '';
let puntoDeVentaId = '';
let trigger = '';
let triggerTable = 'asientos';

/** @description Ejercita la action y el motor formal con filas PostgreSQL reales. */
describe('reconciliarServicioAction — PostgreSQL aislado', { timeout: 60_000 }, () => {
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
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-real' },
    });
    const other = await prisma.tenant.create({ data: { nombre: `${prefix}-other`, slug: `${prefix}-other` } });
    otherTenantId = other.tenantId;
    puntoDeVentaId = (await prisma.puntoDeVenta.create({ data: {
      tenantId, nombre: `${prefix}-pv`,
    } })).pvId;
    ventaId = (await prisma.venta.create({ data: {
      tenantId, puntoDeVentaId, cantidad: 1, total: 10,
    } })).ventaId;
    rollbackVentaId = (await prisma.venta.create({ data: {
      tenantId, puntoDeVentaId, cantidad: 1, total: 10,
    } })).ventaId;
    legacySaleId = (await prisma.venta.create({ data: {
      tenantId, puntoDeVentaId, cantidad: 1, total: 240,
    } })).ventaId;
    cxcClienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cxc` },
    })).clienteId;
    cxcSaleId = (await prisma.venta.create({ data: {
      tenantId, puntoDeVentaId, clienteId: cxcClienteId, cantidad: 1, total: 100,
    } })).ventaId;
    rollbackCxcSaleId = (await prisma.venta.create({ data: {
      tenantId, puntoDeVentaId, clienteId: cxcClienteId, cantidad: 1, total: 100,
    } })).ventaId;
    const serieId = (await prisma.serieFacturacion.create({ data: {
      tenantId, prefijo: prefix, descripcion: prefix,
    } })).serieId;
    const factura = await prisma.factura.create({ data: {
      tenantId, serieId, numeroFactura: `${prefix}-cxc`, clienteId: cxcClienteId,
      subtotal: 100, total: 100, creadoPor: 'actor-real', ventaId: cxcSaleId,
    } });
    const rollbackFactura = await prisma.factura.create({ data: {
      tenantId, serieId, numeroFactura: `${prefix}-cxc-rollback`, clienteId: cxcClienteId,
      subtotal: 100, total: 100, creadoPor: 'actor-real', ventaId: rollbackCxcSaleId,
    } });
    const cxcEvidence = buildAppliedFxEvidenceExact({
      originalAmount: '100',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24',
      convertedAmount: '2400',
      rateEffectiveAt: new Date(fecha),
      source: 'integration-fixture',
      fxProvenanceKind: 'MANUAL_GOVERNED',
    });
    const cxcFx = {
      tenantId,
      clienteId: cxcClienteId,
      montoDeuda: 100,
      montoOriginal: 100,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: 0,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      rateEffectiveAt: cxcEvidence.rateEffectiveAt,
      fxProvenanceKind: cxcEvidence.evidence.fxProvenanceKind,
      fxProvenanceSource: cxcEvidence.evidence.fxProvenanceSource,
      fxEvidenceJson: cxcEvidence.evidence,
      fxEvidenceFingerprint: cxcEvidence.evidence.fxEvidenceFingerprint,
      fxEvidenceVersion: cxcEvidence.evidence.fxEvidenceVersion,
	    } as any;
    cxcId = (await prisma.cuentaPorCobrar.create({
      data: { ...cxcFx, facturaId: factura.idFactura },
    })).idCC;
    rollbackCxcId = (await prisma.cuentaPorCobrar.create({
      data: { ...cxcFx, facturaId: rollbackFactura.idFactura },
    })).idCC;
    const servicio = await prisma.servicios.create({ data: {
      tenantId, nombre: prefix, descripcion: prefix, precio: 10,
    } });
    const venta = await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicio.servicioId, cantidad: 1, total: 10, moneda: 'USD',
    } });
    ventaServicioId = venta.ventaServicioId;
    rollbackServicioId = (await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicio.servicioId, cantidad: 1, total: 10, moneda: 'USD',
    } })).ventaServicioId;
    creditoServicioId = (await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicio.servicioId, cantidad: 1, total: 100, moneda: 'USD',
      clienteId: cxcClienteId, condicionPago: 'CREDITO',
    } })).ventaServicioId;
    rollbackCreditoServicioId = (await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicio.servicioId, cantidad: 1, total: 100, moneda: 'USD',
      clienteId: cxcClienteId, condicionPago: 'CREDITO',
    } })).ventaServicioId;
    concurrentCreditoServicioId = (await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicio.servicioId, cantidad: 1, total: 100, moneda: 'USD',
      clienteId: cxcClienteId, condicionPago: 'CREDITO',
    } })).ventaServicioId;
    creditoServicioCxcId = (await prisma.cuentaPorCobrar.create({
      data: { ...cxcFx, ventaServicioId: creditoServicioId },
    })).idCC;
    rollbackCreditoServicioCxcId = (await prisma.cuentaPorCobrar.create({
      data: { ...cxcFx, ventaServicioId: rollbackCreditoServicioId },
    })).idCC;
    concurrentCreditoServicioCxcId = (await prisma.cuentaPorCobrar.create({
      data: { ...cxcFx, ventaServicioId: concurrentCreditoServicioId },
    })).idCC;
    const otroServicio = await prisma.servicios.create({ data: {
      tenantId: otherTenantId, nombre: `${prefix}-other`, descripcion: prefix, precio: 10,
    } });
    otherServicioId = (await prisma.ventaServicios.create({ data: {
      tenantId: otherTenantId, servicioId: otroServicio.servicioId, cantidad: 1, total: 10,
    } })).ventaServicioId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    otherCuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId: otherTenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-other`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({ data: { tenantId, nombre: prefix } })).tipoId;
    otherTipoPagoId = (await prisma.tipoPago.create({ data: {
      tenantId: otherTenantId, nombre: `${prefix}-other`,
    } })).tipoId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, servicios: true, contabilidad: true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date('2026-02-01T00:00:00Z'),
      fechaFin: new Date('2026-02-28T23:59:59Z'),
    } });
    await PeriodoGuard.assertWritable(new Date(fecha), tenantId, 'asiento', {
      actorId: 'actor-real', actorTipo: 'USUARIO', origen: { tipo: 'reconciliacion_servicio', id: prefix },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (trigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "${triggerTable}"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
    if (!tenantId) return;
    for (const id of [tenantId, otherTenantId]) {
      const reconciliacionIds = await prisma.reconciliacionServicio.findMany({
        where: { tenantId: id },
        select: { reconciliacionId: true },
      });
      if (reconciliacionIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: {
            entidad: 'RECONCILIACION',
            entidadId: { in: reconciliacionIds.map(({ reconciliacionId }) => reconciliacionId) },
          },
        });
      }
      await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId: id } } });
      await prisma.asiento.deleteMany({ where: { tenantId: id } });
      await prisma.reconciliacionServicio.deleteMany({ where: { tenantId: id } });
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: id } });
      await prisma.factura.deleteMany({ where: { tenantId: id } });
      await prisma.venta.deleteMany({ where: { tenantId: id } });
      await prisma.puntoDeVenta.deleteMany({ where: { tenantId: id } });
      await prisma.ventaServicios.deleteMany({ where: { tenantId: id } });
      await prisma.servicios.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId: id } });
      await prisma.diario.deleteMany({ where: { tenantId: id } });
      await prisma.periodoCache.deleteMany({ where: { tenantId: id } });
      await prisma.periodoContable.deleteMany({ where: { tenantId: id } });
      await prisma.tipoPago.deleteMany({ where: { tenantId: id } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId: id } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId: id } });
      await prisma.cliente.deleteMany({ where: { tenantId: id } });
      await prisma.serieFacturacion.deleteMany({ where: { tenantId: id } });
      await prisma.serieFacturacion.deleteMany({ where: { tenantId: id } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { tenantId: id } });
    }
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
  });

  it('aísla referencias de otro tenant antes de acreditar saldo', async () => {
    for (const [servicio, cuenta, pago] of [
      [otherServicioId, cuentaId, tipoPagoId],
      [ventaServicioId, otherCuentaId, tipoPagoId],
      [ventaServicioId, cuentaId, otherTipoPagoId],
    ]) {
      await expect(reconciliarServicioAction({ ventaServicioId: servicio, fechaReconciliacion: fecha,
        distribuciones: [{ cuentaId: cuenta, tipoPagoId: pago, monto: 10 }],
      }, { tenantId, userId: 'actor-real', tenantRole: 'manager',
        planFeatures: { servicios: true } } as never)).rejects.toThrow();
    }
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo.toString())
      .toBe('0');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: otherCuentaId } }))
      .saldo.toString()).toBe('0');
    expect(await prisma.reconciliacionServicio.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.reconciliacionServicio.count({ where: { tenantId: otherTenantId } }))
      .toBe(0);
  });

  it('usa autorización real del action: dependiente sin permiso no muta distribución', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    await expect(reconciliarServicioAction({
      ventaServicioId, fechaReconciliacion: fecha,
      distribuciones: [{ cuentaId, tipoPagoId, monto: 10 }],
    }, {
      tenantId, userId: 'actor-dependent', tenantRole: 'dependiente',
      planFeatures: { servicios: true },
    } as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(saldoAntes);
    expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId } })).toBe(0);
  });

  it('usa feature real del tenant: plan sin servicios no inicia la mutación', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    await expect(reconciliarServicioAction({
      ventaServicioId, fechaReconciliacion: fecha,
      distribuciones: [{ cuentaId, tipoPagoId, monto: 10 }],
    }, {
      tenantId, userId: 'actor-manager', tenantRole: 'manager', planFeatures: {},
    } as never)).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(saldoAntes);
    expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId } })).toBe(0);
  });

  it('mobile reconcileSale persiste FX y un único asiento por reconciliación', async () => {
    const resultado = await AccountingReconciliationService.reconcileSale({
      input: {
        ventaId: ventaId,
        cuentaId,
        tipoPagoId,
        monto: 10,
        moneda: 'USD',
        tasaCambio: 24,
        fechaReconciliacion: fecha,
      },
      user: {
        tenantId, userId: 'actor-real', tenantRole: 'manager',
        planFeatures: { contabilidad: true },
      } as never,
    });

    expect(resultado.montoConvertido!.toString()).toBe('240');
    expect(resultado.fxEvidenceFingerprint).toBeTruthy();
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: resultado.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === resultado.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('la Server Action de ventas delega al writer compartido con FX y autorización', async () => {
    const actor = {
      tenantId,
      userId: 'actor-action-cxc',
      tenantRole: 'manager',
      planFeatures: { contabilidad: true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    } as Record<string, unknown>;
    const result = await reconciliarVentaAction({
      ventaId,
      cuentaId,
      tipoPagoId,
      monto: 10,
      moneda: 'USD',
      tasaCambio: 24,
      fechaReconciliacion: fecha,
	}, actor as any);

    expect(result.success).toBe(true)
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(result).toMatchObject({ tenantId, ventaId });
    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'reconciliacion_venta', origenId: result.data.reconciliacionId },
      include: { lineas: true },
    });
    expect(asiento.createdBy).toBe('actor-action-cxc');
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas.every((linea) =>
      linea.fxEvidenceFingerprint === result.fxEvidenceFingerprint &&
      linea.tasaCambio?.eq(new Prisma.Decimal('24')),
    )).toBe(true);
  });

  it('actualiza el nominal/funcional de CxC y asienta la diferencia FX', async () => {
    const resultado = await AccountingReconciliationService.reconcileSale({
      input: {
        ventaId: cxcSaleId, cuentaId, tipoPagoId, monto: 40,
        moneda: 'USD', tasaCambio: 25, fechaReconciliacion: fecha,
      },
      user: {
        tenantId, userId: 'actor-real', tenantRole: 'manager',
        planFeatures: { contabilidad: true },
      } as never,
    });

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
    });
    expect(cxc.estado).toBe('PARCIAL');
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('1000');
    const asiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: resultado.reconciliacionId,
    }, include: { lineas: true } });
    expect(asiento.lineas).toHaveLength(3);
    expect(asiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '40'], ['0', '960'], ['1000', '0']]);
  });

  it('revierte tesorería, asiento y cobro si falla actualizar la CxC', async () => {
    trigger = `cta_cxc_update_${crypto.randomUUID().replaceAll('-', '')}`;
    triggerTable = 'CuentaPorCobrar';
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CxC update rejected' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON "CuentaPorCobrar"
      FOR EACH ROW WHEN (NEW."idCC" = ${rollbackCxcId}) EXECUTE FUNCTION ${trigger}()`);
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString();
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    try {
      await expect(AccountingReconciliationService.reconcileSale({
        input: { ventaId: rollbackCxcSaleId, cuentaId, tipoPagoId, monto: 40,
          moneda: 'USD', tasaCambio: 24, fechaReconciliacion: fecha },
        user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
          planFeatures: { contabilidad: true } } as never,
      })).rejects.toThrow(/CxC update rejected/);

      const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
        where: { idCC: rollbackCxcId, tenantId },
      });
      expect(cxc.estado).toBe('PENDIENTE');
      expect(cxc.montoPagado.toString()).toBe('0');
      expect(cxc.montoPagadoFuncional?.toString()).toBe('0');
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo.toString())
        .toBe(saldoAntes);
      expect(await prisma.reconciliacionVenta.count({ where: { ventaId: rollbackCxcSaleId } })).toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "CuentaPorCobrar"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
      trigger = '';
      triggerTable = 'asientos';
    }
  });

  it('legacy web ventas persiste fingerprint FX y lo transmite al asiento', async () => {
    const response = await POST_LEGACY_VENTA(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({
          ventaId: legacySaleId,
          cuentaId,
          tipoPagoId,
          monto: 10,
          moneda: 'USD',
          tasaCambio: 24,
          fechaReconciliacion: fecha,
        }),
      },
    ));
    expect(response.status).toBe(201);

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: {
      tenantId, ventaId: legacySaleId,
    } });
    expect(rec.montoConvertido?.toString()).toBe('240');
    expect(rec.fxEvidenceFingerprint).toBeTruthy();
    expect(rec.tasaCambio?.toString()).toBe('24');
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_venta', origenId: rec.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rec.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === '24')).toBe(true);
  });

  it('legacy web COBRO_CXC actualiza pago nominal y funcional desde el snapshot', async () => {
    const response = await POST_LEGACY_VENTA(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({
          ventaId: cxcSaleId,
          cuentaId,
          tipoPagoId,
          monto: 40,
          moneda: 'USD',
          tasaCambio: 25,
          fechaReconciliacion: fecha,
        }),
      },
    ));
    expect(response.status).toBe(201);

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: cxcId, tenantId },
    });
    expect(cxc.montoPagado.toString()).toBe('80');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('2000');
    expect(cxc.estado).toBe('PARCIAL');
    const reconciliacion = await prisma.reconciliacionVenta.findFirstOrThrow({
      where: { tenantId, ventaId: cxcSaleId },
    });
    expect(reconciliacion.montoConvertido?.toString()).toBe('1000');
    expect(reconciliacion.fxEvidenceFingerprint).toBeTruthy();
    const asiento = await prisma.asiento.findFirstOrThrow({
      where: {
        tenantId,
        origenTipo: 'reconciliacion_venta',
        origenId: reconciliacion.reconciliacionId,
      },
      include: { lineas: true },
    });
    expect(asiento.lineas).toHaveLength(3);
    expect(asiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '40'], ['0', '960'], ['1000', '0']]);
  });

  it('legacy web rollback SQL revierte tesorería, CxC funcional y asiento en COBRO_CXC', async () => {
    trigger = `legacy_cxc_rollback_${crypto.randomUUID().replaceAll('-', '')}`;
    triggerTable = 'CuentaPorCobrar';
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."idCC" = ${rollbackCxcId} THEN
          RAISE EXCEPTION 'legacy CxC SQL rollback' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "CuentaPorCobrar"
      FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);

    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const asientoCountAntes = await prisma.asiento.count({ where: { tenantId } });
    const cxcAntes = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: rollbackCxcId, tenantId },
    });
    try {
      const response = await POST_LEGACY_VENTA(new NextRequest(
        'http://localhost/api/contabilidad/reconciliacion/ventas', {
          method: 'POST',
          body: JSON.stringify({
            ventaId: rollbackCxcSaleId,
            cuentaId,
            tipoPagoId,
            monto: 40,
            moneda: 'USD',
            tasaCambio: 24,
            fechaReconciliacion: fecha,
          }),
        },
      ));
      expect(response.status).toBe(500);
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(saldoAntes);
      const cxcDespues = await prisma.cuentaPorCobrar.findFirstOrThrow({
        where: { idCC: rollbackCxcId, tenantId },
      });
      expect(cxcDespues.montoPagado.eq(cxcAntes.montoPagado)).toBe(true);
      expect(cxcDespues.montoPagadoFuncional?.eq(cxcAntes.montoPagadoFuncional!)).toBe(true);
      expect(await prisma.reconciliacionVenta.count({ where: { ventaId: rollbackCxcSaleId } }))
        .toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientoCountAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "CuentaPorCobrar"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
      trigger = '';
      triggerTable = 'asientos';
    }
  });

  it('reconcileSale rechaza FX sin fecha/tasa efectiva y rol sin permiso', async () => {
    const reconciliacionesAntes = await prisma.reconciliacionVenta.count({ where: { tenantId } });
    const params = {
      ventaId, cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24,
    };
    await expect(AccountingReconciliationService.reconcileSale({
      input: params,
      user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
        planFeatures: { contabilidad: true } } as never,
    })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
    await expect(AccountingReconciliationService.reconcileSale({
      input: { ...params, moneda: 'CUP', tasaCambio: undefined },
      user: { tenantId, userId: 'actor-dependent', tenantRole: 'dependiente',
        planFeatures: { contabilidad: true } } as never,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(reconciliacionesAntes);
  });

  it('revierte saldo, reconciliación y asiento de reconcileSale ante fallo SQL', async () => {
    trigger = `cta_sale_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo.toString();
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    try {
      await expect(AccountingReconciliationService.reconcileSale({
        input: { ventaId: rollbackVentaId, cuentaId, tipoPagoId, monto: 10,
          moneda: 'CUP', fechaReconciliacion: fecha },
        user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
          planFeatures: { contabilidad: true } } as never,
      })).rejects.toThrow(/posteo SQL rechazado/);

      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
        .saldo.toString()).toBe(saldoAntes);
      expect(await prisma.reconciliacionVenta.count({ where: { tenantId, ventaId: rollbackVentaId } }))
        .toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
      trigger = '';
    }
  });

  it('contabiliza exactamente un asiento con FX heredada de la fila', async () => {
    const result = await reconciliarServicioAction({ ventaServicioId, fechaReconciliacion: fecha,
      distribuciones: [{ cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24 }],
    }, { tenantId, userId: 'actor-real', tenantRole: 'manager',
      planFeatures: { servicios: true } } as never);
    expect(result).toMatchObject({ reconciliado: true });
    const row = await prisma.reconciliacionServicio.findFirstOrThrow({ where: { tenantId } });
    const asientos = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_servicio', origenId: row.reconciliacionId,
    }, include: { lineas: true } });
    expect(asientos).toHaveLength(1);
    expect(row.fxEvidenceFingerprint).toBeTruthy();
    expect(row.montoConvertido?.toString()).toBe('240');
    expect(asientos[0].lineas.some((linea) => linea.fxEvidenceFingerprint === row.fxEvidenceFingerprint
      && linea.tasaCambio?.toString() === row.tasaCambio?.toString())).toBe(true);
    expect(await prisma.auditLog.findFirst({ where: {
      entidad: 'RECONCILIACION', entidadId: row.reconciliacionId,
      usuarioId: 'actor-real',
    } })).not.toBeNull();
  });

  it('mueve origen y destino con el importe nativo de cada cuenta', async () => {
    const cuentaOrigen = await prisma.cuentaBancaria.create({ data: {
      tenantId,
      nombreBanco: `${prefix}-origen-usd`,
      numeroCuenta: `${prefix}-origen-usd`,
      tipoCuenta: 'CORRIENTE',
      moneda: 'USD',
      saldo: 100,
    } });
    const tipoPagoOrigen = await prisma.tipoPago.create({ data: {
      tenantId,
      nombre: `${prefix}-transferencia-interna`,
      requiereCuenta: true,
      cuentaDefecto: cuentaOrigen.cuentaId,
    } });
    const servicioId = (await prisma.ventaServicios.findUniqueOrThrow({
      where: { ventaServicioId },
      select: { servicioId: true },
    })).servicioId;
    const ventaServicio = await prisma.ventaServicios.create({ data: {
      tenantId, servicioId, cantidad: 1, total: 10, moneda: 'USD',
    } });
    const saldoDestinoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;

    const result = await AccountingReconciliationService.reconcileService({
      user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
        planFeatures: { servicios: true } } as never,
      input: {
        ventaServicioId: ventaServicio.ventaServicioId,
        fechaReconciliacion: fecha,
        distribuciones: [{ cuentaId, tipoPagoId: tipoPagoOrigen.tipoId, monto: 10,
          moneda: 'USD', tasaCambio: 24, fechaTasa: fecha }],
      },
    });

    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigen.cuentaId },
    })).saldo).toBe(90);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(Number(saldoDestinoAntes) + 240);
    const row = await prisma.reconciliacionServicio.findFirstOrThrow({
      where: { tenantId, ventaServicioId: ventaServicio.ventaServicioId },
    });
    expect(row.cuentaOrigenId).toBe(cuentaOrigen.cuentaId);
    expect(row.montoCuentaOrigen?.toString()).toBe('10');
    expect(row.monedaCuentaOrigen).toBe('USD');
    expect(row.montoCuenta?.toString()).toBe('240');
    expect(row.monedaCuenta).toBe('CUP');
    expect(result.reconciliaciones[0].montoCuenta?.toString()).toBe('240');
    await expect(prisma.reconciliacionServicio.update({
      where: { reconciliacionId: row.reconciliacionId },
      data: { monedaCuenta: null },
    })).rejects.toThrow(/ReconciliacionServicio_accountAmountPair_check/);
    await expect(prisma.reconciliacionServicio.update({
      where: { reconciliacionId: row.reconciliacionId },
      data: { montoCuentaOrigen: null },
    })).rejects.toThrow(/ReconciliacionServicio_sourceAccountAmountPair_check/);
  });

  it('revierte caja, reconciliación y asiento si falla la auditoría transaccional', async () => {
    trigger = `cta_serv_audit_${crypto.randomUUID().replaceAll('-', '')}`;
    triggerTable = 'AuditLog';
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."usuarioId" = 'audit-fail-actor' THEN
          RAISE EXCEPTION 'service audit rejected' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const servicioBase = await prisma.ventaServicios.findUniqueOrThrow({
      where: { ventaServicioId },
      select: { servicioId: true },
    });
    const ventaServicio = await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: servicioBase.servicioId, cantidad: 1, total: 10, moneda: 'USD',
    } });
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo;
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });

    try {
      await expect(AccountingReconciliationService.reconcileService({
        user: { tenantId, userId: 'audit-fail-actor', tenantRole: 'manager',
          planFeatures: { servicios: true } } as never,
        input: {
          ventaServicioId: ventaServicio.ventaServicioId,
          fechaReconciliacion: fecha,
          distribuciones: [{ cuentaId, tipoPagoId, monto: 10, moneda: 'USD',
            tasaCambio: 24, fechaTasa: fecha }],
        },
      })).rejects.toThrow(/service audit rejected/);

      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(saldoAntes);
      expect(await prisma.reconciliacionServicio.count({
        where: { tenantId, ventaServicioId: ventaServicio.ventaServicioId },
      })).toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"`);
      trigger = '';
      triggerTable = 'asientos';
    }
  });

  it('aplica cobros parciales y finales de servicio a crédito con FX y auditoría durable', async () => {
    const actor = {
      tenantId, userId: 'actor-service-cxc', tenantRole: 'manager',
      planFeatures: { servicios: true },
    } as Record<string, unknown>;
    const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo;
    const claveParcial = `partial-service-retry-${crypto.randomUUID()}`;
    const inputParcial = {
      ventaServicioId: creditoServicioId,
      fechaReconciliacion: fecha,
      cuentaId, tipoPagoId, monto: 40, moneda: 'USD', tasaCambio: 25,
      tasaEfectivaEn: fecha,
    };
    const parcialResponse = await POST(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'Idempotency-Key': claveParcial },
        body: JSON.stringify(inputParcial),
      },
    ));
    expect(parcialResponse.status).toBe(201);
    const parcial = await parcialResponse.json();

    expect(parcial.reconciliado).toBe(false);
    const cxcParcial = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: creditoServicioCxcId, tenantId },
    });
    expect(cxcParcial.estado).toBe('PARCIAL');
    expect(cxcParcial.montoPagado.toString()).toBe('40');
    expect(cxcParcial.montoPagadoFuncional?.toString()).toBe('1000');
    const primerAsiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId,
      origenTipo: 'reconciliacion_servicio',
      origenId: parcial.reconciliaciones[0].reconciliacionId,
    }, include: { lineas: true } });
    expect(primerAsiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '40'], ['0', '960'], ['1000', '0']]);
    expect(await prisma.auditLog.findFirst({ where: {
      entidad: 'RECONCILIACION',
      entidadId: parcial.reconciliaciones[0].reconciliacionId,
      usuarioId: 'actor-real',
    } })).not.toBeNull();

    const saldoDespuesPrimerIntento = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    const reintentoResponse = await POST(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'Idempotency-Key': claveParcial },
        body: JSON.stringify(inputParcial),
      },
    ));
    expect(reintentoResponse.status).toBe(200);
    const reintento = await reintentoResponse.json();
    expect(reintento.replayed).toBe(true);
    expect(reintento.reconciliaciones.map((rec: any) => rec.reconciliacionId))
      .toEqual(parcial.reconciliaciones.map((rec: any) => rec.reconciliacionId));

    const reintentoMobile = await POST_MOBILE_SERVICIOS(new Request(
      'http://localhost/api/mobile/v1/accounting/reconciliation/services', {
        method: 'POST',
        body: JSON.stringify({
          ventaServicioId: creditoServicioId,
          fechaReconciliacion: fecha,
          idempotencyKey: claveParcial,
          distribuciones: [{ cuentaId, tipoPagoId, monto: 40, moneda: 'USD',
            tasaCambio: 25, fechaTasa: fecha }],
        }),
      },
    ));
    expect(reintentoMobile.status).toBe(200);
    expect((await reintentoMobile.json()).replayed).toBe(true);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(saldoDespuesPrimerIntento);
    expect(await prisma.reconciliacionServicio.count({ where: {
      tenantId, ventaServicioId: creditoServicioId,
    } })).toBe(1);
    const conflictResponse = await POST(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'Idempotency-Key': claveParcial },
        body: JSON.stringify({
          ...inputParcial,
          monto: 41,
        }),
      },
    ));
    expect(conflictResponse.status).toBe(409);
    expect((await conflictResponse.json()).code).toBe('IDEMPOTENCY_CONFLICT');

    const final = await AccountingReconciliationService.reconcileService({
	      user: actor as any,
      input: {
        ventaServicioId: creditoServicioId,
        fechaReconciliacion: '2026-02-16T12:00:00.000Z',
        idempotencyKey: `final-service-${crypto.randomUUID()}`,
        distribuciones: [{ cuentaId, tipoPagoId, monto: 60, moneda: 'USD', tasaCambio: 25 }],
      },
    });
    expect(final.reconciliado).toBe(true);
    const cxcFinal = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: creditoServicioCxcId, tenantId },
    });
    expect(cxcFinal.estado).toBe('PAGADA');
    expect(cxcFinal.montoPagado.toString()).toBe('100');
    expect(cxcFinal.montoPagadoFuncional?.toString()).toBe('2500');
    const saldoFinal = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    expect(Number(saldoFinal) - Number(saldoInicial)).toBe(2500);
    expect(await prisma.asiento.count({ where: {
      tenantId,
      origenTipo: 'reconciliacion_servicio',
      origenId: { in: final.reconciliaciones.map(({ reconciliacionId }) => reconciliacionId) },
    } })).toBe(1);
    expect(await prisma.auditLog.count({ where: {
      entidad: 'RECONCILIACION', usuarioId: 'actor-real',
      entidadId: parcial.reconciliaciones[0].reconciliacionId,
    } })).toBe(1);
    expect(await prisma.auditLog.count({ where: {
      entidad: 'RECONCILIACION', usuarioId: 'actor-service-cxc',
      entidadId: final.reconciliaciones[0].reconciliacionId,
    } })).toBe(1);
  });

  it('serializa reintentos concurrentes del mismo cobro parcial de servicio', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }))
      .saldo;
    const idempotencyKey = `concurrent-service-${crypto.randomUUID()}`;
    const request = () => POST(new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          ventaServicioId: concurrentCreditoServicioId,
          fechaReconciliacion: fecha,
          cuentaId,
          tipoPagoId,
          monto: 40,
          moneda: 'USD',
          tasaCambio: 25,
          tasaEfectivaEn: fecha,
        }),
      },
    ));

    const responses = await Promise.all([request(), request()]);
    const payloads = await Promise.all(responses.map((response) => response.json()));
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(payloads.filter(({ replayed }) => replayed === true)).toHaveLength(1);
    expect(payloads[0].reconciliaciones[0].reconciliacionId)
      .toBe(payloads[1].reconciliaciones[0].reconciliacionId);

    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { idCC: concurrentCreditoServicioCxcId, tenantId },
    });
    expect(cxc.estado).toBe('PARCIAL');
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('1000');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo.toString())
      .toBe(new Prisma.Decimal(saldoAntes).plus(1000).toString());
    expect(await prisma.reconciliacionServicio.count({
      where: { tenantId, ventaServicioId: concurrentCreditoServicioId },
    })).toBe(1);
    const reconciliation = await prisma.reconciliacionServicio.findFirstOrThrow({
      where: { tenantId, ventaServicioId: concurrentCreditoServicioId },
    });
    expect(await prisma.asiento.count({ where: {
      tenantId,
      origenTipo: 'reconciliacion_servicio',
      origenId: reconciliation.reconciliacionId,
    } })).toBe(1);
    expect(await prisma.auditLog.count({ where: {
      entidad: 'RECONCILIACION',
      entidadId: reconciliation.reconciliacionId,
      usuarioId: 'actor-real',
    } })).toBe(1);
  });

  it('revierte CxC, tesorería, asiento y auditoría si falla el update de CxC', async () => {
    trigger = `cta_serv_cxc_rollback_${crypto.randomUUID().replaceAll('-', '')}`;
    triggerTable = 'CuentaPorCobrar';
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."idCC" = ${rollbackCreditoServicioCxcId} THEN
          RAISE EXCEPTION 'service CxC update rejected' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "CuentaPorCobrar"
      FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const asientosAntes = await prisma.asiento.count({ where: { tenantId } });
    const auditoriasAntes = await prisma.auditLog.count({ where: {
      entidad: 'RECONCILIACION', usuarioId: 'actor-service-cxc',
    } });

    try {
      await expect(AccountingReconciliationService.reconcileService({
        user: {
          tenantId, userId: 'actor-service-cxc', tenantRole: 'manager',
          planFeatures: { servicios: true },
        } as never,
        input: {
          ventaServicioId: rollbackCreditoServicioId,
          fechaReconciliacion: fecha,
          idempotencyKey: `rollback-cxc-${crypto.randomUUID()}`,
          distribuciones: [{ cuentaId, tipoPagoId, monto: 40, moneda: 'USD', tasaCambio: 24 }],
        },
      })).rejects.toThrow(/service CxC update rejected/);

      const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
        where: { idCC: rollbackCreditoServicioCxcId, tenantId },
      });
      expect(cxc.estado).toBe('PENDIENTE');
      expect(cxc.montoPagado.toString()).toBe('0');
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(saldoAntes);
      expect(await prisma.reconciliacionServicio.count({
        where: { tenantId, ventaServicioId: rollbackCreditoServicioId },
      })).toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosAntes);
      expect(await prisma.auditLog.count({ where: {
        entidad: 'RECONCILIACION', usuarioId: 'actor-service-cxc',
      } })).toBe(auditoriasAntes);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "CuentaPorCobrar"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"`);
      trigger = '';
      triggerTable = 'asientos';
    }
  });

  it.each(['web', 'mobile'] as const)('%s confirma FX única y rechaza reintento', async (canal) => {
    const nuevaVentaId = (await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: (await prisma.ventaServicios.findUniqueOrThrow({
        where: { ventaServicioId },
      })).servicioId, cantidad: 1, total: 10, moneda: 'USD',
    } })).ventaServicioId;
    const execute = async () => canal === 'web'
      ? POST(new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST', body: JSON.stringify({ ventaServicioId: nuevaVentaId, cuentaId, tipoPagoId,
          monto: 10, moneda: 'USD', tasaCambio: 24, tasaEfectivaEn: fecha,
          fechaReconciliacion: fecha }),
      }))
      : AccountingReconciliationService.reconcileService({
        user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
          planFeatures: { servicios: true } } as never,
        input: { ventaServicioId: nuevaVentaId, fechaReconciliacion: fecha,
          distribuciones: [{ cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24 }] },
      });
    const first = await execute();
    if (canal === 'web') {
      expect((first as Response).status).toBe(201);
      const body = await (first as Response).json();
      expect(body.reconciliacion).toMatchObject({
        ventaServicioId: nuevaVentaId,
        cuentaId,
        tipoPagoId,
        ventasServicio: { ventaServicioId: nuevaVentaId },
        cuentaBancaria: { cuentaId },
        tipoPago: { tipoId: tipoPagoId },
      });
    }
    const rows = await prisma.reconciliacionServicio.findMany({ where: { ventaServicioId: nuevaVentaId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].fxEvidenceFingerprint).toBeTruthy();
    expect(rows[0].montoConvertido?.toString()).toBe('240');
    const asiento = await prisma.asiento.findMany({ where: {
      tenantId, origenTipo: 'reconciliacion_servicio', origenId: rows[0].reconciliacionId,
    }, include: { lineas: true } });
    expect(asiento).toHaveLength(1);
    expect(asiento[0].lineas.some((linea) =>
      linea.fxEvidenceFingerprint === rows[0].fxEvidenceFingerprint)).toBe(true);
    expect(await prisma.auditLog.findFirst({ where: {
      entidad: 'RECONCILIACION', entidadId: rows[0].reconciliacionId,
      usuarioId: 'actor-real',
    } })).not.toBeNull();
    if (canal === 'web') {
      expect((await execute() as Response).status).not.toBe(201);
    } else {
      await expect(execute()).rejects.toThrow();
    }
    expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId: nuevaVentaId } })).toBe(1);
  });

  it.each(['web', 'mobile'] as const)('%s rechaza referencia de otro tenant', async (canal) => {
    const antes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    if (canal === 'web') {
      const response = await POST(new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST', body: JSON.stringify({ ventaServicioId: otherServicioId,
          cuentaId, tipoPagoId, monto: 10, fechaReconciliacion: fecha }),
      }));
      expect(response.status).toBe(404);
    } else {
      await expect(AccountingReconciliationService.reconcileService({
        user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
          planFeatures: { servicios: true } } as never,
        input: { ventaServicioId: otherServicioId, fechaReconciliacion: fecha,
          distribuciones: [{ cuentaId, tipoPagoId, monto: 10 }] },
      })).rejects.toThrow();
    }
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(antes);
    expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId: otherServicioId } }))
      .toBe(0);
  });

  it('revierte saldo y reconciliación cuando falla SQL dentro de postEvento', async () => {
    trigger = `cta_serv_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);
    const antes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    await expect(reconciliarServicioAction({ ventaServicioId: rollbackServicioId,
      fechaReconciliacion: fecha,
      distribuciones: [{ cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24 }],
    }, { tenantId, userId: 'actor-real', tenantRole: 'manager',
      planFeatures: { servicios: true } } as never)).rejects.toThrow(/posteo SQL rechazado/);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toEqual(antes);
    expect((await prisma.ventaServicios.findUniqueOrThrow({
      where: { ventaServicioId: rollbackServicioId },
    })).reconciliado).not.toBe(true);
    expect(await prisma.reconciliacionServicio.count({
      where: { tenantId, ventaServicioId: rollbackServicioId },
    })).toBe(0);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'reconciliacion_servicio', origenId: rollbackServicioId,
    } })).toBe(0);
    for (const canal of ['web', 'mobile'] as const) {
      const target = (await prisma.ventaServicios.create({ data: {
        tenantId, servicioId: (await prisma.ventaServicios.findUniqueOrThrow({
          where: { ventaServicioId },
        })).servicioId, cantidad: 1, total: 10, moneda: 'USD',
      } })).ventaServicioId;
      const saldoInicial = (await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId },
      })).saldo;
      const auditoriasIniciales = await prisma.auditLog.count({ where: {
        entidad: 'RECONCILIACION', usuarioId: 'actor-real',
      } });
      if (canal === 'web') {
        const response = await POST(new NextRequest(
          'http://localhost/api/contabilidad/reconciliacion/servicios', {
            method: 'POST', body: JSON.stringify({ ventaServicioId: target,
              cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24,
              tasaEfectivaEn: fecha, fechaReconciliacion: fecha }),
          },
        ));
        expect(response.status).toBe(500);
      } else {
        await expect(AccountingReconciliationService.reconcileService({
          user: { tenantId, userId: 'actor-real', tenantRole: 'manager',
            planFeatures: { servicios: true } } as never,
          input: { ventaServicioId: target, fechaReconciliacion: fecha,
            distribuciones: [{ cuentaId, tipoPagoId, monto: 10, moneda: 'USD', tasaCambio: 24 }] },
        })).rejects.toThrow(/posteo SQL rechazado/);
      }
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(saldoInicial);
      expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId: target } }))
        .toBe(0);
      expect((await prisma.ventaServicios.findUniqueOrThrow({ where: { ventaServicioId: target } }))
        .reconciliado).not.toBe(true);
      expect(await prisma.auditLog.count({ where: {
        entidad: 'RECONCILIACION', usuarioId: 'actor-real',
      } })).toBe(auditoriasIniciales);
    }
  });
});
