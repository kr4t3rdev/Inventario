import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionSuccess } from '@/test/action-response';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/db/base-prisma', async () => {
  const { PrismaClient } = await import('@/generated/prisma');
  return { basePrisma: new PrismaClient({
    datasourceUrl: `${process.env.DATABASE_URL}?connection_limit=3`,
  }) };
});

let prisma!: typeof import('@/lib/prisma').prisma;
let observer!: InstanceType<typeof import('@/generated/prisma').PrismaClient>;
let createVentaServicioAction!: typeof import('@/features/venta-servicios/actions').createVentaServicioAction;
let tenantId = '';
let planId = '';
let tenantLicenseId = '';
let serviceId = '';
let periodoId = '';
let userId = '';
let foreignTenantId = '';
let foreignSaleId = '';
let foreignBankId = '';
let foreignPaymentId = '';
const prefix = `venta-servicio-idem-${crypto.randomUUID()}`;
const email = `${prefix}@test.local`;

function currentUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Integration service sale actor',
    email,
    role: 'admin',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { servicios: true, facturacion: true, 'ventas-factura': true },
  };
}

describe('service document concurrency — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    process.env.PERIODO_GUARD_ENABLED = 'true';
    process.env.PERIODO_CONTABLE_MODE = 'enforce';
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/venta-servicios/actions'),
    ]);
    prisma = prismaModule.prisma;
    const { PrismaClient } = await import('@/generated/prisma');
    // A dedicated observer cannot be starved by the holder and two waiters.
    observer = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    createVentaServicioAction = actionModule.createVentaServicioAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({
      data: { nombre: prefix, duracionDias: 365, features: { servicios: true } },
    });
    planId = plan.planId;
    const license = await prisma.tenantLicense.create({
      data: { tenantId, planId, expiracion: new Date('2099-01-01') },
    });
    tenantLicenseId = license.tenantLicenseId;
    const service = await prisma.servicios.create({
      data: { tenantId, nombre: prefix, descripcion: prefix, precio: 1250, moneda: 'CUP' },
    });
    serviceId = service.servicioId;
    const now = new Date();
    const period = await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
      },
    });
    periodoId = period.periodoId;
    const user = await prisma.user.create({
      data: {
        name: 'Integration service sale actor',
        email,
        password: 'integration-only-placeholder',
      },
    });
    userId = user.userId;
    vi.mocked(getCurrentUser).mockImplementation(async () => currentUser());
    const foreignTenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-foreign`, slug: `${prefix}-foreign` },
    });
    foreignTenantId = foreignTenant.tenantId;
    const foreignService = await prisma.servicios.create({ data: {
      tenantId: foreignTenantId, nombre: prefix, descripcion: prefix, precio: 1250,
    } });
    const foreignSale = await prisma.ventaServicios.create({ data: {
      tenantId: foreignTenantId, servicioId: foreignService.servicioId,
      cantidad: 1, total: 1250, reconciliado: false,
    } });
    foreignSaleId = foreignSale.ventaServicioId;
    foreignBankId = (await prisma.cuentaBancaria.create({ data: {
      tenantId: foreignTenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE',
    } })).cuentaId;
    foreignPaymentId = (await prisma.tipoPago.create({ data: {
      tenantId: foreignTenantId, nombre: prefix,
    } })).tipoId;
  });

  afterAll(async () => {
    // StockMoveLine is append-only evidence. Preserve its referenced fixtures
    // in this explicitly disposable database; the runner disposes the database.
    // Never disable immutability triggers or truncate other suites' fixtures.
    await observer?.$disconnect();
    await prisma?.$disconnect();
  });

  /**
   * @description Creates a credit sale with its real receivable for each race.
   * @returns {Promise<string>} Persisted sale identifier.
   */
  async function creditSale(): Promise<string> {
    const client = await prisma.cliente.create({ data: { tenantId, nombre: prefix } });
    const result = await createVentaServicioAction({
      servicioId: serviceId, cantidad: 1, clienteId: client.clienteId, condicionPago: 'CREDITO',
    });
    expect(result.success, JSON.stringify(result)).toBe(true);
    return (expectActionSuccess(result).data as { ventaServicio: { ventaServicioId: string } })
      .ventaServicio.ventaServicioId;
  }

  /**
   * @description Holds the production document lock on a separate real connection.
   * @param {string} id - Sale identifier.
   * @returns {Promise<object>} Explicit release and transaction completion handles.
   */
  async function holdDocument(id: string) {
    let release!: () => void;
    let acquired!: () => void;
    let holderPid = 0;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const { lockDocumentoServicio } = await import(
      '@/features/contabilidad/services/accounting-reconciliation-service'
    );
    const finished = prisma.$transaction(async (tx) => {
      await lockDocumentoServicio(tx, id);
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      holderPid = row.pid;
      acquired();
      await gate;
    }, { timeout: 15_000 });
    await ready;
    return { release, finished, get holderPid() { return holderPid; } };
  }

  /**
   * @description Waits for real PostgreSQL advisory-lock contention, not a timer.
   * @param {number} count - Minimum number of blocked database sessions.
   * @returns {Promise<void>} Resolves only after contention is visible.
   */
  async function waitForWaiters(count: number, holderPid: number): Promise<void> {
    await vi.waitFor(async () => {
      const rows = await observer.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_locks AS waiter
        JOIN pg_locks AS holder ON holder.locktype = waiter.locktype
          AND holder.database = waiter.database AND holder.classid = waiter.classid
          AND holder.objid = waiter.objid AND holder.objsubid = waiter.objsubid
        WHERE waiter.locktype = 'advisory' AND NOT waiter.granted
          AND holder.granted AND holder.pid = ${holderPid}
          AND holder.database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
      expect(Number(rows[0].count)).toBeGreaterThanOrEqual(count);
    }, { timeout: 3000, interval: 20 });
  }

  /**
   * @description Waits until the expected number of transaction-scoped advisory lock requests exists.
   * @param {number} count - Minimum number of blocked advisory lock requests.
   * @returns {Promise<void>} Resolves only after contention is visible.
   */
  async function waitForAnyAdvisoryWaiters(count: number): Promise<void> {
    await vi.waitFor(async () => {
      const rows = await observer.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
      expect(Number(rows[0].count)).toBeGreaterThanOrEqual(count);
    }, { timeout: 3000, interval: 20 });
  }

  it('invoice and edit wait on the same document and preserve invoice/sale/debt totals', async () => {
    const id = await creditSale();
    await prisma.serieFacturacion.create({ data: {
      tenantId, prefijo: 'TEST', descripcion: prefix, esPorDefecto: true,
    } });
    const { facturarVentaServicioAction, updateVentaServicioAction } = await import(
      '@/features/venta-servicios/actions'
    );
    const held = await holdDocument(id);
    let invoice!: ReturnType<typeof facturarVentaServicioAction>;
    let edit!: ReturnType<typeof updateVentaServicioAction>;
    try {
      invoice = facturarVentaServicioAction({ ventaServicioId: id });
      await waitForWaiters(1, held.holderPid);
      edit = updateVentaServicioAction({ ventaServicioId: id, cantidad: 2 });
      await waitForWaiters(2, held.holderPid);
    } finally {
      held.release();
      await held.finished;
    }
    expect((await invoice).success).toBe(true);
    expect(await edit).toMatchObject({
      success: false, error: { code: 'VENTA_FACTURADA_INMUTABLE' },
    });
    const sale = await prisma.ventaServicios.findUniqueOrThrow({ where: { ventaServicioId: id } });
    const debt = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { ventaServicioId: id } });
    const doc = await prisma.factura.findFirstOrThrow({ where: { ventaServicioId: id } });
    expect([sale.total, Number(debt.montoDeuda), Number(doc.total)]).toEqual([1250, 1250, 1250]);
  });

  it.each(['service', 'action'] as const)(
    '%s collection waits before taking sale row locks, then closes debt without deadlock',
    async (entrypoint) => {
      const id = await creditSale();
      const bank = await prisma.cuentaBancaria.create({ data: {
        tenantId, nombreBanco: prefix, numeroCuenta: crypto.randomUUID(), tipoCuenta: 'CORRIENTE',
      } });
      const payment = await prisma.tipoPago.create({ data: { tenantId, nombre: prefix } });
      const input = { ventaServicioId: id, distribuciones: [{
        cuentaId: bank.cuentaId, tipoPagoId: payment.tipoId, monto: 1250, moneda: 'CUP',
      }] };
      const { AccountingReconciliationService } = await import(
        '@/features/contabilidad/services/accounting-reconciliation-service'
      );
      const { reconciliarServicioAction } = await import('@/features/contabilidad/actions-reconciliacion');
      const held = await holdDocument(id);
      const collection = entrypoint === 'service'
        ? AccountingReconciliationService.reconcileService({ input, user: currentUser() })
        : reconciliarServicioAction(input);
      // Attach rejection handling immediately while the database barrier is held.
      void collection.catch(() => undefined);
      let edit: ReturnType<typeof import('@/features/venta-servicios/actions').updateVentaServicioAction>
        | undefined;
      try {
        await waitForWaiters(1, held.holderPid);
        // A stale row-first collector would already own this row and NOWAIT fails.
        await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<Array<{ total: number }>>`
            SELECT total FROM "VentaServicios" WHERE "ventaServicioId" = ${id} FOR UPDATE NOWAIT
          `;
          expect(rows[0].total).toBe(1250);
        });
        const { updateVentaServicioAction } = await import('@/features/venta-servicios/actions');
        edit = updateVentaServicioAction({ ventaServicioId: id, cantidad: 2 });
        // The collector waits for the held document; the editor now waits on
        // the collector's earlier tenant lock instead of taking the row lock.
        await waitForAnyAdvisoryWaiters(2);
      } finally {
        held.release();
        await held.finished;
      }
      const result = await collection;
      expect('success' in result ? result.success : result.reconciliado).toBe(true);
      expect(await edit).toMatchObject({ success: false, error: { code: 'HAS_REFERENCES' } });
      const debt = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { ventaServicioId: id } });
      expect([debt.estado, Number(debt.montoPagado)]).toEqual(['PAGADA', 1250]);
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: bank.cuentaId } })).saldo)
        .toBe(1250);
      expect(await prisma.reconciliacionServicio.count({ where: { ventaServicioId: id } })).toBe(1);
    },
  );
  /**
   * @description Creates a real partially received transfer and location balances.
   * @returns {Promise<object>} Transfer and location identifiers.
   */
  async function transferFixture() {
    const origin = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    const destination = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    const category = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    const product = await prisma.producto.create({ data: {
      tenantId, nombre: prefix, precioCosto: 0, precioVenta: 100, stock: 16,
      categoriaId: category.catId, almacenId: origin.almacenId,
    } });
    const transfer = await prisma.transferencia.create({ data: {
      tenantId, productoId: product.id, cantidad: 10, cantidadRecibida: 4, estado: 'PARCIAL',
      origenId: origin.almacenId, destinoId: destination.almacenId, costoUnitario: 0,
    } });
    for (const [location, quantity] of [[origin.almacenId, 16], [destination.almacenId, 4]] as const) {
      await prisma.stockUbicacion.create({ data: {
        tenantId, productoId: product.id, tipoUbicacion: 'almacen', ubicacionId: location,
        cantidad: quantity, cantidadDisponible: quantity,
      } });
    }
    return { transfer, product, origin, destination };
  }

  it('partial receipt commits while cancellation waits and cancellation rejects stale receipt snapshot', async () => {
    const { transfer, product } = await transferFixture();
    const { completarTransferenciaAction, deleteTransferenciaAction } = await import(
      '@/features/transferencias/actions'
    );
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const written = new Promise<void>((resolve) => { ready = resolve; });
    const realTransaction = prisma.$transaction.bind(prisma);
    // Only delay the real receipt transaction's COMMIT; all production SQL runs unchanged.
    const interception = vi.spyOn(prisma, '$transaction').mockImplementationOnce(
      ((callback: (tx: unknown) => Promise<unknown>) => realTransaction(async (tx) => {
        const result = await callback(tx);
        ready();
        await gate;
        return result;
      }, { timeout: 15_000 })) as typeof prisma.$transaction,
    );
    const receipt = completarTransferenciaAction({
      transferenciaId: transfer.transferenciaId, cantidadRecibida: 2,
    });
    let cancellation!: ReturnType<typeof deleteTransferenciaAction>;
    try {
      await written;
      interception.mockImplementation(realTransaction);
      cancellation = deleteTransferenciaAction(transfer.transferenciaId);
      await vi.waitFor(async () => {
        const waiting = await observer.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%UPDATE%Transferencia%'
        `;
        expect(Number(waiting[0].count)).toBeGreaterThanOrEqual(1);
      }, { timeout: 3000, interval: 20 });
    } finally {
      interception.mockImplementation(realTransaction);
      release();
    }
    expect((await receipt).success).toBe(true);
    expect(await cancellation).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
    expect(await prisma.transferencia.findUniqueOrThrow({
      where: { transferenciaId: transfer.transferenciaId },
    })).toMatchObject({ estado: 'PARCIAL', cantidadRecibida: 6, deletedAt: null });
    const stock = await prisma.stockUbicacion.findMany({
      where: { productoId: product.id }, orderBy: { cantidad: 'asc' },
    });
    expect(stock.map((row) => row.cantidad)).toEqual([6, 14]);
  });

  it('completed transfer edit persists matching received quantity and materialized stock', async () => {
    const { transfer, product, origin, destination } = await transferFixture();
    await prisma.transferencia.update({ where: { transferenciaId: transfer.transferenciaId },
      data: { estado: 'COMPLETADA', cantidad: 4 } });
    const { updateTransferenciaAction } = await import('@/features/transferencias/actions');
    const result = await updateTransferenciaAction({
      transferenciaId: transfer.transferenciaId, productoId: product.id, cantidad: 2,
      tipoOrigen: 'almacen', origenId: origin.almacenId,
      tipoDestino: 'almacen', destinoId: destination.almacenId,
    });
    expect(result.success, JSON.stringify(result)).toBe(true);
    const updated = await prisma.transferencia.findUniqueOrThrow({
      where: { transferenciaId: transfer.transferenciaId },
    });
    expect([updated.cantidad, updated.cantidadRecibida]).toEqual([2, 2]);
    const stock = await prisma.stockUbicacion.findMany({
      where: { productoId: product.id }, orderBy: { cantidad: 'asc' },
    });
    expect(stock.map((row) => row.cantidad)).toEqual([2, 18]);
  });

  /**
   * @description Builds collection inputs backed by independent real bank/payment fixtures.
   * @returns {Promise<object>} Production collection payload.
   */
  async function collectionInput() {
    const saleId = await creditSale();
    const bank = await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: crypto.randomUUID(), tipoCuenta: 'CORRIENTE',
    } });
    const payment = await prisma.tipoPago.create({ data: { tenantId, nombre: prefix } });
    return { ventaServicioId: saleId, distribuciones: [{
      cuentaId: bank.cuentaId, tipoPagoId: payment.tipoId, monto: 1250, moneda: 'CUP',
    }] };
  }

  /**
   * @description Normalizes only test observation of action responses versus service exceptions.
   * @param {'service' | 'action'} entrypoint - Real production writer to invoke.
   * @param {object} input - Untrusted collection input under test.
   * @returns {Promise<object>} Whether production accepted the operation.
   */
  async function collect(
    entrypoint: 'service' | 'action',
    input: Awaited<ReturnType<typeof collectionInput>> & { fechaReconciliacion?: string },
  ): Promise<{ success: boolean; error?: { code?: string } }> {
    if (entrypoint === 'action') {
      const { reconciliarServicioAction } = await import('@/features/contabilidad/actions-reconciliacion');
      return reconciliarServicioAction(input);
    }
    const { AccountingReconciliationService } = await import(
      '@/features/contabilidad/services/accounting-reconciliation-service'
    );
    try {
      await AccountingReconciliationService.reconcileService({ input, user: currentUser() });
      return { success: true };
    } catch (error) {
      return { success: false, error: {
        code: error instanceof Error && 'code' in error ? String(error.code) : 'UNEXPECTED',
      } };
    }
  }

  describe.each(['service', 'action'] as const)('%s security', (entrypoint) => {
    it.each(['foreign-sale', 'foreign-bank', 'foreign-payment', 'negative-split',
      'nan', 'infinity', 'invalid-date', 'empty-bank'])(
      'rejects %s without changing balances, receipts or sale', async (scenario) => {
        const valid = await collectionInput();
        const original = valid.distribuciones[0];
        const input = {
          ...valid, distribuciones: [{ ...original }], fechaReconciliacion: undefined as string | undefined,
        };
        if (scenario === 'foreign-sale') input.ventaServicioId = foreignSaleId;
        if (scenario === 'foreign-bank') input.distribuciones[0].cuentaId = foreignBankId;
        if (scenario === 'foreign-payment') input.distribuciones[0].tipoPagoId = foreignPaymentId;
        if (scenario === 'negative-split') input.distribuciones = [
          { ...original, monto: -100 }, { ...original, monto: 1350 },
        ];
        if (scenario === 'nan') input.distribuciones[0].monto = NaN;
        if (scenario === 'infinity') input.distribuciones[0].monto = Infinity;
        if (scenario === 'invalid-date') input.fechaReconciliacion = 'not-a-date';
        if (scenario === 'empty-bank') input.distribuciones[0].cuentaId = '';
        const count = await prisma.reconciliacionServicio.count({ where: { tenantId } });
        const balances = await prisma.cuentaBancaria.findMany({
          where: { cuentaId: { in: [original.cuentaId, foreignBankId] } },
          orderBy: { cuentaId: 'asc' }, select: { cuentaId: true, saldo: true },
        });
        expect(await collect(entrypoint, input)).toMatchObject({
          success: false,
          error: { code: scenario.startsWith('foreign-') ? 'NOT_FOUND' : 'INVALID_INPUT' },
        });
        expect(await prisma.reconciliacionServicio.count({ where: { tenantId } })).toBe(count);
        expect(await prisma.cuentaBancaria.findMany({
          where: { cuentaId: { in: [original.cuentaId, foreignBankId] } },
          orderBy: { cuentaId: 'asc' }, select: { cuentaId: true, saldo: true },
        })).toEqual(balances);
        expect(await prisma.ventaServicios.findUniqueOrThrow({
          where: { ventaServicioId: valid.ventaServicioId },
        })).toMatchObject({ total: 1250, reconciliado: null });
      },
    );

    it('accepts one concurrent collection only and rejects a later duplicate', async () => {
      const input = await collectionInput();
      const results = await Promise.all([collect(entrypoint, input), collect(entrypoint, input)]);
      expect(results.map((result) => result.success).sort()).toEqual([false, true]);
      expect(await collect(entrypoint, input)).toMatchObject({
        success: false, error: { code: 'ALREADY_RECONCILED' },
      });
      expect(await prisma.reconciliacionServicio.count({
        where: { ventaServicioId: input.ventaServicioId },
      })).toBe(1);
      expect((await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: input.distribuciones[0].cuentaId },
      })).saldo).toBe(1250);
    });
  });

  it('serializes a service and web collection racing on the same sale', async () => {
    const input = await collectionInput();
    const results = await Promise.all([collect('service', input), collect('action', input)]);
    expect(results.map((result) => result.success).sort()).toEqual([false, true]);
    expect(results.find((result) => !result.success)?.error?.code).toBe('ALREADY_RECONCILED');
    expect(await prisma.reconciliacionServicio.count({
      where: { ventaServicioId: input.ventaServicioId },
    })).toBe(1);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: input.distribuciones[0].cuentaId },
    })).saldo).toBe(1250);
  });

});
