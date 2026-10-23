import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { CashSnapshotService } from '@/features/contabilidad/services/cash-snapshot-service';

/**
 * @description Ejercita la captura de snapshots funcionales cash con filas
 * PostgreSQL reales (DB desechable).
 *
 * Verifica: congelamiento del estado funcional (saldo = deuda - pagado en
 * moneda funcional + evidencia FX tal como está en la cuenta), idempotencia
 * por día de corte, evolución histórica entre cortes y omisión de cuentas
 * sin montos funcionales verificables.
 */
const prefix = `cta-snap-${crypto.randomUUID()}`;
let tenantId = '';
let clienteId = '';
let proveedorId = '';
let cuentaId = '';

const user = () => ({
  userId: 'actor-real',
  tenantId,
  tenantRole: 'manager',
  planFeatures: { 'prestamos-cash': true, 'deudas-cash': true },
}) as never;

describe('snapshots funcionales cash — PostgreSQL aislado', { timeout: 90_000 }, () => {
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
    clienteId = (await prisma.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
    proveedorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldo: 100000,
    } })).cuentaId;
    await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365, features: { 'contabilidad-formal': true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP', esPrincipal: true },
      update: {},
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-real' },
    });
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: mesInicio, fechaFin: mesFin,
    } });
    await PeriodoGuard.assertWritable(new Date(), tenantId, 'asiento', {
      actorId: 'actor-real', actorTipo: 'USUARIO', origen: { tipo: 'cash_snapshot', id: prefix },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    await prisma.cashSnapshot.deleteMany({ where: { tenantId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.deudaCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
  });

  it('congela el estado funcional de préstamo y deuda cash', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId, montoCapital: 100, moneda: 'USD', tasaCambioAlCrear: 24,
        cuentaBancariaId: cuentaId,
      },
      user: user(),
    });
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: {
        proveedorId, montoCapital: 100, moneda: 'USD', tasaCambio: 24,
        cuentaBancariaId: cuentaId,
      },
      user: user(),
    });

    const res = await CashSnapshotService.capturar({ tenantId, motivo: 'AUDITORIA' });
    expect(res.creados).toBe(2);
    expect(res.existentes).toBe(0);
    expect(res.omitidos).toBe(0);

    const filas = await CashSnapshotService.leerCorte(tenantId, res.fechaCorte);
    expect(filas).toHaveLength(2);

    const snapPrestamo = filas.find((f) => f.tipo === 'PRESTAMO_CASH');
    const snapDeuda = filas.find((f) => f.tipo === 'DEUDA_CASH');
    expect(snapPrestamo).toBeTruthy();
    expect(snapDeuda).toBeTruthy();
    expect(snapPrestamo!.origenId).toBe(loan.id);
    expect(snapDeuda!.origenId).toBe(deuda.id);

    // La evidencia del snapshot es la misma que la persistida en la cuenta.
    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: snapPrestamo!.cuentaPorCobrarId! },
    });
    const cxp = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: snapDeuda!.cuentaPorPagarId! },
    });
    expect(snapPrestamo!.fxEvidenceFingerprint).toBe(cxc.fxEvidenceFingerprint);
    expect(snapDeuda!.fxEvidenceFingerprint).toBe(cxp.fxEvidenceFingerprint);
    expect(snapPrestamo!.rateEffectiveAt?.getTime()).toBe(cxc.rateEffectiveAt?.getTime());

    for (const f of [snapPrestamo!, snapDeuda!]) {
      expect(f.monedaFuncional).toBe('CUP');
      expect(f.montoDeudaFuncional.toString()).toBe('2400');
      expect(f.montoPagadoFuncional.toString()).toBe('0');
      expect(f.saldoFuncional.toString()).toBe('2400');
      expect(f.tasaCambio?.toString()).toBe('24');
      expect(f.motivo).toBe('AUDITORIA');
    }
  });

  it('es idempotente para el mismo día de corte', async () => {
    const corte = new Date();
    const primera = await CashSnapshotService.capturar({ tenantId, fechaCorte: corte });
    const segunda = await CashSnapshotService.capturar({ tenantId, fechaCorte: corte });
    expect(segunda.creados).toBe(0);
    expect(segunda.existentes).toBe(primera.creados + primera.existentes);
    const filas = await CashSnapshotService.leerCorte(tenantId, corte);
    expect(filas).toHaveLength(primera.creados + primera.existentes);
  });

  it('resuelve capturas concurrentes del mismo corte con conteos por caller', async () => {
    // Wait until both real serializable transactions have read both source tables.
    // The query results still come from PostgreSQL; the proxy only synchronizes
    // transaction progress so the unique-key race is deterministic.
    let readers = 0;
    let releaseReaders!: () => void;
    const readersReady = new Promise<void>((resolve) => { releaseReaders = resolve; });
    let barrierReleased = false;
    const prismaClient = prisma as unknown as { $transaction: typeof prisma.$transaction };
    const originalTransaction = prismaClient.$transaction.bind(prisma);
    const wrapReadDelegate = <T extends object>(delegate: T): T => new Proxy(delegate, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== 'findMany' || typeof value !== 'function') return value;
        return async (...args: unknown[]) => {
          const rows = await Reflect.apply(value, target, args);
          if (!barrierReleased) {
            readers += 1;
            if (readers === 4) {
              barrierReleased = true;
              releaseReaders();
            }
            await readersReady;
          }
          return rows;
        };
      },
    });
    const wrapTransactionClient = (tx: Prisma.TransactionClient) => new Proxy(tx, {
      get(target, property, receiver) {
        if (property === 'cuentaPorCobrar' || property === 'cuentaPorPagar') {
          return wrapReadDelegate(Reflect.get(target, property, receiver));
        }
        return Reflect.get(target, property, receiver);
      },
    });
    prismaClient.$transaction = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) =>
      originalTransaction((tx) => callback(wrapTransactionClient(tx)), options as never)) as never;

    try {
      const fechaCorte = new Date('2098-03-04T12:00:00.000Z');
      const outcomes = await Promise.allSettled([
        CashSnapshotService.capturar({ tenantId, fechaCorte, motivo: 'RACE_A' }),
        CashSnapshotService.capturar({ tenantId, fechaCorte, motivo: 'RACE_B' }),
      ]);

      expect(readers).toBeGreaterThanOrEqual(4);
      expect(
        outcomes.every((outcome) => outcome.status === 'fulfilled'),
        JSON.stringify(outcomes.map((outcome) => outcome.status === 'rejected'
          ? { status: outcome.status, error: String(outcome.reason) }
          : { status: outcome.status, result: outcome.value })),
      ).toBe(true);
      const results = outcomes.map((outcome) => {
        if (outcome.status !== 'fulfilled') throw outcome.reason;
        return outcome.value;
      });
      expect(results.map(({ creados, existentes }) => ({ creados, existentes })).sort(
        (a, b) => b.creados - a.creados,
      )).toEqual([
        { creados: 2, existentes: 0 },
        { creados: 0, existentes: 2 },
      ]);
      expect(results.every(({ omitidos }) => omitidos === 0)).toBe(true);
      expect(await CashSnapshotService.leerCorte(tenantId, fechaCorte)).toHaveLength(2);
    } finally {
      prismaClient.$transaction = originalTransaction;
    }
  });

  it('lee CxC y CxP desde una versión coherente ante actualización concurrente', async () => {
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { tenantId, tipoCuenta: 'PRESTAMO_CASH' },
      select: { id: true, montoPagadoFuncional: true },
    });
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({
      where: { tenantId, tipoDeuda: 'DEUDA_CASH' },
      select: { cuentaPorPagarId: true, montoPagadoFuncional: true },
    });
    let signalCxcRead!: () => void;
    let releaseCxpRead!: () => void;
    const cxcRead = new Promise<void>((resolve) => { signalCxcRead = resolve; });
    const cxpReadGate = new Promise<void>((resolve) => { releaseCxpRead = resolve; });
    const prismaClient = prisma as unknown as { $transaction: typeof prisma.$transaction };
    const originalTransaction = prismaClient.$transaction.bind(prisma);
    const wrapTransactionClient = (tx: Prisma.TransactionClient) => new Proxy(tx, {
      get(target, property, receiver) {
        if (property !== 'cuentaPorCobrar' && property !== 'cuentaPorPagar') {
          return Reflect.get(target, property, receiver);
        }
        const delegate = Reflect.get(target, property, receiver);
        return new Proxy(delegate, {
          get(delegateTarget, delegateProperty, delegateReceiver) {
            const value = Reflect.get(delegateTarget, delegateProperty, delegateReceiver);
            if (delegateProperty !== 'findMany' || typeof value !== 'function') return value;
            return async (...args: unknown[]) => {
              if (property === 'cuentaPorPagar') await cxpReadGate;
              const rows = await Reflect.apply(value, delegateTarget, args);
              if (property === 'cuentaPorCobrar') signalCxcRead();
              return rows;
            };
          },
        });
      },
    });
    prismaClient.$transaction = ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) =>
      originalTransaction((tx) => callback(wrapTransactionClient(tx)), options as never)) as never;

    try {
      const fechaCorte = new Date('2098-03-05T12:00:00.000Z');
      const capture = CashSnapshotService.capturar({ tenantId, fechaCorte });
      await cxcRead;
      await originalTransaction(async (tx) => {
        await tx.cuentaPorCobrar.update({
          where: { id: cxc.id }, data: { montoPagadoFuncional: 10 },
        });
        await tx.cuentaPorPagar.update({
          where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
          data: { montoPagadoFuncional: 10 },
        });
      });
      releaseCxpRead();
      await capture;

      const filas = await CashSnapshotService.leerCorte(tenantId, fechaCorte);
      const snapshotCxc = filas.find((row) => row.tipo === 'PRESTAMO_CASH');
      const snapshotCxp = filas.find((row) => row.tipo === 'DEUDA_CASH');
      expect(snapshotCxc?.montoPagadoFuncional.toString()).toBe(
        snapshotCxp?.montoPagadoFuncional.toString(),
      );
      expect(['0', '10']).toContain(snapshotCxc?.montoPagadoFuncional.toString());
    } finally {
      releaseCxpRead();
      prismaClient.$transaction = originalTransaction;
      await originalTransaction(async (tx) => {
        await tx.cuentaPorCobrar.update({
          where: { id: cxc.id }, data: { montoPagadoFuncional: cxc.montoPagadoFuncional },
        });
        await tx.cuentaPorPagar.update({
          where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
          data: { montoPagadoFuncional: cxp.montoPagadoFuncional },
        });
      });
    }
  });

  it('refleja pagos en un corte nuevo y conserva el histórico', async () => {
    const tipoPagoId = (await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId, nombre: 'Transferencia' },
    })).tipoId;
    const prestamo = await prisma.prestamoCash.findFirstOrThrow({ where: { tenantId } });
    await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: prestamo.id, monto: 10, cuentaId, tipoPagoId,
        moneda: 'USD', tasaCambio: 25,
      },
      user: user(),
    });

    const corteViejo = new Date();
    const corteNuevo = new Date(corteViejo.getTime() + 24 * 60 * 60 * 1000);
    const res = await CashSnapshotService.capturar({ tenantId, fechaCorte: corteNuevo });
    expect(res.creados).toBe(2);

    const filasViejas = await CashSnapshotService.leerCorte(tenantId, corteViejo);
    const filasNuevas = await CashSnapshotService.leerCorte(tenantId, corteNuevo);
    const viejoPrestamo = filasViejas.find((f) => f.tipo === 'PRESTAMO_CASH');
    const nuevoPrestamo = filasNuevas.find((f) => f.tipo === 'PRESTAMO_CASH');
    // El corte viejo queda intacto: 2400 - 0
    expect(viejoPrestamo!.saldoFuncional.toString()).toBe('2400');
    // El corte nuevo refleja el pago: 2400 - 250 (10 USD @ 25)
    expect(nuevoPrestamo!.montoPagadoFuncional.toString()).toBe('250');
    expect(nuevoPrestamo!.saldoFuncional.toString()).toBe('2150');
    // La deuda sin pagos no cambia
    const nuevaDeuda = filasNuevas.find((f) => f.tipo === 'DEUDA_CASH');
    expect(nuevaDeuda!.saldoFuncional.toString()).toBe('2400');
  });

  it('omite cuentas sin montos funcionales verificables', async () => {
    // CxC histórica sin valuación funcional (montoDeudaFuncional null)
    await prisma.cuentaPorCobrar.create({ data: {
      tenantId, clienteId, montoDeuda: 500, montoPagado: 0,
      tipoCuenta: 'PRESTAMO_CASH', estado: 'PENDIENTE',
    } });
    const corte = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const res = await CashSnapshotService.capturar({ tenantId, fechaCorte: corte });
    expect(res.omitidos).toBe(1);
    const filas = await CashSnapshotService.leerCorte(tenantId, corte);
    expect(filas).toHaveLength(2);
  });
});
