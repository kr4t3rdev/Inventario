import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

/**
 * @description Builds a persisted foreign-currency valuation fixture with its domain fingerprint.
 * @param {number} originalAmount - Original obligation amount in USD.
 * @param {number} functionalAmount - Verified obligation amount in CUP.
 * @returns {object} FX columns compatible with receivable and payable records.
 */
function createFxFixture(originalAmount: number, functionalAmount: number) {
  const rateEffectiveAt = new Date('2097-01-01T00:00:00.000Z');
  const evidence = buildAppliedFxEvidence({
    originalAmount,
    originalCurrency: 'USD',
    functionalCurrency: 'CUP',
    exchangeRate: 25,
    convertedAmount: functionalAmount,
    rateEffectiveAt,
    source: 'period-continuity-integration',
  });
  return {
    monedaOriginal: 'USD',
    monedaFuncional: 'CUP',
    tasaCambio: '25',
    rateEffectiveAt,
    fxProvenanceKind: evidence.fxProvenanceKind,
    fxProvenanceSource: evidence.fxProvenanceSource,
    fxCatalogRateId: null,
    fxEvidenceJson: {
      ...evidence,
      originalAmount: originalAmount.toFixed(4),
      originalCurrency: 'USD',
      functionalAmount: functionalAmount.toFixed(4),
      functionalCurrency: 'CUP',
      exchangeRate: '25.0000000000',
      rateEffectiveAt: rateEffectiveAt.toISOString(),
    },
    fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
    fxEvidenceVersion: evidence.fxEvidenceVersion,
  };
}

describe('period continuity checkpoints — PostgreSQL', { timeout: 90_000 }, () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let tenantId = '';
  let otherTenantId = '';
  let otherCustomerId = '';
  let customerId = '';
  let receivableId = '';
  let payableId = '';
  let currencyCreated = false;
  const unique = crypto.randomUUID().replaceAll('-', '');

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      currencyCreated = true;
    }

    const tenant = await prisma.tenant.create({ data: { nombre: `Continuity ${unique}` } });
    tenantId = tenant.tenantId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: `test-${unique}` },
    });
    const customer = await prisma.cliente.create({
      data: { tenantId, nombre: `Continuity customer ${unique}` },
    });
    customerId = customer.clienteId;
    const receivable = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: customerId,
        montoDeuda: '12',
        montoPagado: '0',
        montoDeudaFuncional: '300',
        montoPagadoFuncional: '0',
        ...createFxFixture(12, 300),
        estado: 'PENDIENTE',
      },
    });
    receivableId = receivable.id;
    const payable = await prisma.cuentaPorPagar.create({
      data: {
        tenantId,
        numeroFactura: `CONT-${unique}`,
        montoDeuda: '45',
        montoPagado: '0',
        saldoPendiente: '45',
        montoDeudaFuncional: '1125',
        montoPagadoFuncional: '0',
        ...createFxFixture(45, 1125),
        moneda: 'USD',
        tipo: 'compra',
        estado: 'PENDIENTE',
      },
    });
    payableId = payable.cuentaPorPagarId;

    const otherTenant = await prisma.tenant.create({
      data: { nombre: `Continuity other tenant ${unique}` },
    });
    otherTenantId = otherTenant.tenantId;
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId: otherTenantId, functionalCurrencyCode: 'CUP', updatedBy: `test-${unique}` },
    });
    const otherCustomer = await prisma.cliente.create({
      data: { tenantId: otherTenantId, nombre: `Other continuity customer ${unique}` },
    });
    otherCustomerId = otherCustomer.clienteId;
    await prisma.cuentaPorCobrar.create({
      data: {
        tenantId: otherTenantId,
        clienteId: otherCustomerId,
        montoDeuda: '999',
        montoPagado: '0',
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
        estado: 'PENDIENTE',
      },
    });
    await prisma.cuentaPorPagar.create({
      data: {
        tenantId: otherTenantId,
        numeroFactura: `OTHER-CONT-${unique}`,
        montoDeuda: '888',
        montoPagado: '0',
        saldoPendiente: '888',
        moneda: 'CUP',
        tipo: 'compra',
        estado: 'PENDIENTE',
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (otherTenantId) {
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.cliente.deleteMany({ where: { clienteId: otherCustomerId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId: otherTenantId } });
    }
    if (tenantId) {
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { clienteId: customerId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "financial_auxiliary_checkpoints" DISABLE TRIGGER ALL',
      );
      try {
        await prisma.financialAuxiliaryCheckpoint.deleteMany({ where: { tenantId } });
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "financial_auxiliary_checkpoints" ENABLE TRIGGER ALL',
        );
      }
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (currencyCreated) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    await prisma.$disconnect();
  });

  it('carries CxC and CxP across closed periods and rejects changes after a checkpoint', async () => {
    const [serviceModule, checkpointModule, lockModule, hashModule] = await Promise.all([
      import('@/lib/services/apertura-periodo-service'),
      import('@/features/contabilidad/services/financial-auxiliary-checkpoint-service'),
      import('@/features/contabilidad/services/accounting-tenant-lock-service'),
      import('@/features/contabilidad/services/immutable-financial-evidence'),
    ]);
    const openingService = serviceModule.AperturaPeriodoService;
    const createPeriod = async (month: number, state: 'CERRADO' | 'APROBADO' | 'ABIERTO') => {
      const inicio = new Date(Date.UTC(2097, month, 1));
      const fin = new Date(Date.UTC(2097, month + 1, 0, 23, 59, 59));
      const period = await prisma.periodoContable.create({
        data: { tenantId, tipo: 'MENSUAL', estado: state, fechaInicio: inicio, fechaFin: fin },
      });
      return period;
    };
    const captureClose = async (periodId: string, fechaFin: Date) => prisma.$transaction(async (tx) => {
      await lockModule.acquireAccountingTenantLock(tx, tenantId);
      const checkpoint = await checkpointModule.captureFinancialAuxiliaryCheckpoint({
        tenantId,
        capturedBy: `test-${unique}`,
        schemaVersion: 3,
        client: tx,
        collectEvidence: async (client, cutoffAt) => {
          const auxiliaries = await checkpointModule.collectFinancialAuxiliaryEvidence({
            client, tenantId, cutoffAt, functionalCurrency: 'CUP',
          });
          return {
            functionalCurrency: 'CUP',
            balance: null,
            result: null,
            resultThrough: fechaFin.toISOString(),
            sourceFingerprints: Object.fromEntries(
              Object.entries(auxiliaries).map(([source, rows]) => [
                source, hashModule.hashImmutableFinancialEvidence(rows),
              ]),
            ),
            appliedFxEvidence: [],
            auxiliaries,
          };
        },
      });
      const payload = checkpoint.payload as { auxiliaries: unknown };
      const summary = {
        version: 1,
        continuityCheckpoint: {
          cutoffAt: checkpoint.cutoffAt.toISOString(),
          checkpointHash: checkpoint.hashIntegridad,
          auxiliaryHash: hashModule.hashImmutableFinancialEvidence(payload.auxiliaries),
        },
      };
      await tx.periodoContable.update({
        where: { periodoId: periodId },
        data: {
          estado: 'APROBADO',
          resumenJson: summary,
          hashIntegridad: hashModule.hashImmutableFinancialEvidence(summary),
        },
      });
      return checkpoint;
    }, { isolationLevel: 'Serializable' });
    const open = async (periodId: string) => prisma.$transaction(async (tx) => {
      await lockModule.acquireAccountingTenantLock(tx, tenantId);
      return openingService.createAperturaPeriodo(periodId, tenantId, `test-${unique}`, tx);
    }, { isolationLevel: 'Serializable' });

    const first = await createPeriod(0, 'APROBADO');
    const second = await createPeriod(1, 'ABIERTO');
    await captureClose(first.periodoId, first.fechaFin);
    const firstOpening = await open(second.periodoId);
    expect(firstOpening.origenPeriodoId).toBe(first.periodoId);
    expect(firstOpening.saldoCuentasCobrarInicial?.toString()).toBe('300');
    expect(firstOpening.saldoCuentasPagarInicial?.toString()).toBe('1125');
    expect(firstOpening.detalleJson).toMatchObject({
      balancesByOriginalCurrency: { receivables: { USD: '12' }, payables: { USD: '45' } },
    });
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);

    await prisma.cuentaPorCobrar.update({
      where: { id: receivableId },
      data: { montoPagado: '2', montoPagadoFuncional: '50', estado: 'PARCIAL' },
    });
    await prisma.cuentaPorPagar.update({
      where: { cuentaPorPagarId: payableId },
      data: { montoPagado: '15', saldoPendiente: '30', montoPagadoFuncional: '375', estado: 'PARCIAL' },
    });
    const third = await createPeriod(2, 'ABIERTO');
    await captureClose(second.periodoId, second.fechaFin);
    const secondOpening = await open(third.periodoId);
    expect(secondOpening.saldoCuentasCobrarInicial?.toString()).toBe('250');
    expect(secondOpening.saldoCuentasPagarInicial?.toString()).toBe('750');
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);

    const fourth = await createPeriod(3, 'ABIERTO');
    await captureClose(third.periodoId, third.fechaFin);
    await prisma.cuentaPorCobrar.update({
      where: { id: receivableId },
      data: { montoDeudaFuncional: '301' },
    });
    await expect(open(fourth.periodoId)).rejects.toMatchObject({
      code: 'APERTURA_SALDOS_NO_VERIFICABLES',
    });
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(2);
  });
});
