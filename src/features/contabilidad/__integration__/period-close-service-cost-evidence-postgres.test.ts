import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma!: typeof import('@/lib/prisma').prisma;
let cerrarPeriodoAction!: typeof import('@/features/contabilidad/actions-periodos').cerrarPeriodoAction;
let verificarOperacionesPendientesAction!: typeof import('@/features/contabilidad/actions-periodos').verificarOperacionesPendientesAction;
let updateVentaServicioAction!: typeof import('@/features/venta-servicios/actions').updateVentaServicioAction;
let updateCompraServicioAction!: typeof import('@/features/compras-servicios/actions').updateCompraServicioAction;
let reconciliarVentaAction!: typeof import('@/features/contabilidad/actions-reconciliacion').reconciliarVentaAction;
let accountingReconciliationService!: typeof import('@/features/contabilidad/services/accounting-reconciliation-service').AccountingReconciliationService;
let tenantId = '';
let planId = '';
let tenantLicenseId = '';
let periodoId = '';
let servicioId = '';
let cuentaId = '';
let tipoPagoId = '';
let userId = '';
let clienteId = '';
let racePeriodoId = '';
const unique = crypto.randomUUID().replaceAll('-', '');
const prefix = `period-close-cost-${unique}`;
const email = `${prefix}@test.local`;
const periodStart = new Date('2098-07-01T00:00:00.000Z');
const periodEnd = new Date('2098-07-31T23:59:59.999Z');

function currentUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Period close integration actor',
    email,
    role: 'admin',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { contabilidad: true },
  };
}

describe('period close service-cost evidence — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/contabilidad/actions-periodos'),
    ]);
    ({ updateVentaServicioAction } = await import('@/features/venta-servicios/actions'));
    ({ updateCompraServicioAction } = await import('@/features/compras-servicios/actions'));
    ({ reconciliarVentaAction } = await import('@/features/contabilidad/actions-reconciliacion'));
    ({ AccountingReconciliationService: accountingReconciliationService } = await import('@/features/contabilidad/services/accounting-reconciliation-service'));
    prisma = prismaModule.prisma;
    cerrarPeriodoAction = actionModule.cerrarPeriodoAction;
    verificarOperacionesPendientesAction = actionModule.verificarOperacionesPendientesAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const plan = await prisma.plan.create({
      data: { nombre: prefix, duracionDias: 365, features: { contabilidad: true } },
    });
    planId = plan.planId;
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const license = await prisma.tenantLicense.create({
      data: { tenantId, planId, expiracion: new Date('2099-01-01') },
    });
    tenantLicenseId = license.tenantLicenseId;
    const user = await prisma.user.create({
      data: { name: 'Period close integration actor', email, password: 'integration-only-placeholder' },
    });
    userId = user.userId;
    const period = await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: periodStart,
        fechaFin: periodEnd,
      },
    });
    periodoId = period.periodoId;
    const racePeriod = await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2098-08-01T00:00:00.000Z'),
        fechaFin: new Date('2098-08-31T23:59:59.999Z'),
      },
    });
    racePeriodoId = racePeriod.periodoId;
    const client = await prisma.cliente.create({ data: { tenantId, nombre: `${prefix}-client` } });
    clienteId = client.clienteId;
    const service = await prisma.servicios.create({
      data: { tenantId, nombre: prefix, descripcion: prefix, precio: 1000, moneda: 'CUP' },
    });
    servicioId = service.servicioId;
    const bankAccount = await prisma.cuentaBancaria.create({
      data: {
        tenantId,
        nombreBanco: prefix,
        numeroCuenta: `${unique.slice(0, 18)}`,
        tipoCuenta: 'CORRIENTE',
        moneda: 'CUP',
      },
    });
    cuentaId = bankAccount.cuentaId;
    const paymentType = await prisma.tipoPago.create({
      data: { tenantId, nombre: prefix, requiereCuenta: true, cuentaDefecto: cuentaId },
    });
    tipoPagoId = paymentType.tipoId;
    vi.mocked(getCurrentUser).mockImplementation(async () => currentUser());
  });

  afterAll(async () => {
    if (!prisma) return;
    if (tenantId) {
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
      await prisma.reconciliacionServicio.deleteMany({ where: { tenantId } });
      await prisma.compraServicio.deleteMany({ where: { tenantId } });
      await prisma.ventaServicios.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
      if (periodoId) await prisma.periodoContable.deleteMany({ where: { periodoId } });
      if (racePeriodoId) await prisma.periodoContable.deleteMany({ where: { periodoId: racePeriodoId } });
      if (servicioId) await prisma.servicios.deleteMany({ where: { servicioId } });
      if (clienteId) await prisma.cliente.deleteMany({ where: { clienteId } });
      if (tipoPagoId) await prisma.tipoPago.deleteMany({ where: { tipoId: tipoPagoId } });
      if (cuentaId) await prisma.cuentaBancaria.deleteMany({ where: { cuentaId } });
      if (tenantLicenseId) await prisma.tenantLicense.deleteMany({ where: { tenantLicenseId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (planId) await prisma.plan.deleteMany({ where: { planId } });
    if (userId) await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('blocks direct close when service costs have reference-only reconciliation rows', async () => {
    const purchase = await prisma.compraServicio.create({
      data: {
        tenantId,
        servicioId,
        costoUnitario: 700,
        cantidad: 1,
        total: 700,
        formaPago: 'TRANSFERENCIA',
        estado: 'PENDIENTE',
        moneda: 'CUP',
        createdAt: new Date('2098-07-10T12:00:00.000Z'),
      },
    });
    const sale = await prisma.ventaServicios.create({
      data: {
        tenantId,
        servicioId,
        cantidad: 2,
        costo: 300,
        total: 1000,
        moneda: 'CUP',
        createdAt: new Date('2098-07-11T12:00:00.000Z'),
      },
    });
    const saleRevenueAmount = 1000;
    const saleRevenueEvidence = buildAppliedFxEvidence({
      originalAmount: saleRevenueAmount,
      originalCurrency: 'CUP',
      functionalCurrency: 'CUP',
      source: 'period-close-integration-sale-revenue',
    });
    await prisma.reconciliacionServicio.create({
      data: {
        tenantId,
        ventaServicioId: sale.ventaServicioId,
        cuentaId,
        tipoPagoId,
        monto: saleRevenueAmount,
        montoConvertido: saleRevenueAmount,
        moneda: 'CUP',
        tasaCambio: null,
        ...saleRevenueEvidence,
        rateEffectiveAt: null,
        reconciliadoPor: userId,
        fechaReconciliacion: new Date('2098-07-12T12:00:00.000Z'),
      },
    });
    await prisma.reconciliacionGasto.createMany({
      data: [purchase.compraServicioId, sale.ventaServicioId].map((referenciaId) => ({
        tenantId,
        tipoGasto: referenciaId === purchase.compraServicioId ? 'servicio' : 'venta_servicio',
        referenciaId,
        cuentaId,
        tipoPagoId,
        monto: 1,
        moneda: 'CUP',
        descripcion: 'Reference-only invalid reconciliation fixture',
        reconciliadoPor: userId,
        fechaReconciliacion: new Date('2098-07-12T12:00:00.000Z'),
      })),
    });

    const pending = await verificarOperacionesPendientesAction(periodoId);
    expect(pending.success).toBe(true);
    if (!pending.success) throw new Error(pending.error.message);
    expect(pending.data).toMatchObject({ serviciosSinReconciliar: 0, gastosSinReconciliar: 2 });

    const result = await cerrarPeriodoAction({ periodoId });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('PERIOD_RECONCILIATION_PENDING');
    expect((await prisma.periodoContable.findUnique({ where: { periodoId } }))?.estado).toBe('ABIERTO');
    expect(await prisma.snapshotPeriodo.count({ where: { tenantId, periodoId } })).toBe(0);
  });

  it('serializes an open-CxC edit behind close and rejects it against the committed period state', async () => {
    const sale = await prisma.ventaServicios.create({
      data: {
        tenantId,
        servicioId,
        cantidad: 1,
        costo: 0,
        total: 100,
        moneda: 'CUP',
        precioUnitario: 100,
        clienteId,
        condicionPago: 'CREDITO',
        createdAt: new Date('2098-08-10T12:00:00.000Z'),
      },
    });
    await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        ventaServicioId: sale.ventaServicioId,
        clienteId,
        montoDeuda: 100,
        montoDeudaFuncional: 100,
        montoPagado: 0,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
        tipoCuenta: 'VENTA_SERVICIO',
        estado: 'PENDIENTE',
      },
    });

    let signalCloseLock!: () => void;
    const closeLockAcquired = new Promise<void>((resolve) => { signalCloseLock = resolve; });
    let releaseClose!: () => void;
    const closeReleaseBarrier = new Promise<void>((resolve) => { releaseClose = resolve; });
    const closeTransaction = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
      await tx.periodoContable.update({
        where: { periodoId: racePeriodoId },
        data: { estado: 'CERRADO' },
      });
      await tx.periodoCache.deleteMany({ where: { tenantId } });
      signalCloseLock();
      await closeReleaseBarrier;
    });

    await closeLockAcquired;
    const updatePromise = updateVentaServicioAction({
      ventaServicioId: sale.ventaServicioId,
      cantidad: 2,
    });
    const firstResult = await Promise.race([
      updatePromise.then((result) => ({ result })),
      new Promise<{ result?: never }>((resolve) => setTimeout(() => resolve({}), 250)),
    ]);
    releaseClose();
    await closeTransaction;
    const updateResult = firstResult.result ?? await updatePromise;

    expect(updateResult.success).toBe(false);
    expect(updateResult.error?.code).toBe('PERIODO_CERRADO');
    expect(await prisma.ventaServicios.findUnique({ where: { ventaServicioId: sale.ventaServicioId } }))
      .toMatchObject({ cantidad: 1, total: 100 });
    expect((await prisma.cuentaPorCobrar.findUnique({ where: { ventaServicioId: sale.ventaServicioId } }))
      ?.montoDeuda.toString()).toBe('100');
  });

  it('serializes a received-service edit behind close and leaves it unchanged', async () => {
    await prisma.periodoContable.update({
      where: { periodoId: racePeriodoId },
      data: { estado: 'ABIERTO' },
    });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    const received = await prisma.compraServicio.create({
      data: {
        tenantId,
        servicioId,
        costoUnitario: 100,
        cantidad: 1,
        total: 100,
        moneda: 'CUP',
        formaPago: 'CREDITO',
        estado: 'PENDIENTE',
        fechaServicio: new Date('2098-08-15T12:00:00.000Z'),
        createdAt: new Date('2098-08-15T12:00:00.000Z'),
      },
    });
    let signalLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { signalLock = resolve; });
    let releaseClose!: () => void;
    const releaseBarrier = new Promise<void>((resolve) => { releaseClose = resolve; });
    const closeTransaction = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
      await tx.periodoContable.update({
        where: { periodoId: racePeriodoId },
        data: { estado: 'CERRADO' },
      });
      await tx.periodoCache.deleteMany({ where: { tenantId } });
      signalLock();
      await releaseBarrier;
    });
    await lockAcquired;
    const updatePromise = updateCompraServicioAction({
      compraServicioId: received.compraServicioId,
      cantidad: 2,
    });
    const firstResult = await Promise.race([
      updatePromise.then((result) => ({ result })),
      new Promise<{ result?: never }>((resolve) => setTimeout(() => resolve({}), 250)),
    ]);
    releaseClose();
    await closeTransaction;
    const updateResult = firstResult.result ?? await updatePromise;
    expect(updateResult.success).toBe(false);
    expect(updateResult.error?.code).toBe('PERIODO_CERRADO');
    expect(await prisma.compraServicio.findUnique({
      where: { compraServicioId: received.compraServicioId },
    })).toMatchObject({ cantidad: 1, total: 100 });
  });

  it('revalidates a sale reconciliation after waiting for a close lock', async () => {
    await prisma.periodoContable.update({
      where: { periodoId: racePeriodoId },
      data: { estado: 'ABIERTO' },
    });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    let signalLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { signalLock = resolve; });
    let releaseClose!: () => void;
    const releaseBarrier = new Promise<void>((resolve) => { releaseClose = resolve; });
    const closeTransaction = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
      await tx.periodoContable.update({
        where: { periodoId: racePeriodoId },
        data: { estado: 'CERRADO' },
      });
      await tx.periodoCache.deleteMany({ where: { tenantId } });
      signalLock();
      await releaseBarrier;
    });
    await lockAcquired;
    const reconciliationPromise = reconciliarVentaAction({
      ventaId: 'missing-sale-race-test',
      cuentaId: 'missing-account-race-test',
      tipoPagoId: 'missing-payment-type-race-test',
      monto: 1,
      fechaReconciliacion: '2098-08-15T12:00:00.000Z',
    });
    const firstResult = await Promise.race([
      reconciliationPromise.then((result) => ({ result })),
      new Promise<{ result?: never }>((resolve) => setTimeout(() => resolve({}), 250)),
    ]);
    releaseClose();
    await closeTransaction;
    const result = firstResult.result ?? await reconciliationPromise;
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PERIODO_CERRADO');
  });

  it('revalidates the shared mobile sale reconciliation service after waiting for close', async () => {
    await prisma.periodoContable.update({
      where: { periodoId: racePeriodoId },
      data: { estado: 'ABIERTO' },
    });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    let signalLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { signalLock = resolve; });
    let releaseClose!: () => void;
    const releaseBarrier = new Promise<void>((resolve) => { releaseClose = resolve; });
    const closeTransaction = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
      await tx.periodoContable.update({
        where: { periodoId: racePeriodoId },
        data: { estado: 'CERRADO' },
      });
      await tx.periodoCache.deleteMany({ where: { tenantId } });
      signalLock();
      await releaseBarrier;
    });
    await lockAcquired;
    const reconciliationPromise = accountingReconciliationService.reconcileSale({
      user: currentUser(),
      input: {
        ventaId: 'missing-mobile-sale-race-test',
        cuentaId: 'missing-mobile-account-race-test',
        tipoPagoId: 'missing-mobile-payment-type-race-test',
        monto: 1,
        fechaReconciliacion: '2098-08-15T12:00:00.000Z',
      },
    });
    const firstResult = await Promise.race([
      reconciliationPromise.then((result) => ({ result })),
      new Promise<{ result?: never }>((resolve) => setTimeout(() => resolve({}), 250)),
    ]);
    releaseClose();
    await closeTransaction;
    let error: unknown;
    try {
      if (firstResult.result) await Promise.resolve(firstResult.result);
      else await reconciliationPromise;
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'PERIODO_CERRADO' });
  });
});
