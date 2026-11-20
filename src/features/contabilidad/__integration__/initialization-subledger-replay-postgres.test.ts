import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { recolectarCandidatos } from '@/features/contabilidad-formal/services/replay-source-collector';
import { buildReplayManifestEvidence } from '@/features/contabilidad-formal/services/replay-source-manifest';
import { reconcileInitialSubledgerSettlements } from '@/features/contabilidad/services/initial-subledger-settlement-reconciliation';
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

describe('replay y conciliación de liquidaciones iniciales — PostgreSQL', { timeout: 120_000 }, () => {
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
      await prisma.prestamoCash.deleteMany({ where: { tenantId } });
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

  it('el recolector reconstruye cobro y pago externos con el evento del writer', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { request, bancoUsd, bancoCup, receivable, payable } = await seedInit(tenantId, clientId, vendorId);
    const rate = await seedRate('25', new Date('2026-11-10T00:00:00.000Z'));
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;

    const cobro = await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '40',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-1',
    });
    expect(cobro.success).toBe(true);
    const pago = await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoCup.cuentaId,
      monto: '200',
      fechaEfectiva: '2026-11-15',
      referencia: 'pago-1',
    });
    expect(pago.success).toBe(true);

    const candidatos = await recolectarCandidatos(tenantId);
    const candidatoCobro = candidatos.find((c) => c.origenTipo === 'cobro_cxc_externo');
    expect(candidatoCobro).toBeDefined();
    expect(candidatoCobro?.causaOmision).toBeUndefined();
    expect(candidatoCobro?.evento).toMatchObject({
      tipo: 'COBRO_CXC',
      moneda: 'USD',
      monedaFuncional: 'CUP',
      descripcion: 'Cobro de cuenta por cobrar inicial',
      medioCobro: 'BANCOS',
      fecha: new Date('2026-11-15T00:00:00.000Z'),
    });
    expect(String(candidatoCobro?.evento.monto)).toBe('40');
    expect(String(candidatoCobro?.evento.montoFuncional)).toBe('1000.0000');
    expect(String(candidatoCobro?.evento.tasaCambio)).toBe('25');
    expect(candidatoCobro?.evento.fxEvidenceFingerprint).toBe(
      (await prisma.reconciliacionVenta.findFirstOrThrow({ where: { tenantId } })).fxEvidenceFingerprint,
    );
    expect(candidatoCobro?.evento.auxiliares?.diferenciaFx).toBe('40');
    expect(candidatoCobro?.origenId).toBe(
      (await prisma.reconciliacionVenta.findFirstOrThrow({ where: { tenantId } })).reconciliacionId,
    );

    const candidatoPago = candidatos.find((c) => c.origenTipo === 'pago_cxp_externo');
    expect(candidatoPago).toBeDefined();
    expect(candidatoPago?.causaOmision).toBeUndefined();
    expect(candidatoPago?.evento).toMatchObject({
      tipo: 'PAGO_CXP',
      moneda: 'CUP',
      monedaFuncional: 'CUP',
      descripcion: 'Pago de cuenta por pagar inicial',
      medioCobro: 'BANCOS',
      fecha: new Date('2026-11-15T00:00:00.000Z'),
    });
    expect(String(candidatoPago?.evento.monto)).toBe('200');
    expect(String(candidatoPago?.evento.montoFuncional)).toBe('200.0000');
    expect(candidatoPago?.evento.auxiliares?.diferenciaFx).toBe('0');
    expect(
      (await prisma.pagoCuentaPorPagar.findFirstOrThrow({ where: { tenantId } })).cuentaId,
    ).toBe(bancoCup.cuentaId);

    // Los asientos reales del writer coinciden con los eventos reconstruidos.
    const asientoCobro = await settlementAsiento(tenantId, 'cobro_cxc_externo');
    expect(lineSummary(asientoCobro.lineas)).toEqual([
      { cuentaId: await roleAccountId(tenantId, 'BANCOS'), debe: '1000', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'CXC_CLIENTES'), debe: '0', haber: '960' },
      { cuentaId: await roleAccountId(tenantId, 'DIFERENCIA_CAMBIARIA_INGRESO'), debe: '0', haber: '40' },
    ]);
    const asientoPago = await settlementAsiento(tenantId, 'pago_cxp_externo');
    expect(lineSummary(asientoPago.lineas)).toEqual([
      { cuentaId: await roleAccountId(tenantId, 'CXP_PROVEEDORES'), debe: '200', haber: '0' },
      { cuentaId: await roleAccountId(tenantId, 'BANCOS'), debe: '0', haber: '200' },
    ]);

    // El manifiesto clasifica los dos orígenes nuevos.
    const { REPLAY_COLLECTOR_QUERY_IDS } = await import(
      '@/features/contabilidad-formal/services/replay-source-manifest'
    );
    const evidencia = buildReplayManifestEvidence(
      candidatos.map(({ evento }) => ({ tipo: evento.tipo, origenTipo: evento.origen.tipo })),
      [...REPLAY_COLLECTOR_QUERY_IDS],
    );
    expect(evidencia.unclassifiedCount).toBe(0);

    // El replay de la inicialización sigue pasando tras las liquidaciones.
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('la conciliación de liquidaciones pasa y detecta el descuadre', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const { bancoUsd, bancoCup, receivable, payable } = await seedInit(tenantId, clientId, vendorId);
    await seedRate('25', new Date('2026-11-10T00:00:00.000Z'));
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '40',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-1',
    });
    await settlePayable({
      cuentaPorPagarId: payable.cuentaPorPagarId,
      cuentaId: bancoCup.cuentaId,
      monto: '200',
      fechaEfectiva: '2026-11-15',
      referencia: 'pago-1',
    });

    async function entrada() {
      const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
      const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
      const cobros = await prisma.reconciliacionVenta.findMany({ where: { tenantId } });
      const pagos = await prisma.pagoCuentaPorPagar.findMany({ where: { tenantId } });
      return {
        cuentas: [
          {
            tipo: 'CXC' as const, id: cxc.id,
            monedaOriginal: cxc.monedaOriginal!, monedaFuncional: cxc.monedaFuncional!,
            montoDeuda: cxc.montoDeuda.toString(), montoDeudaFuncional: cxc.montoDeudaFuncional!.toString(),
            montoPagado: cxc.montoPagado.toString(), montoPagadoFuncional: cxc.montoPagadoFuncional!.toString(),
            estado: cxc.estado,
          },
          {
            tipo: 'CXP' as const, id: cxp.cuentaPorPagarId,
            monedaOriginal: cxp.monedaOriginal!, monedaFuncional: cxp.monedaFuncional!,
            montoDeuda: cxp.montoDeuda.toString(), montoDeudaFuncional: cxp.montoDeudaFuncional!.toString(),
            montoPagado: cxp.montoPagado.toString(), montoPagadoFuncional: cxp.montoPagadoFuncional!.toString(),
            saldoPendiente: cxp.saldoPendiente.toString(), estado: cxp.estado,
          },
        ],
        liquidaciones: [
          ...cobros.map((row) => ({
            id: row.reconciliacionId, cuentaId: row.cuentaPorCobrarId!, tipo: 'CXC' as const,
            moneda: row.moneda, montoOriginal: row.monto.toString(),
            montoFuncional: row.montoConvertido!.toString(), fecha: row.fechaReconciliacion,
            creadoEn: row.createdAt, tasaCambio: row.tasaCambio, rateEffectiveAt: row.rateEffectiveAt,
            fxProvenanceKind: row.fxProvenanceKind, fxProvenanceSource: row.fxProvenanceSource,
            fxCatalogRateId: row.fxCatalogRateId, fxEvidenceFingerprint: row.fxEvidenceFingerprint,
            fxEvidenceVersion: row.fxEvidenceVersion,
          })),
          ...pagos.map((row) => ({
            id: row.pagoCuentaPorPagarId, cuentaId: row.cuentaPorPagarId, tipo: 'CXP' as const,
            moneda: row.moneda, montoOriginal: row.monto.toString(),
            montoFuncional: row.montoFuncional!.toString(), fecha: row.fechaPago,
            creadoEn: row.createdAt, tasaCambio: row.tasaCambio, rateEffectiveAt: row.rateEffectiveAt,
            fxProvenanceKind: row.fxProvenanceKind, fxProvenanceSource: row.fxProvenanceSource,
            fxCatalogRateId: row.fxCatalogRateId, fxEvidenceFingerprint: row.fxEvidenceFingerprint,
            fxEvidenceVersion: row.fxEvidenceVersion,
          })),
        ],
      };
    }

    expect(reconcileInitialSubledgerSettlements(await entrada())).toEqual({
      conciliado: true, discrepancias: [],
    });

    // Descuadre en el monto pagado de la CxC.
    await prisma.cuentaPorCobrar.update({
      where: { id: receivable.id }, data: { montoPagado: 41 },
    });
    const descuadre = reconcileInitialSubledgerSettlements(await entrada());
    expect(descuadre.conciliado).toBe(false);
    expect(descuadre.discrepancias.join(' ')).toMatch(/montoPagado/);
    await prisma.cuentaPorCobrar.update({
      where: { id: receivable.id }, data: { montoPagado: 40 },
    });

    // Descuadre en el saldo pendiente de la CxP.
    await prisma.cuentaPorPagar.update({
      where: { cuentaPorPagarId: payable.cuentaPorPagarId }, data: { saldoPendiente: 10 },
    });
    const descuadreCxp = reconcileInitialSubledgerSettlements(await entrada());
    expect(descuadreCxp.conciliado).toBe(false);
    expect(descuadreCxp.discrepancias.join(' ')).toMatch(/saldoPendiente/);
  });

  it('el cobro por el writer decrementa el principal del PrestamoCash y lo marca PAGADO al liquidar', async () => {
    const { tenantId, clientId } = await makeTenant();
    const request = {
      idempotencyKey: `settle-prestamo-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      tasas: { USD: '24' },
      cuentas: [{
        nombreCuenta: 'Cuenta USD', nombreBanco: 'Banco QA',
        numeroCuenta: `SETP-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'USD', saldoInicial: '0',
      }],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-prestamo', clienteId: clientId, moneda: 'USD', saldo: '100', tasaInteres: '12', tasaInteresMoratorio: '18', fechaVencimiento: '2027-06-01' }],
    };
    const first = await initialize(request);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const bancoUsd = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'USD' } });
    await prisma.cuentaBancaria.update({ where: { cuentaId: bancoUsd.cuentaId }, data: { saldo: 1000 } });
    const receivable = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    await seedRate('25', new Date('2026-11-10T00:00:00.000Z'));
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;

    const cobroParcial = await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '40',
      fechaEfectiva: '2026-11-15',
      referencia: 'cobro-prestamo-1',
    });
    expect(cobroParcial.success).toBe(true);
    let prestamo = await prisma.prestamoCash.findFirstOrThrow({ where: { tenantId } });
    expect(prestamo.cashInterestPrincipalRemaining.toString()).toBe('60');
    expect(prestamo.estado).toBe('ACTIVO');
    expect((await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } })).estado).toBe('PARCIAL');

    const cobroFinal = await settleReceivable({
      cuentaPorCobrarId: receivable.id,
      cuentaId: bancoUsd.cuentaId,
      tipoPagoId,
      monto: '60',
      fechaEfectiva: '2026-11-20',
      referencia: 'cobro-prestamo-2',
    });
    expect(cobroFinal.success).toBe(true);
    prestamo = await prisma.prestamoCash.findFirstOrThrow({ where: { tenantId } });
    expect(prestamo.cashInterestPrincipalRemaining.toString()).toBe('0');
    expect(prestamo.estado).toBe('PAGADO');
    expect((await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } })).estado).toBe('PAGADA');

    // El replay sigue intacto tras cobrar: la identidad no depende del saldo vivo.
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    expect(await prisma.prestamoCash.count({ where: { tenantId } })).toBe(1);
  });
});
