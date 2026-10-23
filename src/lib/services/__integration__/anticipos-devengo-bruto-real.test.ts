/**
 * @description Tratamiento contable confirmado para anticipos (filas 25/26):
 * el devengo bruto de la venta/compra (ingreso/gasto + obligación CxC/CxP por el
 * TOTAL) se registra primero, y el anticipo se aplica después contra CxC/CxP
 * (ANTICIPO_*_APLICADO), eliminando el posteo adicional:
 * - venta-servicios ya no postea COBRO_SERVICIO bancario por cada anticipo (el
 *   dinero se recibió en ANTICIPO_CLIENTE_RECIBIDO);
 * - compras-servicios ya no postea GASTO_CON_ANTICIPO_PROVEEDOR (el gasto se
 *   devenga bruto en GASTO_CREDITO y la obligación se materializa en CxP).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { verificarCadenaAsientos } from '@/features/contabilidad-formal/services/verificador-hash-service';
import { createAnticipo } from '@/lib/services/anticipos-workflow';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { createVentaServicioAction as _createVentaServicioAction } from '@/features/venta-servicios/actions';
import {
  createCompraServicioAction as _createCompraServicioAction,
  deleteCompraServicioAction as _deleteCompraServicioAction,
} from '@/features/compras-servicios/actions';
import { deleteGastosDEAction as _deleteGastosDEAction } from '@/features/gastosDE/actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { ServerAction } from '@/lib/server-actions/types';
type RawAction<A> = A extends ServerAction<infer I, infer O> ? (input: I, user: AuthenticatedUser) => Promise<O> : never;
const createCompraServicioAction = _createCompraServicioAction as unknown as RawAction<typeof _createCompraServicioAction>;
const createVentaServicioAction = _createVentaServicioAction as unknown as RawAction<typeof _createVentaServicioAction>;
const deleteCompraServicioAction = _deleteCompraServicioAction as unknown as RawAction<typeof _deleteCompraServicioAction>;
const deleteGastosDEAction = _deleteGastosDEAction as unknown as RawAction<typeof _deleteGastosDEAction>;
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';
import { reverseFormalEntries } from '@/features/contabilidad-formal/services/reversal-service';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return {
    ...original,
    withAction: (fn: (...args: never[]) => unknown) => async (...args: never[]) => ({
      success: true,
      data: await fn(...args),
    }),
  };
});
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-ant-bruto-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let clienteId = '';
let proveedorId = '';
let servicioId = '';
let servicioUsdId = '';
let contratoId = '';
let cuentaId = '';
let tipoPagoId = '';
let anticipoCobroId = '';
let anticipoPagoId = '';
const tasaIds: string[] = [];

/**
 * @description Normaliza las filas completas de Prisma para comparar snapshots de rollback.
 * @param {unknown} value - Fila, arreglo o escalar retornado por Prisma.
 * @returns {unknown} Valor comparable sin instancias mutables de Decimal o Date.
 */
function normalizarFila(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizarFila);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizarFila(nested)]),
    );
  }
  return value;
}

/**
 * @description Captura todos los efectos persistidos relevantes de una compra con anticipo.
 * @returns {Promise<unknown>} Snapshot por tenant con documento, CxP, anticipos, asientos y outbox.
 */
async function capturarSnapshotCompraServicio(): Promise<unknown> {
  const [compras, cuentasPorPagar, anticipos, movimientos, asientos, outbox] = await Promise.all([
    prisma.compraServicio.findMany({ where: { tenantId }, orderBy: { compraServicioId: 'asc' } }),
    prisma.cuentaPorPagar.findMany({ where: { tenantId }, orderBy: { cuentaPorPagarId: 'asc' } }),
    prisma.anticipo.findMany({ where: { tenantId }, orderBy: { anticipoId: 'asc' } }),
    prisma.anticipoMovimiento.findMany({
      where: { anticipo: { tenantId } },
      orderBy: { movimientoId: 'asc' },
    }),
    prisma.asiento.findMany({
      where: { tenantId },
      include: { lineas: { orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }] } },
      orderBy: { asientoId: 'asc' },
    }),
    prisma.shadowPosteoOutbox.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
  ]);
  return normalizarFila({ compras, cuentasPorPagar, anticipos, movimientos, asientos, outbox });
}
const admin = {
  userId: 'actor-bruto', name: 'Test', email: 'test@test.com', role: 'admin', isActive: true, tenantId: '', tenantRole: 'manager',
  planFeatures: { gastos: true, servicios: true, compras: true, contabilidad: true },
} as unknown as AuthenticatedUser;

describe('filas 25/26 — devengo bruto y aplicación de anticipos', { timeout: 90_000 }, () => {
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
    admin.tenantId = tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: {
        'contabilidad-formal': true, gastos: true, servicios: true, compras: true,
        contabilidad: true,
      },
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
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    })).clienteId;
    proveedorId = (await prisma.vendor.create({
      data: { tenantId, nombre: `${prefix}-proveedor` },
    })).vendorId;
    servicioId = (await prisma.servicios.create({ data: {
      tenantId, nombre: prefix, descripcion: prefix, precio: 100, moneda: 'CUP',
    } })).servicioId;
    servicioUsdId = (await prisma.servicios.create({ data: {
      tenantId, nombre: `${prefix}-usd`, descripcion: prefix, precio: 100, moneda: 'USD',
    } })).servicioId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
      saldo: 5000,
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    contratoId = (await prisma.contrato.create({
      data: {
        tenantId, numeroContrato: `${prefix}-c1`, numeroConsecutivo: 1, tipo: 'SERVICIO',
        estado: 'ACTIVO', clienteId, fechaInicio: new Date('2026-01-01'), creadoPor: userId,
      },
    })).contratoId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
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
    anticipoCobroId = (await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }))).anticipoId;
    anticipoPagoId = (await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }))).anticipoId;
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.anticipoMovimiento.deleteMany({ where: { anticipo: { tenantId } } });
    await prisma.anticipo.deleteMany({ where: { tenantId } });
    await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasaIds } } });
    await prisma.reconciliacionServicio.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.gastosDE.deleteMany({ where: { tenantId } });
    await prisma.transaccionMoneda.deleteMany({ where: { tenantId } });
    await prisma.ventaServicios.deleteMany({ where: { tenantId } });
    await prisma.compraServicio.deleteMany({ where: { tenantId } });
    await prisma.contrato.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.servicios.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
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

  it('venta-servicios: devengo bruto VENTA_CREDITO, sin COBRO_SERVICIO bancario', async () => {
    const venta = await createVentaServicioAction({
      servicioId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId,
      anticipos: [{ anticipoId: anticipoCobroId, montoAplicado: 40 }],
    }, admin);

    expect(venta.success).toBe(true)
    if (!venta.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { tenantId, ventaServicioId: venta.data.ventaServicio.ventaServicioId },
    });
    expect(cxc.montoDeuda.toString()).toBe('100');
    expect(cxc.montoPagado.toString()).toBe('40');
    expect(cxc.estado).toBe('PARCIAL');

    const asientos = await prisma.asiento.findMany({ where: { tenantId }, include: { lineas: true } });
    const cobroServicio = asientos.filter((a) => a.origenTipo === 'reconciliacion_servicio');
    expect(cobroServicio).toHaveLength(0);
    const devengo = asientos.find((a) => a.origenTipo === 'venta_servicio');
    expect(devengo?.origenTipo).toBe('venta_servicio');
    expect(devengo?.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort())
      .toEqual([['0', '100'], ['100', '0']]);
  });

  it('liquida anticipo USD a valor histórico y registra diferencia FX contra CxC', async () => {
    await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasaIds } } });
    tasaIds.length = 0;
    const rate24 = await prisma.tasaCambio.create({ data: {
      monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24,
      fechaVigencia: new Date(Date.now() - 60_000),
    } });
    tasaIds.push(rate24.tasaId);
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 40, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const rate25 = await prisma.tasaCambio.create({ data: {
      monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 25,
      fechaVigencia: new Date(Date.now() - 1000),
    } });
    tasaIds.push(rate25.tasaId);

    const venta = await createVentaServicioAction({
      servicioId: servicioUsdId, cantidad: 1, condicionPago: 'CREDITO', clienteId,
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
    }, admin);
    expect(venta.success).toBe(true)
    if (!venta.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: {
      tenantId, ventaServicioId: venta.data.ventaServicio.ventaServicioId,
    } });
    expect(cxc.tasaCambio?.toString()).toBe('25');
    expect(cxc.montoDeudaFuncional?.toString()).toBe('2500');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('1000');

    const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({ where: {
      anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION',
    } });
    expect(movimiento.montoConvertido?.toString()).toBe('960');
    const aplicado = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'anticipo_movimiento', origenId: movimiento.movimientoId,
    }, include: { lineas: true } });
    const montos = aplicado.lineas
      .map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort();
    expect(montos).toEqual([['0', '1000'], ['40', '0'], ['960', '0']]);
  });

  it('compras-servicios: devengo bruto GASTO_CREDITO con CxP, sin GASTO_CON_ANTICIPO', async () => {
    const compra = await createCompraServicioAction({
      servicioId,
      cantidad: 1,
      costoUnitario: 100,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PENDIENTE',
      proveedorId,
      anticipos: [{ anticipoId: anticipoPagoId, montoAplicado: 40 }],
    } as never, admin);
    expect(compra.success).toBe(true);
    if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    const compraServicioId = compra.data.compraServicio.compraServicioId;

    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({
      where: { tenantId, compraServicioId },
    });
    expect(cxp.montoDeuda.toString()).toBe('100');
    expect(cxp.montoPagado.toString()).toBe('40');
    expect(cxp.saldoPendiente.toString()).toBe('60');
    expect(cxp.estado).toBe('PARCIAL');

    const asientos = await prisma.asiento.findMany({ where: { tenantId }, include: { lineas: true } });
    const conAnticipo = asientos.filter((a) => a.origenTipo === 'reconciliacion_gasto');
    expect(conAnticipo).toHaveLength(0);
    const gastoCredito = asientos.filter((a) => a.origenTipo === 'compra_servicio' &&
      a.origenId === compraServicioId);
    expect(gastoCredito).toHaveLength(1);
    const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({
      where: {
        anticipoId: anticipoPagoId,
        tipoMovimiento: 'EJECUCION',
        documentoDestinoId: compraServicioId,
      },
    });
    const aplicado = asientos.find((a) => a.origenTipo === 'anticipo_movimiento' &&
      a.origenId === movimiento.movimientoId);
    expect(aplicado).toBeTruthy();
    expect(cxp.compraServicioId).toBe(compraServicioId);

    const [gastosOperativos, cuentasPorPagar, anticiposProveedores] = await Promise.all([
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '6.1' } },
      }),
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '2.1.01' } },
      }),
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '1.2.03' } },
      }),
    ]);
    const asientoDevengo = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'compra_servicio', origenId: compraServicioId },
      include: {
        lineas: {
          include: { cuenta: { select: { codigo: true } } },
          orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }],
        },
      },
    });
    expect(asientoDevengo.createdBy).toBe(admin.userId);
    expect(asientoDevengo.lineas.map((linea) => ({
      cuentaId: linea.cuentaId,
      cuentaCodigo: linea.cuenta.codigo,
      debe: linea.debe.toString(),
      haber: linea.haber.toString(),
      monedaOriginal: linea.monedaOriginal,
      montoOriginal: linea.montoOriginal.toString(),
    }))).toEqual([
      {
        cuentaId: gastosOperativos.cuentaContableId,
        cuentaCodigo: '6.1',
        debe: '100',
        haber: '0',
        monedaOriginal: 'CUP',
        montoOriginal: '100',
      },
      {
        cuentaId: cuentasPorPagar.cuentaContableId,
        cuentaCodigo: '2.1.01',
        debe: '0',
        haber: '100',
        monedaOriginal: 'CUP',
        montoOriginal: '100',
      },
    ]);
    const movimientoPersistido = await prisma.anticipoMovimiento.findUniqueOrThrow({
      where: { movimientoId: movimiento.movimientoId },
    });
    expect(movimientoPersistido.monto.toString()).toBe('40');
    expect(movimientoPersistido.saldoAntes.toString()).toBe('40');
    expect(movimientoPersistido.saldoDespues.toString()).toBe('0');
    const asientoAplicacion = await prisma.asiento.findFirstOrThrow({
      where: {
        tenantId,
        origenTipo: 'anticipo_movimiento',
        origenId: movimiento.movimientoId,
      },
      include: {
        lineas: {
          include: { cuenta: { select: { codigo: true } } },
          orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }],
        },
      },
    });
    expect(asientoAplicacion.createdBy).toBe(admin.userId);
    expect(asientoAplicacion.lineas.map((linea) => ({
      cuentaId: linea.cuentaId,
      cuentaCodigo: linea.cuenta.codigo,
      debe: linea.debe.toString(),
      haber: linea.haber.toString(),
      monedaOriginal: linea.monedaOriginal,
      montoOriginal: linea.montoOriginal.toString(),
    }))).toEqual([
      {
        cuentaId: cuentasPorPagar.cuentaContableId,
        cuentaCodigo: '2.1.01',
        debe: '40',
        haber: '0',
        monedaOriginal: 'CUP',
        montoOriginal: '40',
      },
      {
        cuentaId: anticiposProveedores.cuentaContableId,
        cuentaCodigo: '1.2.03',
        debe: '0',
        haber: '40',
        monedaOriginal: 'CUP',
        montoOriginal: '40',
      },
    ]);

    await prisma.$transaction((tx) => applyPagoGastoWorkflow(tx, {
      tipoGasto: 'servicio',
      referenciaId: compra.data.compraServicio.compraServicioId,
      reconciliadoPor: userId,
      descripcion: 'Pago del saldo luego del anticipo',
      monto: 60,
      moneda: 'CUP',
      tenantId,
      cuentaPorPagarId: cxp.cuentaPorPagarId,
      cuentaId,
      tipoPagoId,
      fechaPago: new Date(),
    }));
    const cxpFinal = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
    });
    expect(cxpFinal.estado).toBe('PAGADA');
    expect(compra.success).toBe(true)
    if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(cxpFinal.montoPagado.toString()).toBe('100');
    const pagosCxp = await prisma.reconciliacionGasto.findMany({ where: {
      tenantId, tipoGasto: 'servicio', referenciaId: compra.data.compraServicio.compraServicioId,
    } });
    expect(pagosCxp).toHaveLength(1);
    expect(pagosCxp[0].monto.toString()).toBe('60');
  });

  it('compras-servicios: revierte todo si falla postEvento del GASTO_CREDITO inicial', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId,
      tipo: 'PAGO',
      contratoId,
      proveedorId,
      monto: 40,
      moneda: 'CUP',
      cuentaOrigenId: cuentaId,
      tipoPagoOrigenId: tipoPagoId,
      usuarioId: userId,
    }));
    const numeroFactura = `${prefix}-initial-gasto-credit-rollback`;
    const trigger = `purchase_service_initial_accrual_${crypto.randomUUID().replaceAll('-', '')}`;

    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW."tenantId" = '${tenantId}'
            AND NEW."origenTipo" = 'compra_servicio'
            AND EXISTS (
              SELECT 1 FROM "CompraServicio" compra
              WHERE compra."compraServicioId" = NEW."origenId"
                AND compra."tenantId" = NEW."tenantId"
                AND compra."numeroFactura" = '${numeroFactura}'
            ) THEN
            RAISE EXCEPTION 'COMPRA_SERVICIO_INITIAL_GASTO_CREDITO_FAILPOINT'
              USING ERRCODE = '22012';
          END IF;
          RETURN NEW;
        END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);

      const snapshotBefore = await capturarSnapshotCompraServicio();
      const rejection = await createCompraServicioAction({
        servicioId,
        cantidad: 1,
        costoUnitario: 100,
        formaPago: 'ANTICIPO_PAGO',
        estado: 'PENDIENTE',
        proveedorId,
        numeroFactura,
        anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
      } as never, admin).then(() => null, (error: unknown) => error);

      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toContain('code: "22012"');
      expect((rejection as Error).message)
        .toContain('COMPRA_SERVICIO_INITIAL_GASTO_CREDITO_FAILPOINT');
      expect(await capturarSnapshotCompraServicio()).toEqual(snapshotBefore);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
  });

  it('si el período está cerrado, la reversión formal aborta toda la eliminación', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const compra = await createCompraServicioAction({
      servicioId,
      cantidad: 1,
      costoUnitario: 100,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PENDIENTE',
      proveedorId,
      numeroFactura: `${prefix}-closed-period-invoice`,
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
    } as never, admin);
    expect(compra.success).toBe(true);
    if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    const compraServicioId = compra.data.compraServicio.compraServicioId;
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: {
      tenantId, compraServicioId,
    } });
    const original = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'compra_servicio', origenId: compraServicioId,
    } });
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    const periodo = await prisma.periodoContable.findFirstOrThrow({ where: {
      tenantId,
      fechaInicio: { lte: new Date() },
      fechaFin: { gte: new Date() },
    } });

    await prisma.periodoContable.update({
      where: { periodoId: periodo.periodoId },
      data: { estado: 'CERRADO' },
    });
    try {
      await expect(deleteCompraServicioAction(compraServicioId, admin))
        .rejects.toMatchObject({ code: 'PERIODO_CERRADO' });
    } finally {
      await prisma.periodoContable.update({
        where: { periodoId: periodo.periodoId },
        data: { estado: 'ABIERTO' },
      });
    }

    expect(await prisma.compraServicio.findUnique({ where: { compraServicioId } }))
      .not.toBeNull();
    expect(await prisma.cuentaPorPagar.findUnique({
      where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
    })).not.toBeNull();
    expect((await prisma.anticipo.findUniqueOrThrow({ where: {
      anticipoId: anticipo.anticipoId,
    } })).saldoDisponible.toString()).toBe('0');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldoAntes);
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'REVERSO_ASIENTO', origenId: original.asientoId,
    } })).toBe(0);
    expect((await prisma.asiento.findUniqueOrThrow({
      where: { asientoId: original.asientoId },
    })).estado).toBe('CONTABILIZADO');
  });

  it('al eliminar un gasto pagado crea reverso para su asiento de reconciliación', async () => {
    const gasto = await prisma.gastosDE.create({ data: {
      tenantId,
      tipo: 'Gasto para reversión formal',
      proveedor: `${prefix}-gasto-provider`,
      estado: 'PENDIENTE',
      monto: 60,
      periodo: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      descripcion: 'Gasto con pago bancario para prueba de asiento inverso',
    } });
    const saldoAntesPago = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    await prisma.$transaction((tx) => applyPagoGastoWorkflow(tx, {
      tipoGasto: 'gastoDE',
      referenciaId: gasto.gastosDEId,
      gastosDEId: gasto.gastosDEId,
      reconciliadoPor: userId,
      descripcion: 'Pago del gasto sujeto a reversión',
      monto: 60,
      moneda: 'CUP',
      tenantId,
      cuentaId,
      tipoPagoId,
      fechaPago: new Date(),
    }));
    const saldoDespuesPago = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    expect(saldoDespuesPago).toBe(saldoAntesPago - 60);
    const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({ where: {
      tenantId, tipoGasto: 'gastoDE', referenciaId: gasto.gastosDEId,
    } });
    const original = await prisma.asiento.findUniqueOrThrow({ where: {
      tenantId_origenTipo_origenId: {
        tenantId, origenTipo: 'reconciliacion_gasto',
        origenId: reconciliacion.reconciliacionId,
      },
    }, include: { lineas: true } });

    await deleteGastosDEAction(gasto.gastosDEId, admin);

    const anulado = await prisma.asiento.findUniqueOrThrow({
      where: { asientoId: original.asientoId },
    });
    expect(anulado.estado).toBe('ANULADO');
    expect(anulado.revertidoPorId).toBeTruthy();
    const reverso = await prisma.asiento.findUniqueOrThrow({
      where: { asientoId: anulado.revertidoPorId! },
      include: { lineas: true },
    });
    expect(reverso.origenTipo).toBe('REVERSO_ASIENTO');
    expect(reverso.origenId).toBe(original.asientoId);
    expect(reverso.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]))
      .toEqual(original.lineas.map((linea) => [linea.haber.toString(), linea.debe.toString()]));
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldoAntesPago);
    expect(await prisma.gastosDE.findUnique({ where: { gastosDEId: gasto.gastosDEId } }))
      .toBeNull();
  });

  it('al eliminar servicio revierte y enlaza todos los asientos formales del documento', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const compra = await createCompraServicioAction({
      servicioId,
      cantidad: 1,
      costoUnitario: 100,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PENDIENTE',
      proveedorId,
      numeroFactura: `${prefix}-reverse-invoice`,
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
    } as never, admin);
    expect(compra.success).toBe(true);
    if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    const compraServicioId = compra.data.compraServicio.compraServicioId;
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: {
      tenantId, compraServicioId,
    } });
    await prisma.$transaction((tx) => applyPagoGastoWorkflow(tx, {
      tipoGasto: 'servicio',
      referenciaId: compraServicioId,
      reconciliadoPor: userId,
      descripcion: 'Pago antes de reversión formal',
      monto: 60,
      moneda: 'CUP',
      tenantId,
      cuentaPorPagarId: cxp.cuentaPorPagarId,
      cuentaId,
      tipoPagoId,
      fechaPago: new Date(),
    }));

    const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({ where: {
      anticipoId: anticipo.anticipoId,
      documentoDestinoId: compraServicioId,
      tipoMovimiento: 'EJECUCION',
    } });
    const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({ where: {
      tenantId, tipoGasto: 'servicio', referenciaId: compraServicioId,
    } });
    const origenes = [
      { origenTipo: 'compra_servicio', origenId: compraServicioId },
      { origenTipo: 'anticipo_movimiento', origenId: movimiento.movimientoId },
      { origenTipo: 'reconciliacion_gasto', origenId: reconciliacion.reconciliacionId },
    ];
    const originales = await prisma.asiento.findMany({
      where: { tenantId, OR: origenes },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    expect(originales).toHaveLength(3);
    const saldoAntesDeBorrar = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;

    await deleteCompraServicioAction(compraServicioId, admin);

    const asientosFinales = await prisma.asiento.findMany({
      where: { tenantId },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    for (const original of originales) {
      const anulado = asientosFinales.find((asiento) => asiento.asientoId === original.asientoId);
      expect(anulado?.estado).toBe('ANULADO');
      expect(anulado?.revertidoPorId).toBeTruthy();
      const reverso = asientosFinales.find((asiento) =>
        asiento.asientoId === anulado?.revertidoPorId,
      );
      expect(reverso).toMatchObject({
        tenantId,
        estado: 'CONTABILIZADO',
        origenTipo: 'REVERSO_ASIENTO',
        origenId: original.asientoId,
      });
      expect(reverso?.lineas).toHaveLength(original.lineas.length);
      expect(reverso?.lineas.map((linea) => ({
        cuentaId: linea.cuentaId,
        debe: linea.debe.toString(),
        haber: linea.haber.toString(),
        monedaOriginal: linea.monedaOriginal,
        montoOriginal: linea.montoOriginal.toString(),
        tasaCambio: linea.tasaCambio?.toString() ?? null,
        fxEvidenceFingerprint: linea.fxEvidenceFingerprint,
      }))).toEqual(original.lineas.map((linea) => ({
        cuentaId: linea.cuentaId,
        debe: linea.haber.toString(),
        haber: linea.debe.toString(),
        monedaOriginal: linea.monedaOriginal,
        montoOriginal: linea.montoOriginal.toString(),
        tasaCambio: linea.tasaCambio?.toString() ?? null,
        fxEvidenceFingerprint: linea.fxEvidenceFingerprint,
      })));
    }
    await prisma.$transaction((tx) => reverseFormalEntries(tx, {
      tenantId, userId,
    }, origenes.map((o) => ({ tipo: o.origenTipo, id: o.origenId }))));
    expect(await prisma.asiento.count({ where: {
      tenantId, origenTipo: 'REVERSO_ASIENTO', origenId: { in: originales.map((a) => a.asientoId) },
    } })).toBe(originales.length);
    expect((await verificarCadenaAsientos(tenantId)).integro).toBe(true);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldoAntesDeBorrar + 60);
    expect(await prisma.cuentaPorPagar.findUnique({ where: {
      cuentaPorPagarId: cxp.cuentaPorPagarId,
    } })).toBeNull();
    expect((await prisma.anticipo.findUniqueOrThrow({ where: {
      anticipoId: anticipo.anticipoId,
    } })).saldoDisponible.toString()).toBe('40');
  });

  it('liquida anticipo proveedor al valor histórico con diferencia FX contra CxP', async () => {
    await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasaIds } } });
    tasaIds.length = 0;
    const rate24 = await prisma.tasaCambio.create({ data: {
      monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24,
      fechaVigencia: new Date(Date.now() - 60_000),
    } });
    tasaIds.push(rate24.tasaId);
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 40, moneda: 'USD',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const rate25 = await prisma.tasaCambio.create({ data: {
      monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 25,
      fechaVigencia: new Date(Date.now() - 1000),
    } });
    tasaIds.push(rate25.tasaId);

    const compra = await createCompraServicioAction({
      servicioId: servicioUsdId,
      cantidad: 1,
      costoUnitario: 100,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PENDIENTE',
      proveedorId,
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
    } as never, admin);
    expect(compra.success).toBe(true)
    if (!compra.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: {
      tenantId, compraServicioId: compra.data.compraServicio.compraServicioId,
    } });
    expect(cxp.montoDeuda.toString()).toBe('100');
    expect(cxp.montoPagado.toString()).toBe('40');
    expect(cxp.fxSnapshot).toMatchObject({
      originalCurrency: 'USD', functionalCurrency: 'CUP', functionalAmount: '2500',
    });
    const movimiento = await prisma.anticipoMovimiento.findFirstOrThrow({ where: {
      anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION',
    } });
    expect(movimiento.montoConvertido?.toString()).toBe('960');
    const asiento = await prisma.asiento.findFirstOrThrow({ where: {
      tenantId, origenTipo: 'anticipo_movimiento', origenId: movimiento.movimientoId,
    }, include: { lineas: true } });
    const montos = asiento.lineas.map((linea) => [linea.debe.toString(), linea.haber.toString()]).sort();
    expect(montos).toEqual([['0', '40'], ['0', '960'], ['1000', '0']]);
  });

  it('cobra el remanente sin tratar el anticipo como otro ingreso bancario', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId },
    })).saldo;
    const venta = await createVentaServicioAction({
      servicioId, cantidad: 1, condicionPago: 'CREDITO', clienteId,
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
    }, admin);
    expect(venta.success).toBe(true)
    if (!venta.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldoAntes);
    const result = await AccountingReconciliationService.reconcileService({
      input: { ventaServicioId: venta.data.ventaServicio.ventaServicioId,
        idempotencyKey: `advance-remainder-${crypto.randomUUID()}`,
        distribuciones: [{ cuentaId, tipoPagoId, monto: 60, moneda: 'CUP' }] },
      user: admin,
    });
    expect(venta.success).toBe(true)
    if (!venta.success) expect.unreachable('Se esperaba que la accion tuviera exito')
    expect(result.reconciliado).toBe(true);
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: {
      tenantId, ventaServicioId: venta.data.ventaServicio.ventaServicioId,
    } });
    expect(cxc.montoPagado.toString()).toBe('100');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('100');
    expect(cxc.estado).toBe('PAGADA');
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
      .toBe(saldoAntes + 60);
  });

  it('un fallo SQL en el devengo revierte documento, obligación y aplicación', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'COBRO', contratoId, clienteId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const trigger = `advance_accrual_${crypto.randomUUID().replaceAll('-', '')}`;
    const before = await prisma.ventaServicios.count({ where: { tenantId } });
    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'venta_servicio' THEN
          RAISE EXCEPTION 'devengo SQL rechazado' USING ERRCODE = '22012';
        END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
      await expect(createVentaServicioAction({
        servicioId, cantidad: 1, condicionPago: 'CREDITO', clienteId,
        anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
      }, admin)).rejects.toThrow('devengo SQL rechazado');
      expect(await prisma.ventaServicios.count({ where: { tenantId } })).toBe(before);
      expect((await prisma.anticipo.findUniqueOrThrow({
        where: { anticipoId: anticipo.anticipoId },
      })).saldoDisponible.toString()).toBe('40');
      expect(await prisma.anticipoMovimiento.count({ where: {
        anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION',
      } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
  });

  it('un fallo SQL en la aplicación revierte devengo bruto, CxP y anticipo', async () => {
    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tenantId, tipo: 'PAGO', contratoId, proveedorId, monto: 40, moneda: 'CUP',
      cuentaOrigenId: cuentaId, tipoPagoOrigenId: tipoPagoId, usuarioId: userId,
    }));
    const trigger = `advance_apply_${crypto.randomUUID().replaceAll('-', '')}`;
    const comprasAntes = await prisma.compraServicio.count({ where: { tenantId } });
    const cxpAntes = await prisma.cuentaPorPagar.count({ where: { tenantId } });
    try {
      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'anticipo_movimiento' THEN
          RAISE EXCEPTION 'aplicación SQL rechazada' USING ERRCODE = '22012';
        END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
      await expect(createCompraServicioAction({
        servicioId, cantidad: 1, costoUnitario: 100, formaPago: 'ANTICIPO_PAGO',
        estado: 'PENDIENTE', proveedorId,
        anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 40 }],
      } as never, admin)).rejects.toThrow('aplicación SQL rechazada');
      expect(await prisma.compraServicio.count({ where: { tenantId } })).toBe(comprasAntes);
      expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(cxpAntes);
      expect((await prisma.anticipo.findUniqueOrThrow({
        where: { anticipoId: anticipo.anticipoId },
      })).saldoDisponible.toString()).toBe('40');
      expect(await prisma.anticipoMovimiento.count({
        where: { anticipoId: anticipo.anticipoId, tipoMovimiento: 'EJECUCION' },
      })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
  });
});
