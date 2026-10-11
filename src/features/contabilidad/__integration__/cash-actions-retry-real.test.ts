/**
 * @description Reintento en Server Actions de cash (G5): `registrarPagoPrestamoAction`
 * y `registrarPagoDeudaAction` delegan al servicio canónico; el reintento de un pago
 * ya completado no duplica la reconciliación.
 *
 * Los actions son wrappers delgados (auth + validación + servicio). Se mockea
 * `getCurrentUser` para proveer el usuario de prueba; el resto del flujo
 * (servicio, Prisma, asientos) corre contra PostgreSQL real.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-actions-retry-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let clienteId = '';
let proveedorId = '';
let cuentaOrigenId = '';
let cuentaPagoId = '';
let tipoPagoId = '';

const mockAuth = vi.hoisted(() => ({ userId: '', tenantId: '' }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => ({
    userId: mockAuth.userId, tenantId: mockAuth.tenantId, tenantRole: 'manager',
    planFeatures: { 'prestamos-cash': true, 'deudas-cash': true },
  }),
}));

const { registrarPagoPrestamoAction } = await import('@/features/contabilidad/actions-prestamos-cash');
const { registrarPagoDeudaAction } = await import('@/features/contabilidad/actions-deudas-cash');

type NormalizedCashPaymentSnapshot = {
  account: { saldo: string };
  entries: Array<{
    origenId: string;
    lineas: Array<{ debe: string; haber: string }>;
  }>;
};

async function cashPaymentSnapshot({
  kind,
  operationId,
  obligationId,
  accountId,
}: {
  kind: 'loan' | 'debt';
  operationId: string;
  obligationId: string;
  accountId: string;
}) {
  const relation = kind === 'loan' ? { prestamoCashId: operationId } : { deudaCashId: operationId };
  const reconciliations = await prisma.reconciliacionVenta.findMany({
    where: { tenantId, ...relation },
    orderBy: { reconciliacionId: 'asc' },
  });
  const reconciliationIds = reconciliations.map((row) => row.reconciliacionId);
  const [account, receivable, payable, operation, entries, auditLogs] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: accountId },
    }),
    prisma.cuentaPorCobrar.findUnique({ where: { id: obligationId } }),
    prisma.cuentaPorPagar.findUnique({ where: { cuentaPorPagarId: obligationId } }),
    kind === 'loan'
      ? prisma.prestamoCash.findFirst({ where: { id: operationId, tenantId } })
      : prisma.deudaCash.findFirst({ where: { id: operationId, tenantId } }),
    prisma.asiento.findMany({
      where: {
        tenantId,
        origenTipo: 'reconciliacion_venta',
        origenId: { in: reconciliationIds },
      },
      include: { lineas: { orderBy: { lineaId: 'asc' } } },
      orderBy: { asientoId: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { entidadId: { in: reconciliationIds } },
      orderBy: { id: 'asc' },
    }),
  ]);
  return JSON.parse(JSON.stringify({
    reconciliations,
    account,
    receivable,
    payable,
    operation,
    entries,
    auditLogs,
  }, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value)) as
    NormalizedCashPaymentSnapshot;
}

function expectPostedFunctionalAmount(snapshot: Awaited<ReturnType<typeof cashPaymentSnapshot>>, id: string) {
  const entry = snapshot.entries.find((row) => row.origenId === id);
  expect(entry).toBeDefined();
  const debitTotal = entry!.lineas.reduce((total, line) => total + Number(line.debe), 0);
  const creditTotal = entry!.lineas.reduce((total, line) => total + Number(line.haber), 0);
  expect(debitTotal).toBeCloseTo(3.69, 10);
  expect(creditTotal).toBeCloseTo(3.69, 10);
}

describe('server actions cash — reintento no duplica (G5)', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: process.env.DATABASE_URL_TEST?.split('/').pop(),
    });

    const tenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-t`, slug: `${prefix}-t` },
    });
    tenantId = tenant.tenantId;
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.cu`, password: 'x' },
    });
    userId = user.userId;
    mockAuth.userId = userId;
    mockAuth.tenantId = tenantId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    const plan = await prisma.plan.create({
      data: {
        nombre: `${prefix}-plan`,
        duracionDias: 365,
        features: {
          'contabilidad-formal': true,
          'prestamos-cash': true,
          'deudas-cash': true,
        },
      },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
    });
    const cliente = await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cli` },
    });
    clienteId = cliente.clienteId;
    proveedorId = (await prisma.vendor.create({
      data: { tenantId, nombre: `${prefix}-prov` },
    })).vendorId;
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
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
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
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS dummy ON "asientos"`,
    ).catch(() => undefined);
  });

  it('registrarPagoPrestamoAction: reintento tras pago total no duplica', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    });

    const primera = await registrarPagoPrestamoAction({
      id: loan.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(primera.success).toBe(true);

    const reintento = await registrarPagoPrestamoAction({
      id: loan.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(reintento.success).toBe(false);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    })).toBe(recsAntes + 1);
  });

  it('registrarPagoDeudaAction: reintento tras pago total no duplica', async () => {
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deuda.id },
    });

    const primera = await registrarPagoDeudaAction({
      id: deuda.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(primera.success).toBe(true);

    const reintento = await registrarPagoDeudaAction({
      id: deuda.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(reintento.success).toBe(false);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deuda.id },
    })).toBe(recsAntes + 1);
  });

  it('registrarPagoPrestamoAction: replay idempotente conserva un pago parcial', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const key = `loan-partial-${crypto.randomUUID()}`;
    const primera = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(primera.success).toBe(true);

    const segunda = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(segunda.success).toBe(true);

    const cxc = await prisma.cuentaPorCobrar.findUnique({
      where: { id: loan.cuentaPorCobrarId },
      select: { montoPagado: true },
    });
    expect(cxc?.montoPagado?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: loan.id },
    })).toBe(1);

    const conflicto = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0223, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(conflicto.success).toBe(false);
    if (conflicto.success) expect.unreachable('Se esperaba conflicto de idempotencia');
    expect(conflicto.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('registrarPagoDeudaAction: replay idempotente conserva un pago parcial', async () => {
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const key = `debt-partial-${crypto.randomUUID()}`;
    const primera = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(primera.success).toBe(true);

    const segunda = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(segunda.success).toBe(true);

    const cxp = await prisma.cuentaPorPagar.findUnique({
      where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
      select: { montoPagado: true },
    });
    expect(cxp?.montoPagado?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: deuda.id },
    })).toBe(1);

    const conflicto = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0223, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(conflicto.success).toBe(false);
    if (conflicto.success) expect.unreachable('Se esperaba conflicto de idempotencia');
    expect(conflicto.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('registrarPagoPrestamoAction: pagos parciales concurrentes con la misma clave aplican una vez', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const key = `loan-partial-race-${crypto.randomUUID()}`;
    const input = {
      id: loan.id,
      monto: 0.0123,
      cuentaId: cuentaPagoId,
      tipoPagoId,
      idempotencyKey: key,
    };
    const saldoCuentaAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
      select: { saldo: true },
    })).saldo);

    const [primera, segunda] = await Promise.all([
      registrarPagoPrestamoAction(input),
      registrarPagoPrestamoAction(input),
    ]);

    expect([primera.success, segunda.success]).toEqual([true, true]);
    if (!primera.success || !segunda.success) {
      throw new Error('Ambas solicitudes concurrentes deben responder con éxito.');
    }
    expect(segunda.data.reconciliacion.reconciliacionId)
      .toBe(primera.data.reconciliacion.reconciliacionId);

    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: loan.cuentaPorCobrarId },
      select: { montoPagado: true, montoPagadoFuncional: true },
    });
    expect(cxc.montoPagado.toString()).toBe('0.0123');
    expect(cxc.montoPagadoFuncional?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: loan.id },
    })).toBe(1);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
      select: { saldo: true },
    })).saldo)).toBeCloseTo(saldoCuentaAntes + 0.0123, 10);
  });

  it('registrarPagoDeudaAction: pagos parciales concurrentes con la misma clave aplican una vez', async () => {
    const debt = await AccountingCashOperationsMutationService.createCashDebt({
      input: { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const key = `debt-partial-race-${crypto.randomUUID()}`;
    const input = {
      id: debt.id,
      monto: 0.0123,
      cuentaId: cuentaOrigenId,
      tipoPagoId,
      idempotencyKey: key,
    };
    const saldoCuentaAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    })).saldo);

    const [primera, segunda] = await Promise.all([
      registrarPagoDeudaAction(input),
      registrarPagoDeudaAction(input),
    ]);

    expect([primera.success, segunda.success]).toEqual([true, true]);
    if (!primera.success || !segunda.success) {
      throw new Error('Ambas solicitudes concurrentes deben responder con éxito.');
    }
    expect(segunda.data.reconciliacion.reconciliacionId)
      .toBe(primera.data.reconciliacion.reconciliacionId);

    const cxp = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: debt.cuentaPorPagarId },
      select: { montoPagado: true, montoPagadoFuncional: true },
    });
    expect(cxp.montoPagado.toString()).toBe('0.0123');
    expect(cxp.montoPagadoFuncional?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: debt.id },
    })).toBe(1);
    expect(Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    })).saldo)).toBeCloseTo(saldoCuentaAntes - 0.0123, 10);
  });

  it('registrarPagoPrestamoAction: el cambio de tasa con la misma clave no altera el estado persistido', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId,
        montoCapital: 0.05,
        moneda: 'USD',
        tasaCambioAlCrear: 300,
        cuentaBancariaId: cuentaOrigenId,
      },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const key = `loan-fx-conflict-${crypto.randomUUID()}`;
    const input = {
      id: loan.id,
      monto: 0.0123,
      moneda: 'USD',
      tasaCambio: 300,
      observaciones: 'Pago parcial con FX',
      cuentaId: cuentaPagoId,
      tipoPagoId,
      idempotencyKey: key,
    };
    const bankBalanceBeforePayment = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaPagoId },
      select: { saldo: true },
    })).saldo);

    const first = await registrarPagoPrestamoAction(input);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error('El pago inicial del préstamo debe completarse.');
    expect(first.data.reconciliacion.monto.toString()).toBe('0.0123');
    expect(first.data.reconciliacion.tasaCambio?.toString()).toBe('300');
    expect(first.data.reconciliacion.montoConvertido?.toFixed(4)).toBe('3.6900');
    expect(first.data.reconciliacion.montoCuenta?.toFixed(4)).toBe('3.6900');

    const receivableAfterPayment = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: loan.cuentaPorCobrarId },
      select: { montoPagadoFuncional: true },
    });
    expect(receivableAfterPayment.montoPagadoFuncional?.toFixed(4)).toBe('3.6900');

    const exactReplay = await registrarPagoPrestamoAction(input);
    expect(exactReplay.success).toBe(true);
    if (!exactReplay.success) throw new Error('El reintento exacto debe reproducir el pago.');
    expect(exactReplay.data.reconciliacion.reconciliacionId)
      .toBe(first.data.reconciliacion.reconciliacionId);
    const beforeConflict = await cashPaymentSnapshot({
      kind: 'loan', operationId: loan.id, obligationId: loan.cuentaPorCobrarId, accountId: cuentaPagoId,
    });
    expect(Number(beforeConflict.account.saldo) - bankBalanceBeforePayment).toBeCloseTo(3.69, 10);
    expectPostedFunctionalAmount(beforeConflict, first.data.reconciliacion.reconciliacionId);

    const conflict = await registrarPagoPrestamoAction({ ...input, tasaCambio: 301 });
    expect(conflict.success).toBe(false);
    if (conflict.success) expect.unreachable('Se esperaba conflicto por cambio de tasa.');
    expect(conflict.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await cashPaymentSnapshot({
      kind: 'loan', operationId: loan.id, obligationId: loan.cuentaPorCobrarId, accountId: cuentaPagoId,
    })).toEqual(beforeConflict);

    const observationConflict = await registrarPagoPrestamoAction({
      ...input,
      observaciones: 'Observación distinta',
    });
    expect(observationConflict.success).toBe(false);
    if (observationConflict.success) {
      expect.unreachable('Se esperaba conflicto por cambio de observaciones.');
    }
    expect(observationConflict.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await cashPaymentSnapshot({
      kind: 'loan', operationId: loan.id, obligationId: loan.cuentaPorCobrarId, accountId: cuentaPagoId,
    })).toEqual(beforeConflict);
  });

  it('registrarPagoDeudaAction: el cambio de tasa con la misma clave no altera el estado persistido', async () => {
    const debt = await AccountingCashOperationsMutationService.createCashDebt({
      input: {
        proveedorId,
        montoCapital: 0.05,
        moneda: 'USD',
        tasaCambio: 300,
        cuentaBancariaId: cuentaOrigenId,
      },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const key = `debt-fx-conflict-${crypto.randomUUID()}`;
    const input = {
      id: debt.id,
      monto: 0.0123,
      moneda: 'USD',
      tasaCambio: 300,
      observaciones: 'Pago parcial con FX',
      cuentaId: cuentaOrigenId,
      tipoPagoId,
      idempotencyKey: key,
    };
    const bankBalanceBeforePayment = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    })).saldo);

    const first = await registrarPagoDeudaAction(input);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error('El pago inicial de la deuda debe completarse.');
    expect(first.data.reconciliacion.monto.toString()).toBe('0.0123');
    expect(first.data.reconciliacion.tasaCambio?.toString()).toBe('300');
    expect(first.data.reconciliacion.montoConvertido?.toFixed(4)).toBe('3.6900');
    expect(first.data.reconciliacion.montoCuenta?.toFixed(4)).toBe('3.6900');

    const payableAfterPayment = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: debt.cuentaPorPagarId },
      select: { montoPagadoFuncional: true },
    });
    expect(payableAfterPayment.montoPagadoFuncional?.toFixed(4)).toBe('3.6900');

    const exactReplay = await registrarPagoDeudaAction(input);
    expect(exactReplay.success).toBe(true);
    if (!exactReplay.success) throw new Error('El reintento exacto debe reproducir el pago.');
    expect(exactReplay.data.reconciliacion.reconciliacionId)
      .toBe(first.data.reconciliacion.reconciliacionId);
    const beforeConflict = await cashPaymentSnapshot({
      kind: 'debt', operationId: debt.id, obligationId: debt.cuentaPorPagarId, accountId: cuentaOrigenId,
    });
    expect(bankBalanceBeforePayment - Number(beforeConflict.account.saldo)).toBeCloseTo(3.69, 10);
    expectPostedFunctionalAmount(beforeConflict, first.data.reconciliacion.reconciliacionId);

    const conflict = await registrarPagoDeudaAction({ ...input, tasaCambio: 301 });
    expect(conflict.success).toBe(false);
    if (conflict.success) expect.unreachable('Se esperaba conflicto por cambio de tasa.');
    expect(conflict.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await cashPaymentSnapshot({
      kind: 'debt', operationId: debt.id, obligationId: debt.cuentaPorPagarId, accountId: cuentaOrigenId,
    })).toEqual(beforeConflict);

    const observationConflict = await registrarPagoDeudaAction({
      ...input,
      observaciones: 'Observación distinta',
    });
    expect(observationConflict.success).toBe(false);
    if (observationConflict.success) {
      expect.unreachable('Se esperaba conflicto por cambio de observaciones.');
    }
    expect(observationConflict.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await cashPaymentSnapshot({
      kind: 'debt', operationId: debt.id, obligationId: debt.cuentaPorPagarId, accountId: cuentaOrigenId,
    })).toEqual(beforeConflict);
  });

  it('createCashLoan: replay idempotente no duplica saldo, CxC, reconciliación ni asiento', async () => {
    const key = `loan-create-${crypto.randomUUID()}`;
    const input = {
      clienteId,
      montoCapital: 275,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const primera = await AccountingCashOperationsMutationService.createCashLoan({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const replay = await AccountingCashOperationsMutationService.createCashLoan({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });

    expect(replay.id).toBe(primera.id);
    expect(await prisma.prestamoCash.count({ where: { tenantId, id: primera.id } })).toBe(1);
    expect(await prisma.cuentaPorCobrar.count({
      where: { tenantId, id: primera.cuentaPorCobrarId },
    })).toBe(1);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: primera.id },
    })).toBe(1);

    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) - 275);

    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: { ...input, montoCapital: 276 },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('createCashDebt: replay idempotente no duplica saldo, CxP, reconciliación ni asiento', async () => {
    const key = `debt-create-${crypto.randomUUID()}`;
    const input = {
      proveedorId,
      montoCapital: 315,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const primera = await AccountingCashOperationsMutationService.createCashDebt({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const replay = await AccountingCashOperationsMutationService.createCashDebt({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });

    expect(replay.id).toBe(primera.id);
    expect(await prisma.deudaCash.count({ where: { tenantId, id: primera.id } })).toBe(1);
    expect(await prisma.cuentaPorPagar.count({
      where: { tenantId, cuentaPorPagarId: primera.cuentaPorPagarId },
    })).toBe(1);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'deuda_cash', origenId: primera.id },
    })).toBe(1);

    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) + 315);

    await expect(AccountingCashOperationsMutationService.createCashDebt({
      input: { ...input, montoCapital: 316 },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('createCashLoan: dos solicitudes concurrentes con la misma clave convergen en una entidad', async () => {
    const key = `loan-create-race-${crypto.randomUUID()}`;
    const input = {
      clienteId,
      montoCapital: 185,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const [primera, segunda] = await Promise.all([
      AccountingCashOperationsMutationService.createCashLoan({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'prestamos-cash': true } } as never,
      }),
      AccountingCashOperationsMutationService.createCashLoan({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'prestamos-cash': true } } as never,
      }),
    ]);

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: primera.id },
    })).toBe(1);
    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) - 185);
  });

  it('createCashDebt: dos solicitudes concurrentes con la misma clave convergen en una entidad', async () => {
    const key = `debt-create-race-${crypto.randomUUID()}`;
    const input = {
      proveedorId,
      montoCapital: 195,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const [primera, segunda] = await Promise.all([
      AccountingCashOperationsMutationService.createCashDebt({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'deudas-cash': true } } as never,
      }),
      AccountingCashOperationsMutationService.createCashDebt({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'deudas-cash': true } } as never,
      }),
    ]);

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'deuda_cash', origenId: primera.id },
    })).toBe(1);
    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) + 195);
  });
});
