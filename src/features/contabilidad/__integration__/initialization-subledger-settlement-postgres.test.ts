import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn().mockResolvedValue({}) },
}));

const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNonCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
const tenants: Array<{ tenantId: string; userId: string }> = [];
const tipoPagoByTenant = new Map<string, string>();
const tasas: string[] = [];
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let settleReceivable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialReceivableAction;
let settlePayable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialPayableAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA liquidación', email: `qa-settle-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA liquidación', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  const clientId = (await prisma.cliente.create({ data: { tenantId, nombre: 'Cliente QA' } })).clienteId;
  const vendorId = (await prisma.vendor.create({ data: { tenantId, nombre: 'Proveedor QA' } })).vendorId;
  const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia QA', requiereCuenta: false } });
  tipoPagoByTenant.set(tenantId, tipoPago.tipoId);
  tenants.push({ tenantId, userId });
  return { tenantId, user, clientId, vendorId };
}

async function seedRate(tasa: string, fechaVigencia: Date) {
  const row = await prisma.tasaCambio.create({
    data: { monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa, fechaVigencia },
  });
  tasas.push(row.tasaId);
  return row;
}

async function roleAccountId(tenantId: string, rol: string) {
  return (await prisma.cuentaRolTenant.findUniqueOrThrow({
    where: { tenantId_rol: { tenantId, rol } },
  })).cuentaId;
}

async function settlementAsiento(tenantId: string, origenTipo: string) {
  return prisma.asiento.findFirstOrThrow({
    where: { tenantId, origenTipo },
    include: { lineas: { orderBy: { orden: 'asc' } } },
  });
}

function lineSummary(lineas: Array<{ cuentaId: string; debe: unknown; haber: unknown }>) {
  return lineas.map((line) => ({
    cuentaId: line.cuentaId,
    debe: line.debe.toString(),
    haber: line.haber.toString(),
  }));
}

describe('liquidación de CxC/CxP iniciales — PostgreSQL', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    ({ settleInitialReceivableAction: settleReceivable, settleInitialPayableAction: settlePayable } =
      await import('@/features/contabilidad/actions-subledger-settlement'));
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      cupCreated = true;
    }
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'USD' } }))) {
      await prisma.moneda.create({ data: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' } });
      usdCreated = true;
    }
  });

  afterAll(async () => {
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    if (previousNonCashMode === undefined) delete process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
    else process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = previousNonCashMode;
    for (const { tenantId, userId } of tenants) {
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
      await prisma.pagoCuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { tenantId } });
      await prisma.vendor.deleteMany({ where: { tenantId } });
      await prisma.tipoPago.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { userId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (tasas.length) await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasas } } });
    if (cupCreated) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    if (usdCreated) await prisma.moneda.delete({ where: { codigo: 'USD' } });
    await prisma.$disconnect();
  });

  async function seedInit(tenantId: string, clientId: string, vendorId: string) {
    const request = {
      idempotencyKey: `settle-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      tasas: { USD: '24' },
      cuentas: [
        {
          nombreCuenta: 'Cuenta USD', nombreBanco: 'Banco QA',
          numeroCuenta: `SET-U-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
          moneda: 'USD', saldoInicial: '0',
        },
        {
          nombreCuenta: 'Cuenta CUP', nombreBanco: 'Banco QA',
          numeroCuenta: `SET-C-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
          moneda: 'CUP', saldoInicial: '0',
        },
      ],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-usd', clienteId: clientId, moneda: 'USD', saldo: '100' }],
      cuentasPorPagar: [{ referenciaFila: 'cxp-cup', proveedorId: vendorId, moneda: 'CUP', saldo: '500' }],
    };
    const first = await initialize(request);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const bancoUsd = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'USD' } });
    const bancoCup = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'CUP' } });
    await prisma.cuentaBancaria.update({ where: { cuentaId: bancoUsd.cuentaId }, data: { saldo: 1000 } });
    await prisma.cuentaBancaria.update({ where: { cuentaId: bancoCup.cuentaId }, data: { saldo: 1000 } });
    const receivable = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    const payable = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
    return { request, bancoUsd, bancoCup, receivable, payable };
  }

  it('cobra parcial en divisa con tasa del catálogo, diferencia FX y asiento', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { request, bancoUsd, receivable } = await seedInit(tenantId, clientId, vendorId);
    const rate = await seedRate('25', new Date('2026-11-10T00:00:00.000Z'));
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;

    const result = await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '40',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-1',
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result));
    expect(result.data).toMatchObject({
      aplicadoOriginal: '40.0000',
      aplicadoFuncional: '960.0000',
      pagadoFuncional: '1000.0000',
      diferenciaFuncional: '40.0000',
      remanenteOriginal: '60.0000',
      remanenteFuncional: '1440.0000',
      estado: 'PARCIAL',
    });

    const reconciliacion = await prisma.reconciliacionVenta.findFirstOrThrow({ where: { tenantId } });
    expect(reconciliacion.ventaId).toBeNull();
    expect(reconciliacion.cuentaPorCobrarId).toBe(receivable.id);
    expect(reconciliacion.monto.toString()).toBe('40');
    expect(reconciliacion.moneda).toBe('USD');
    expect(reconciliacion.montoConvertido?.toString()).toBe('1000');
    expect(reconciliacion.tasaCambio?.toString()).toBe('25');
    expect(reconciliacion.fxCatalogRateId).toBe(rate.tasaId);
    expect(reconciliacion.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(reconciliacion.idempotencyKey).toBe('cobro-1');

    const updated = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    expect(updated.montoPagado.toString()).toBe('40');
    expect(updated.montoPagadoFuncional?.toString()).toBe('960');
    expect(updated.estado).toBe('PARCIAL');
    expect((await prisma.cuentaBancaria.findFirstOrThrow({ where: { cuentaId: bancoUsd.cuentaId } })).saldo).toBe(1040);

    const asiento = await settlementAsiento(tenantId, 'cobro_cxc_externo');
    expect(lineSummary(asiento.lineas)).toEqual([
      { cuentaId: await roleAccountId(tenantId, 'BANCOS'), debe: '1000', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'CXC_CLIENTES'), debe: '0', haber: '960' },
      { cuentaId: await roleAccountId(tenantId, 'DIFERENCIA_CAMBIARIA_INGRESO'), debe: '0', haber: '40' },
    ]);

    // El segundo cobro liquida y el replay de la inicialización sigue pasando.
    const second = await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '60',
      fechaEfectiva: '2026-11-20',
      referencia: 'cobro-2',
    });
    expect(second.success).toBe(true);
    if (!second.success) throw new Error(JSON.stringify(second));
    expect(second.data).toMatchObject({ estado: 'PAGADA', remanenteOriginal: '0.0000', diferenciaFuncional: '60.0000' });
    expect((await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } })).estado).toBe('PAGADA');

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('paga parcial y total en la misma moneda con asientos y saldos', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { bancoCup, payable } = await seedInit(tenantId, clientId, vendorId);

    const first = await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoCup.cuentaId,
      monto: '200',
      fechaEfectiva: '2026-11-15',
      referencia: 'pago-1',
    });
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    expect(first.data).toMatchObject({
      aplicadoFuncional: '200.0000',
      diferenciaFuncional: '0.0000',
      remanenteOriginal: '300.0000',
      estado: 'PARCIAL',
    });

    const pago = await prisma.pagoCuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
    expect(pago.numeroTransaccion).toBe('pago-1');
    expect(pago.moneda).toBe('CUP');
    expect(pago.monto.toString()).toBe('200');
    expect(pago.montoFuncional?.toString()).toBe('200');
    expect(pago.fxProvenanceKind).toBe('SAME_CURRENCY');
    expect((await prisma.cuentaBancaria.findFirstOrThrow({ where: { cuentaId: bancoCup.cuentaId } })).saldo).toBe(800);

    const updated = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
    expect(updated.montoPagado.toString()).toBe('200');
    expect(updated.saldoPendiente.toString()).toBe('300');
    expect(updated.estado).toBe('PARCIAL');

    const asiento = await settlementAsiento(tenantId, 'pago_cxp_externo');
    expect(lineSummary(asiento.lineas)).toEqual([
      { cuentaId: await roleAccountId(tenantId, 'CXP_PROVEEDORES'), debe: '200', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'BANCOS'), debe: '0', haber: '200' },
    ]);

    const second = await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoCup.cuentaId,
      monto: '300',
      fechaEfectiva: '2026-11-20',
      referencia: 'pago-2',
    });
    expect(second.success).toBe(true);
    if (!second.success) throw new Error(JSON.stringify(second));
    expect(second.data).toMatchObject({ estado: 'PAGADA', remanenteOriginal: '0.0000' });
    expect((await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } })).estado).toBe('PAGADA');
  });

  it('paga en divisa con diferencia negativa (pérdida cambiaria)', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { bancoUsd } = await seedInit(tenantId, clientId, vendorId);
    await seedRate('25', new Date('2026-11-10T00:00:00.000Z'));
    // La CxP del seed es CUP: la convierto en USD para este caso.
    const payable = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
    await prisma.cuentaPorPagar.update({
      where: { cuentaPorPagarId: payable.cuentaPorPagarId },
      data: {
        monedaOriginal: 'USD', montoDeuda: 100, montoDeudaFuncional: 2400,
        saldoPendiente: 100, moneda: 'USD',
      },
    });

    const result = await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoUsd.cuentaId,
      monto: '40',
      fechaEfectiva: '2026-11-15',
      referencia: 'pago-usd-1',
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result));
    expect(result.data).toMatchObject({
      aplicadoFuncional: '960.0000',
      pagadoFuncional: '1000.0000',
      diferenciaFuncional: '-40.0000',
      estado: 'PARCIAL',
    });

    const asiento = await settlementAsiento(tenantId, 'pago_cxp_externo');
    expect(lineSummary(asiento.lineas)).toEqual([
      { cuentaId: await roleAccountId(tenantId, 'CXP_PROVEEDORES'), debe: '960', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'DIFERENCIA_CAMBIARIA_GASTO'), debe: '40', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'BANCOS'), debe: '0', haber: '1000' },
    ]);
  });

  it('rechaza la referencia duplicada y la divisa sin tasa sin persistir nada', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { bancoUsd, receivable } = await seedInit(tenantId, clientId, vendorId);
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    const base = {
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '10',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-dup',
    };
    const first = await settleReceivable(base);
    expect(first.success).toBe(true);
    const second = await settleReceivable(base);
    expect(second.success).toBe(false);
    if (second.success) throw new Error('se esperaba duplicado');
    expect(second.error.code).toBe('INITIAL_SETTLEMENT_DUPLICATE');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId } })).toBe(1);

    // Sin tasa en el catálogo, el cobro en divisa falla cerrado. La tasa es
    // global, así que se borran las sembradas por los tests anteriores.
    await prisma.tasaCambio.deleteMany({ where: { monedaOrigenId: 'USD', monedaDestino: 'CUP' } });
    const other = await makeTenant();
    const seeded = await seedInit(other.tenantId, other.clientId, other.vendorId);
    const noRate = await settleReceivable({
      cuentaPorCobrarId: seeded.receivable.id,
      cuentaId: seeded.bancoUsd.cuentaId,
      tipoPagoId: tipoPagoByTenant.get(other.tenantId)!,
      monto: '10',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-sin-tasa',
    });
    expect(noRate.success).toBe(false);
    if (noRate.success) throw new Error('se esperaba FX_REQUIRED');
    expect(noRate.error.code).toBe('INITIAL_SETTLEMENT_FX_REQUIRED');
    expect(await prisma.reconciliacionVenta.count({ where: { tenantId: other.tenantId } })).toBe(0);
  });

  it('rechaza el pago sin saldo bancario suficiente', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { bancoCup, payable } = await seedInit(tenantId, clientId, vendorId);
    await prisma.cuentaBancaria.update({ where: { cuentaId: bancoCup.cuentaId }, data: { saldo: 100 } });
    const result = await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoCup.cuentaId,
      monto: '200',
      fechaEfectiva: '2026-11-15',
      referencia: 'pago-sin-saldo',
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('se esperaba SALDO_INSUFICIENTE');
    expect(result.error.code).toBe('INITIAL_SETTLEMENT_SALDO_INSUFICIENTE');
    expect(await prisma.pagoCuentaPorPagar.count({ where: { tenantId } })).toBe(0);
    expect((await prisma.cuentaBancaria.findFirstOrThrow({ where: { cuentaId: bancoCup.cuentaId } })).saldo).toBe(100);
  });
});
