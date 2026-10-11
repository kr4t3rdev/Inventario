/**
 * @description R6 #31: variantes de egreso por actions y handlers con sesión real.
 * Auth action controlada; schemas/wrappers, períodos, writer, posting y auditoría reales.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/secrets';
import {
  seedPlanContable, seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST as webPost } from '@/app/api/contabilidad/reconciliacion/gastos/route';
import { POST as mobilePost } from '@/app/api/mobile/v1/accounting/reconciliation/expenses/route';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const { reconciliarGastoAction } = await import('@/features/contabilidad/actions-reconciliacion');
const { createCompraProductoAction } = await import('@/features/compras-productos/actions');

type Source = 'salario' | 'gastoDE' | 'compra' | 'servicio' | 'venta_servicio';
type Channel = 'action' | 'web' | 'mobile';
interface Scenario {
  source: Source;
  channel: Channel;
  payable?: boolean;
  amount?: number;
}
interface Expense {
  referenceId: string;
  ids: { pgId?: string; gastosDEId?: string; gastoCompraId?: string;
    compraServicioId?: string; ventaServicioId?: string };
  payableId?: string;
}
const prefix = `r6-egreso-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let token = '';
let accountId = '';
let secondAccountId = '';
let paymentTypeId = '';
let employeeId = '';
let vendorId = '';
let productId = '';
let serviceId = '';
let planId = '';
let triggerName = '';
let triggerTable = '';

/** @description Snapshot de filas completas del fixture. @returns Estado determinista. */
async function snapshot(): Promise<string> {
  const rows = await Promise.all([
    prisma.cuentaBancaria.findMany({ where: { tenantId }, orderBy: { cuentaId: 'asc' } }),
    prisma.pagosalario.findMany({ where: { tenantId }, orderBy: { pgId: 'asc' } }),
    prisma.gastosDE.findMany({ where: { tenantId }, orderBy: { gastosDEId: 'asc' } }),
    prisma.gastoCompra.findMany({ where: { tenantId }, orderBy: { gastoCompraId: 'asc' } }),
    prisma.compraProducto.findMany({ where: { tenantId }, orderBy: { compraProductoId: 'asc' } }),
    prisma.compraServicio.findMany({ where: { tenantId }, orderBy: { compraServicioId: 'asc' } }),
    prisma.ventaServicios.findMany({ where: { tenantId }, orderBy: { ventaServicioId: 'asc' } }),
    prisma.cuentaPorPagar.findMany({ where: { tenantId }, orderBy: { cuentaPorPagarId: 'asc' } }),
    prisma.pagoCuentaPorPagar.findMany({ where: { tenantId },
      orderBy: { pagoCuentaPorPagarId: 'asc' } }),
    prisma.reconciliacionGasto.findMany({ where: { tenantId },
      orderBy: { reconciliacionId: 'asc' } }),
    prisma.asiento.findMany({ where: { tenantId }, orderBy: { asientoId: 'asc' },
      include: { lineas: { orderBy: { lineaId: 'asc' } } } }),
    prisma.auditLog.findMany({ where: { usuarioId: userId }, orderBy: { id: 'asc' } }),
    prisma.shadowPosteoOutbox.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.transaccionMoneda.findMany({ where: { tenantId },
      orderBy: { transaccionId: 'asc' } }),
    prisma.compraDocumento.findMany({ where: { tenantId },
      orderBy: { compraDocumentoId: 'asc' } }),
    prisma.compraDocumentoItem.findMany({ where: { tenantId },
      orderBy: { compraDocumentoItemId: 'asc' } }),
    prisma.producto.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.productoCostHistory.findMany({ where: { productoId: productId },
      orderBy: { id: 'asc' } }),
    prisma.stockUbicacion.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.stockMoveLine.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify(rows, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value);
}

/** @description Crea una fuente nueva por caso. @param scenario Variante. @returns Referencias. */
async function createExpense(scenario: Scenario): Promise<Expense> {
  const { source, payable } = scenario;
  const amount = 120;
  let expense: Expense;
  if (source === 'salario') {
    const row = await prisma.pagosalario.create({ data: {
      tenantId, empleadoId: employeeId, salario: amount, periodo: '2026-10',
    } });
    expense = { referenceId: row.pgId, ids: { pgId: row.pgId } };
  } else if (source === 'gastoDE') {
    const row = await prisma.gastosDE.create({ data: {
      gastosDEId: `r6-${crypto.randomUUID()}`, tenantId, proveedor: prefix,
      monto: amount, periodo: '2026-10',
    } });
    expense = { referenceId: row.gastosDEId, ids: { gastosDEId: row.gastosDEId } };
  } else if (source === 'compra') {
    const row = await prisma.gastoCompra.create({ data: {
      tenantId, productoId: productId, vendorId, cantidad: 1, precioUnitario: amount, total: amount,
    } });
    expense = { referenceId: row.gastoCompraId, ids: { gastoCompraId: row.gastoCompraId } };
  } else if (source === 'servicio') {
    const row = await prisma.compraServicio.create({ data: {
      tenantId, servicioId: serviceId, proveedorId: vendorId, costoUnitario: amount,
      cantidad: 1, total: amount, formaPago: 'CREDITO', estado: 'PENDIENTE',
    } });
    expense = { referenceId: row.compraServicioId,
      ids: { compraServicioId: row.compraServicioId } };
  } else {
    const row = await prisma.ventaServicios.create({ data: {
      tenantId, servicioId: serviceId, cantidad: 1, total: amount,
    } });
    expense = { referenceId: row.ventaServicioId, ids: { ventaServicioId: row.ventaServicioId } };
  }
  if (payable) {
    const row = await prisma.cuentaPorPagar.create({ data: {
      tenantId, numeroFactura: `r6-${crypto.randomUUID()}`, proveedorId: vendorId,
      montoDeuda: amount, saldoPendiente: amount, tipo: source === 'compra' ? 'compra' : 'servicio',
      gastosDEId: expense.ids.gastosDEId, gastoCompraId: expense.ids.gastoCompraId,
      compraServicioId: expense.ids.compraServicioId,
      tipoDeuda: source === 'venta_servicio' ? 'VENTA_SERVICIO' : undefined,
    } });
    expense.payableId = row.cuentaPorPagarId;
    if (source === 'compra') {
      await prisma.compraProducto.create({ data: {
        tenantId, productoId: productId, proveedorId: vendorId,
        numeroFactura: row.numeroFactura, facturaUrl: '', cantidad: 1,
        precioUnitario: amount, total: amount, gastoCompraId: expense.ids.gastoCompraId,
        cuentaPorPagarId: row.cuentaPorPagarId, formaPago: 'CREDITO', estado: 'PENDIENTE',
      } });
    }
  }
  return expense;
}

/** @description Invoca el adapter real. @param scenario Variante. @param expense Fuente.
 * @returns Resultado uniforme, sin sustituir la lógica transaccional. */
async function send(scenario: Scenario, expense: Expense) {
  const amount = scenario.amount ?? 120;
  const input = {
    ...expense.ids, cuentaId: accountId, tipoPagoId: paymentTypeId, monto: amount,
    moneda: 'CUP', descripcion: prefix, fechaReconciliacion: new Date().toISOString(),
    cuentaPorPagarId: expense.payableId,
    distribucion: [ { cuentaId: accountId, monto: amount / 2 },
      { cuentaId: secondAccountId, monto: amount / 2 } ],
  };
  if (scenario.channel === 'action') {
    const result = await reconciliarGastoAction(input);
    return { success: result.success, body: result.success ? result.data : result.error };
  }
  const url = scenario.channel === 'web'
    ? 'http://localhost/api/contabilidad/reconciliacion/gastos'
    : 'http://localhost/api/mobile/v1/accounting/reconciliation/expenses';
  const request = new NextRequest(url, { method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, tipoGasto: scenario.source,
      referenciaId: expense.referenceId }),
  });
  const response = await (scenario.channel === 'web' ? webPost : mobilePost)(request);
  const body = await response.json();
  return { success: response.ok, body: scenario.channel === 'mobile' && response.ok
    ? body.data : body };
}

/** @description Retira trigger y función temporales. @returns Limpieza del failpoint. */
async function removeFailpoint(): Promise<void> {
  if (!triggerName) return;
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${triggerTable}"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerName}"()`);
  triggerName = '';
}

/** @description Instala fallo real tras posting o tras débito/CxP. @param expense Fuente.
 * @param late Si exige modificaciones CxP/banco previas. @param amount Importe de pago.
 * @returns Failpoint instalado. */
async function installFailpoint(expense: Expense, late: boolean, amount: number): Promise<void> {
  const balances = await prisma.cuentaBancaria.findMany({ where: {
    cuentaId: { in: [accountId, secondAccountId] } } });
  const balanceProof = balances.map((row) => `NOT EXISTS (
    SELECT 1 FROM "CuentaBancaria" b WHERE b."cuentaId" = '${row.cuentaId}'
      AND b."saldo" = ${row.saldo - amount / 2})`).join(' OR ');
  triggerName = `r6_egreso_${crypto.randomUUID().replaceAll('-', '')}`;
  triggerTable = late ? 'PagoCuentaPorPagar' : 'AuditLog';
  const predicate = late
    ? `NEW."cuentaPorPagarId" = '${expense.payableId}'`
    : `NEW."usuarioId" = '${userId}' AND NEW."entidad" = 'RECONCILIACION'
      ${expense.referenceId ? `AND NEW."detalles"->>'referenciaId' = '${expense.referenceId}'
        AND NEW."detalles"->>'cuentaId' = '${secondAccountId}'` : ''}`;
  const proof = late
    ? `IF NOT EXISTS (SELECT 1 FROM "CuentaPorPagar" c WHERE
        c."cuentaPorPagarId" = NEW."cuentaPorPagarId" AND c."montoPagado" = ${amount})
       OR ${balanceProof}
       OR (SELECT count(*) FROM "AuditLog" l WHERE l."usuarioId" = '${userId}'
        AND l."detalles"->>'referenciaId' = '${expense.referenceId}') <> 2 THEN
        RAISE EXCEPTION 'R6_EGRESO_BEFORE_CXP' USING ERRCODE = '22023'; END IF;`
    : `IF NOT EXISTS (SELECT 1 FROM "asientos" a WHERE a."tenantId" = '${tenantId}'
        AND a."origenTipo" = 'reconciliacion_gasto' AND a."origenId" = NEW."entidadId")
       ${expense.referenceId ? `OR (SELECT count(*) FROM "AuditLog" l
        WHERE l."usuarioId" = '${userId}'
          AND l."detalles"->>'referenciaId' = '${expense.referenceId}') <> 1` : ''} THEN
        RAISE EXCEPTION 'R6_EGRESO_BEFORE_POSTING' USING ERRCODE = '22023'; END IF;`;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${triggerName}"() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN IF ${predicate} THEN ${proof}
      RAISE EXCEPTION 'R6_EGRESO_${late ? 'CXP' : 'AUDIT'}_FAILPOINT' USING ERRCODE = '22012';
      END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT
    ON "${triggerTable}" FOR EACH ROW EXECUTE FUNCTION "${triggerName}"()`);
}

const channels: Channel[] = ['action', 'web', 'mobile'];
const directScenarios: Scenario[] = channels.flatMap((channel) =>
  (['salario', 'gastoDE', 'compra'] as const).map((source) => ({ channel, source })));
const payableScenarios: Scenario[] = channels.flatMap((channel) =>
  (['gastoDE', 'compra'] as const).flatMap((source) =>
    [40, 120].map((amount) => ({ channel, source, payable: true, amount }))));

describe('R6 #31 — pago de gastos por variante y adapter', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
    vi.stubEnv('PERIODO_CONTABLE_MODE', 'enforce');
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'true');
    const target = new URL(process.env.DATABASE_URL_TEST!);
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port`;
    expect(identity[0]).toEqual({ db: target.pathname.slice(1), port: Number(target.port) });
    tenantId = (await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } })).tenantId;
    const user = await prisma.user.create({ data: {
      name: prefix, email: `${prefix}@test.local`, password: 'fixture',
    } });
    userId = user.userId;
    const features = { contabilidad: true, 'contabilidad-formal': true, compras: true };
    planId = (await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365, features,
    } })).planId;
    await prisma.tenantMembership.create({ data: { tenantId, userId, tenantRole: 'manager' } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId, activa: true, expiracion: new Date('2099-01-01'),
    } });
    auth.user = { userId, tenantId, name: prefix, email: user.email, role: 'regularUser',
      isActive: true, tenantRole: 'manager', planFeatures: features };
    token = jwt.sign({ userId, tenantId, email: user.email }, getJwtSecret());
    await prisma.userSession.create({ data: {
      userId, token, expiresAt: new Date(Date.now() + 3600_000),
    } });
    for (const suffix of ['one', 'two']) {
      const row = await prisma.cuentaBancaria.create({ data: { tenantId,
        nombreBanco: `${prefix}-${suffix}`, numeroCuenta: `${prefix}-${suffix}`,
        tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 10000 } });
      if (suffix === 'one') accountId = row.cuentaId;
      else secondAccountId = row.cuentaId;
    }
    paymentTypeId = (await prisma.tipoPago.create({ data: {
      tenantId, nombre: prefix, cuentaDefecto: accountId,
    } })).tipoId;
    employeeId = (await prisma.empleado.create({ data: {
      tenantId, nombre: prefix, apellido: 'Prueba', cargo: 'Prueba', salarioBases: 120,
      fechaContratacion: new Date(),
    } })).empleadoId;
    vendorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    const category = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    const warehouse = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    productId = (await prisma.producto.create({ data: {
      tenantId, nombre: prefix, precioCosto: 120, precioVenta: 150, stock: 1,
      categoriaId: category.catId, almacenId: warehouse.almacenId,
    } })).id;
    serviceId = (await prisma.servicios.create({ data: {
      tenantId, nombre: prefix, precio: 120, descripcion: prefix,
    } })).servicioId;
    await prisma.tenantAccountingPolicy.create({ data: {
      tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId,
    } });
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
  });

  afterAll(async () => {
    await removeFailpoint();
    vi.unstubAllEnvs();
    auth.user = null;
    if (!tenantId) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
    await prisma.pagoCuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.compraProducto.deleteMany({ where: { tenantId } });
    await prisma.compraDocumentoItem.deleteMany({ where: { tenantId } });
    await prisma.compraDocumento.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.pagosalario.deleteMany({ where: { tenantId } });
    await prisma.empleado.deleteMany({ where: { tenantId } });
    await prisma.gastosDE.deleteMany({ where: { tenantId } });
    await prisma.gastoCompra.deleteMany({ where: { tenantId } });
    await prisma.compraServicio.deleteMany({ where: { tenantId } });
    await prisma.ventaServicios.deleteMany({ where: { tenantId } });
    await prisma.servicios.deleteMany({ where: { tenantId } });
    // Kardex es inmutable en producción. Solo en esta DB desechable, SET LOCAL
    // omite el trigger durante la eliminación del fixture y se revierte al salir de tx.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
      await tx.stockMoveLine.deleteMany({ where: { tenantId } });
    });
    await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.transaccionMoneda.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.plan.deleteMany({ where: { planId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  it.each([...directScenarios, ...payableScenarios,
    { channel: 'action' as const, source: 'servicio' as const, payable: true, amount: 120 },
    { channel: 'action' as const, source: 'venta_servicio' as const, payable: true, amount: 120 },
  ])('$channel $source CxP=$payable monto=$amount: rollback físico y retry confirmado',
    async (scenario) => {
      const expense = await createExpense(scenario);
      const before = await snapshot();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await installFailpoint(expense, !!scenario.payable, scenario.amount ?? 120);
        const result = await send(scenario, expense);
        expect(result.success, JSON.stringify(result.body)).toBe(false);
        const evidence = `${JSON.stringify(result.body)} ${errors.mock.calls.map((args) =>
          args.map((value: unknown) => value instanceof Error
            ? `${value.message} ${JSON.stringify(value)}` : JSON.stringify(value)).join(' '))}`;
        expect(evidence).toContain(`R6_EGRESO_${scenario.payable ? 'CXP' : 'AUDIT'}_FAILPOINT`);
        expect(evidence).toContain('22012');
        expect(evidence).not.toContain('R6_EGRESO_BEFORE_');
        expect(await snapshot()).toBe(before);
      } finally {
        errors.mockRestore();
        await removeFailpoint();
      }
      const balancesBefore = await prisma.cuentaBancaria.findMany({ where: {
        cuentaId: { in: [accountId, secondAccountId] } }, orderBy: { cuentaId: 'asc' } });
      const result = await send(scenario, expense);
      expect(result.success, JSON.stringify(result.body)).toBe(true);
      const amount = scenario.amount ?? 120;
      const recs = await prisma.reconciliacionGasto.findMany({ where: {
        tenantId, referenciaId: expense.referenceId } });
      expect(recs).toHaveLength(2);
      for (const rec of recs) {
        expect(rec.monto.toString()).toBe(String(amount / 2));
        const entry = await prisma.asiento.findFirstOrThrow({ where: {
          tenantId, origenTipo: 'reconciliacion_gasto', origenId: rec.reconciliacionId,
        }, include: { lineas: true } });
        expect(entry.lineas).toHaveLength(2);
        expect(entry.lineas.reduce((sum, line) => sum + Number(line.debe), 0))
          .toBe(amount / 2);
        expect(entry.lineas.reduce((sum, line) => sum + Number(line.haber), 0))
          .toBe(amount / 2);
        expect(await prisma.auditLog.count({ where: {
          usuarioId: userId, entidad: 'RECONCILIACION', entidadId: rec.reconciliacionId,
        } })).toBe(1);
      }
      const after = await prisma.cuentaBancaria.findMany({ where: {
        cuentaId: { in: [accountId, secondAccountId] } }, orderBy: { cuentaId: 'asc' } });
      after.forEach((row, i) => expect(row.saldo.toString()).toBe(
        String(balancesBefore[i].saldo - amount / 2)));
      if (expense.payableId) {
        const payable = await prisma.cuentaPorPagar.findUniqueOrThrow({ where: {
          cuentaPorPagarId: expense.payableId } });
        expect(payable.montoPagado.toString()).toBe(String(amount));
        expect(payable.saldoPendiente.toString()).toBe(String(120 - amount));
        expect(payable.estado).toBe(amount === 120 ? 'PAGADA' : 'PARCIAL');
        expect(await prisma.pagoCuentaPorPagar.count({ where: {
          cuentaPorPagarId: expense.payableId } })).toBe(1);
        if (scenario.source === 'compra') {
          const purchase = await prisma.compraProducto.findFirstOrThrow({ where: {
            cuentaPorPagarId: expense.payableId } });
          expect(purchase.estado).toBe(amount === 120 ? 'PAGADA' : 'PENDIENTE');
        }
      }
      if (expense.ids.gastosDEId) {
        const source = await prisma.gastosDE.findUniqueOrThrow({ where: {
          gastosDEId: expense.ids.gastosDEId } });
        if (!scenario.payable || amount === 120) expect(source.isPagado).toBe('pagado');
        else expect(source.isPagado).not.toBe('pagado');
      }
    });

  it('caller de alta compra PAGO_COMPLETO revierte también documento, stock y costo', async () => {
    const input = {
      proveedorId: vendorId, numeroFactura: `r6-${crypto.randomUUID()}`, facturaUrl: '',
      formaPago: 'PAGO_COMPLETO' as const, estado: 'PAGADA' as const,
      cuentaId: accountId, tipoPagoId: paymentTypeId, moneda: 'CUP' as const,
      items: [{ productoId: productId, cantidad: 2, precioCosto: 150 }],
    };
    const before = await snapshot();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await installFailpoint({ referenceId: '', ids: {} }, false, 300);
      const failed = await createCompraProductoAction(input);
      expect(failed.success, JSON.stringify(failed)).toBe(false);
      const evidence = `${JSON.stringify(failed)} ${errors.mock.calls.map((args) =>
        args.map((value: unknown) => value instanceof Error
          ? `${value.message} ${JSON.stringify(value)}` : JSON.stringify(value)).join(' '))}`;
      expect(evidence).toContain('R6_EGRESO_AUDIT_FAILPOINT');
      expect(evidence).toContain('22012');
      expect(evidence).not.toContain('R6_EGRESO_BEFORE_');
      expect(await snapshot()).toBe(before);
    } finally {
      errors.mockRestore();
      await removeFailpoint();
    }
    const bankBefore = await prisma.cuentaBancaria.findUniqueOrThrow({ where: {
      cuentaId: accountId } });
    const success = await createCompraProductoAction(input);
    expect(success.success, JSON.stringify(success)).toBe(true);
    const purchase = await prisma.compraDocumento.findFirstOrThrow({ where: {
      tenantId, numeroFactura: input.numeroFactura }, include: { items: true } });
    expect(purchase.items).toHaveLength(1);
    expect(purchase.items[0].cantidad).toBe(2);
    expect(await prisma.stockMoveLine.count({ where: {
      tenantId, origenId: purchase.compraDocumentoId } })).toBe(1);
    const bankAfter = await prisma.cuentaBancaria.findUniqueOrThrow({ where: {
      cuentaId: accountId } });
    expect(bankAfter.saldo).toBe(bankBefore.saldo - 300);
  });
});
