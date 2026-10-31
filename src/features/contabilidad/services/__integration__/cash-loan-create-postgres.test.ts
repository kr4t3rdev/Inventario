import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '../accounting-cash-operations-mutation-service';

const suffix = randomUUID().replaceAll('-', '');
const tenantAId = `it_loan_a_${suffix}`;
const tenantBId = `it_loan_b_${suffix}`;
const userAId = `it_user_a_${suffix}`;
const userBId = `it_user_b_${suffix}`;
const userDebtId = `it_debt_user_${suffix}`;
const auditControlUserId = `it_audit_control_${suffix}`;
const auditPaymentControlUserId = `it_audit_payment_control_${suffix}`;
const auditPaymentLoanUserId = `it_audit_payment_loan_${suffix}`;
const debtAuditControlUserId = `it_debt_audit_control_${suffix}`;
const auditFailureUserId = `it_audit_failure_${suffix}`;
const markerTable = `it_cash_loan_audit_marker_${suffix}`;
const auditFunction = `it_cash_loan_audit_failure_${suffix}`;
const auditTrigger = `it_cash_loan_audit_trigger_${suffix}`;

let clienteAId = '';
let clienteBId = '';
let cuentaAId = '';
let cuentaBId = '';
let cuentaNearBalanceId = '';
let cuentaAuditId = '';
let cuentaFxId = '';
let cuentaFxBId = '';
let tipoPagoId = '';
let tipoPagoBId = '';
let vendorAId = '';
let vendorBId = '';

const idempotencyKeys = [
  `same-key-${suffix}`,
  `near-a-${suffix}`,
  `near-b-${suffix}`,
  `foreign-client-${suffix}`,
  `foreign-bank-${suffix}`,
  `audit-positive-${suffix}`,
  `audit-failure-${suffix}`,
  `debt-same-key-${suffix}`,
  `debt-audit-positive-${suffix}`,
  `debt-audit-failure-${suffix}`,
];

type CreateOverrides = {
  tenantId?: string;
  clienteId?: string;
  cuentaBancariaId?: string;
  montoCapital?: number;
  moneda?: string;
  tasaCambioAlCrear?: number;
  idempotencyKey: string;
  userId?: string;
};

type DebtCreateOverrides = {
  tenantId?: string;
  proveedorId?: string;
  cuentaBancariaId?: string;
  montoCapital?: number;
  moneda?: string;
  tasaCambio?: number;
  idempotencyKey: string;
  userId?: string;
};

/**
 * @description Crea un préstamo cash mediante el servicio real dentro de un tenant de prueba.
 * @param overrides - Campos controlados para cada escenario.
 * @returns Préstamo persistido por el servicio de mutación.
 */
function createLoan(overrides: CreateOverrides) {
  const tenantId = overrides.tenantId ?? tenantAId;
  const user = {
    userId: overrides.userId ?? userAId,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { 'prestamos-cash': true },
  } as AuthenticatedUser;

  return withTestTenant(tenantId, () =>
    AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId: overrides.clienteId ?? clienteAId,
        montoCapital: overrides.montoCapital ?? 10,
        moneda: overrides.moneda ?? 'CUP',
        tasaInteres: 12,
        tasaInteresMoratorio: 24,
        tasaCambioAlCrear: overrides.tasaCambioAlCrear,
        cuentaBancariaId: overrides.cuentaBancariaId ?? cuentaAId,
        idempotencyKey: overrides.idempotencyKey,
      },
      user,
    }),
  );
}

/**
 * @description Crea una deuda cash con identidad tenant y clave controladas por la prueba.
 * @param overrides - Campos controlados para cada escenario.
 * @returns Deuda persistida por el servicio de mutación.
 */
function createDebt(overrides: DebtCreateOverrides) {
  const tenantId = overrides.tenantId ?? tenantAId;
  const user = {
    userId: overrides.userId ?? userDebtId,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { 'deudas-cash': true },
  } as AuthenticatedUser;

  return withTestTenant(tenantId, () =>
    AccountingCashOperationsMutationService.createCashDebt({
      input: {
        proveedorId: overrides.proveedorId ?? vendorAId,
        montoCapital: overrides.montoCapital ?? 10,
        moneda: overrides.moneda ?? 'CUP',
        tasaInteres: 12,
        tasaInteresMoratorio: 24,
        tasaCambio: overrides.tasaCambio,
        cuentaBancariaId: overrides.cuentaBancariaId ?? cuentaAId,
        idempotencyKey: overrides.idempotencyKey,
      },
      user,
    }),
  );
}

/**
 * @description Lee las cantidades y el saldo que prueban que el writer aplicó una sola mutación.
 * @param tenantId - Tenant dueño de las fixtures.
 * @returns Snapshot limitado a préstamos cash de la fixture.
 */
async function loanSnapshot(tenantId: string, accountId: string, userIds: string[]) {
  const [account, loans, receivables, reconciliations, audits] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: accountId },
      select: { saldo: true },
    }),
    prisma.prestamoCash.count({ where: { tenantId } }),
    prisma.cuentaPorCobrar.count({ where: { tenantId, tipoCuenta: 'PRESTAMO_CASH' } }),
    prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO' },
    }),
    prisma.auditLog.count({ where: { usuarioId: { in: userIds } } }),
  ]);
  return { saldo: account.saldo, loans, receivables, reconciliations, audits };
}

/**
 * @description Lee saldos y cardinalidades asociados a la deuda de prueba.
 * @param tenantId - Tenant dueño de las fixtures.
 * @param accountId - Cuenta bancaria afectada.
 * @param userIds - Usuarios cuyas auditorías se cuentan.
 * @returns Snapshot de deuda, CxP, reconciliación, saldo y auditoría.
 */
async function debtSnapshot(tenantId: string, accountId: string, userIds: string[]) {
  const [account, debts, payables, reconciliations, audits] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: accountId },
      select: { saldo: true },
    }),
    prisma.deudaCash.count({ where: { tenantId } }),
    prisma.cuentaPorPagar.count({ where: { tenantId, tipoDeuda: 'DEUDA_CASH' } }),
    prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' },
    }),
    prisma.auditLog.count({ where: { usuarioId: { in: userIds } } }),
  ]);
  return { saldo: account.saldo, debts, payables, reconciliations, audits };
}

describe('cash-loan create on isolated PostgreSQL', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({
      data: [
        { tenantId: tenantAId, nombre: 'cash-loan-it-a', slug: `cash-loan-it-a-${suffix}` },
        { tenantId: tenantBId, nombre: 'cash-loan-it-b', slug: `cash-loan-it-b-${suffix}` },
      ],
    });
    const now = new Date();
    await prisma.periodoContable.createMany({
      data: [tenantAId, tenantBId].map((tenantId) => ({
        tenantId,
        tipo: 'MENSUAL' as const,
        estado: 'ABIERTO' as const,
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
      })),
    });
    await prisma.moneda.createMany({
      data: [
        { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
        { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      ],
      skipDuplicates: true,
    });
    await prisma.tenantAccountingPolicy.createMany({
      data: [
        { tenantId: tenantAId, functionalCurrencyCode: 'CUP', updatedBy: userAId },
        { tenantId: tenantBId, functionalCurrencyCode: 'CUP', updatedBy: userBId },
      ],
    });
    const [clienteA, clienteB] = await Promise.all([
      prisma.cliente.create({ data: { tenantId: tenantAId, nombre: 'cash-loan-client-a' } }),
      prisma.cliente.create({ data: { tenantId: tenantBId, nombre: 'cash-loan-client-b' } }),
    ]);
    clienteAId = clienteA.clienteId;
    clienteBId = clienteB.clienteId;

    const [cuentaA, cuentaB, cuentaNear, cuentaAudit, cuentaFx, cuentaFxB] = await Promise.all([
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantAId, nombreBanco: 'it-bank-a', numeroCuenta: `a-${suffix}`, tipoCuenta: 'CORRIENTE', saldo: 500 },
      }),
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantBId, nombreBanco: 'it-bank-b', numeroCuenta: `b-${suffix}`, tipoCuenta: 'CORRIENTE', saldo: 500 },
      }),
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantAId, nombreBanco: 'it-bank-near', numeroCuenta: `near-${suffix}`, tipoCuenta: 'CORRIENTE', saldo: 100 },
      }),
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantAId, nombreBanco: 'it-bank-audit', numeroCuenta: `audit-${suffix}`, tipoCuenta: 'CORRIENTE', saldo: 50 },
      }),
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantAId, nombreBanco: 'it-bank-fx', numeroCuenta: `fx-${suffix}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: 100 },
      }),
      prisma.cuentaBancaria.create({
        data: { tenantId: tenantBId, nombreBanco: 'it-bank-fx-b', numeroCuenta: `fx-b-${suffix}`, tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: 100 },
      }),
    ]);
    cuentaAId = cuentaA.cuentaId;
    cuentaBId = cuentaB.cuentaId;
    cuentaNearBalanceId = cuentaNear.cuentaId;
    cuentaAuditId = cuentaAudit.cuentaId;
    cuentaFxId = cuentaFx.cuentaId;
    cuentaFxBId = cuentaFxB.cuentaId;

    const [vendorA, vendorB] = await Promise.all([
      prisma.vendor.create({ data: { tenantId: tenantAId, nombre: 'cash-loan-vendor-a' } }),
      prisma.vendor.create({ data: { tenantId: tenantBId, nombre: 'cash-loan-vendor-b' } }),
    ]);
    vendorAId = vendorA.vendorId;
    vendorBId = vendorB.vendorId;

    await prisma.tipoPago.createMany({
      data: [
        { tenantId: tenantAId, nombre: 'Transferencia' },
        { tenantId: tenantBId, nombre: 'Transferencia' },
      ],
    });
    const paymentType = await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId: tenantAId, nombre: 'Transferencia' },
      select: { tipoId: true },
    });
    tipoPagoId = paymentType.tipoId;
    const paymentTypeB = await prisma.tipoPago.findFirstOrThrow({
      where: { tenantId: tenantBId, nombre: 'Transferencia' },
      select: { tipoId: true },
    });
    tipoPagoBId = paymentTypeB.tipoId;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditFunction}"()`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${markerTable}"`);
    // Cash interest allocations are append-only financial evidence. Keep their
    // referenced fixtures in this explicitly disposable database rather than
    // bypassing the database immutability trigger during test cleanup.
    await prisma.$disconnect();
  });

  it('applies exact partial/final debt and loan payments, replay, and FX once', async () => {
    const loan = await createLoan({
      tenantId: tenantBId,
      clienteId: clienteBId,
      userId: userBId,
      idempotencyKey: `fx-loan-create-${suffix}`,
      cuentaBancariaId: cuentaFxBId,
      montoCapital: 0.05,
      moneda: 'USD',
      tasaCambioAlCrear: 300,
    });
    const debt = await createDebt({
      tenantId: tenantBId,
      proveedorId: vendorBId,
      userId: userBId,
      idempotencyKey: `fx-debt-create-${suffix}`,
      cuentaBancariaId: cuentaFxBId,
      montoCapital: 0.05,
      moneda: 'USD',
      tasaCambio: 300,
    });
    const loanUser = { userId: userBId, tenantId: tenantBId } as AuthenticatedUser;
    const debtUser = { userId: userBId, tenantId: tenantBId } as AuthenticatedUser;
    const loanPaymentInput = {
      id: loan.id,
      monto: 0.0123,
      cuentaId: cuentaFxBId,
      tipoPagoId: tipoPagoBId,
      moneda: 'USD',
      tasaCambio: 300,
      idempotencyKey: `loan-partial-${suffix}`,
    };
    const debtPaymentInput = {
      ...loanPaymentInput,
      id: debt.id,
      idempotencyKey: `debt-partial-${suffix}`,
    };

    const [loanPartialA, loanPartialB, debtPartialA, debtPartialB] = await Promise.all([
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: loanPaymentInput,
          user: loanUser,
        })),
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: loanPaymentInput,
          user: loanUser,
        })),
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: debtPaymentInput,
          user: debtUser,
        })),
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: debtPaymentInput,
          user: debtUser,
        })),
    ]);
    expect(loanPartialA.reconciliacionId).toBe(loanPartialB.reconciliacionId);
    expect(debtPartialA.reconciliacionId).toBe(debtPartialB.reconciliacionId);

    const loanPartial = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: loan.cuentaPorCobrarId },
    });
    const debtPartial = await prisma.cuentaPorPagar.findUniqueOrThrow({
      where: { cuentaPorPagarId: debt.cuentaPorPagarId },
    });
    expect(loanPartial.montoPagado.toFixed(4)).toBe('0.0123');
    expect(loanPartial.montoPagadoFuncional?.toFixed(4)).toBe('3.6900');
    expect(debtPartial.montoPagado.toFixed(4)).toBe('0.0123');
    expect(debtPartial.montoPagadoFuncional?.toFixed(4)).toBe('3.6900');

    const loanFinalInput = {
      ...loanPaymentInput,
      monto: 0.0377,
      idempotencyKey: `loan-final-${suffix}`,
    };
    const debtFinalInput = {
      ...debtPaymentInput,
      monto: 0.0377,
      idempotencyKey: `debt-final-${suffix}`,
    };
    const [loanFinal, debtFinal] = await Promise.all([
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: loanFinalInput,
          user: loanUser,
        })),
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: debtFinalInput,
          user: debtUser,
        })),
    ]);
    const [loanReplay, debtReplay] = await Promise.all([
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: loanFinalInput,
          user: loanUser,
        })),
      withTestTenant(tenantBId, () =>
        AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: debtFinalInput,
          user: debtUser,
        })),
    ]);
    expect(loanReplay.reconciliacionId).toBe(loanFinal.reconciliacionId);
    expect(debtReplay.reconciliacionId).toBe(debtFinal.reconciliacionId);
    await expect(withTestTenant(tenantBId, () =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({
        input: { ...loanFinalInput, monto: 0.0376 },
        user: loanUser,
      }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(withTestTenant(tenantBId, () =>
      AccountingCashOperationsMutationService.registerCashDebtPayment({
        input: { ...debtFinalInput, monto: 0.0376 },
        user: debtUser,
      }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const [loanPaid, debtPaid, account, paymentCount, auditCount] = await Promise.all([
      prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: loan.cuentaPorCobrarId } }),
      prisma.cuentaPorPagar.findUniqueOrThrow({ where: { cuentaPorPagarId: debt.cuentaPorPagarId } }),
      prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaFxBId } }),
      prisma.reconciliacionVenta.count({
        where: {
          idempotencyKey: {
            in: [loanPaymentInput.idempotencyKey, loanFinalInput.idempotencyKey,
              debtPaymentInput.idempotencyKey, debtFinalInput.idempotencyKey]
              .map((key) => `cash-payment:${key}`),
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          entidadId: {
            in: [loanPartialA.reconciliacionId, loanFinal.reconciliacionId,
              debtPartialA.reconciliacionId, debtFinal.reconciliacionId],
          },
        },
      }),
    ]);
    expect(loanPaid.montoPagado.toFixed(4)).toBe('0.0500');
    expect(loanPaid.montoPagadoFuncional?.toFixed(4)).toBe('15.0000');
    expect(debtPaid.montoPagado.toFixed(4)).toBe('0.0500');
    expect(debtPaid.montoPagadoFuncional?.toFixed(4)).toBe('15.0000');
    const paymentEvidence = await prisma.reconciliacionVenta.findMany({
      where: {
        idempotencyKey: {
          in: [loanPaymentInput.idempotencyKey, loanFinalInput.idempotencyKey,
            debtPaymentInput.idempotencyKey, debtFinalInput.idempotencyKey]
            .map((key) => `cash-payment:${key}`),
        },
      },
      select: {
        monto: true,
        montoConvertido: true,
        fxEvidenceFingerprint: true,
        fxEvidenceJson: true,
      },
    });
    expect(paymentEvidence).toHaveLength(4);
    for (const evidence of paymentEvidence) {
      expect(evidence.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(evidence.fxEvidenceJson).toMatchObject({
        originalAmount: evidence.monto.toFixed(4),
        functionalAmount: evidence.montoConvertido?.toFixed(4),
        fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
      });
    }
    expect(account.saldo).toBe(100);
    expect(paymentCount).toBe(4);
    expect(auditCount).toBe(4);
  });

  it('fails closed for loan and debt with legacy obligations lacking functional snapshots', async () => {
    const loan = await createLoan({
      tenantId: tenantBId,
      clienteId: clienteBId,
      userId: userBId,
      idempotencyKey: `legacy-fx-loan-${suffix}`,
      cuentaBancariaId: cuentaFxBId,
      montoCapital: 0.05,
      moneda: 'USD',
      tasaCambioAlCrear: 300,
    });
    const debt = await createDebt({
      tenantId: tenantBId,
      proveedorId: vendorBId,
      userId: userBId,
      idempotencyKey: `legacy-fx-debt-${suffix}`,
      cuentaBancariaId: cuentaFxBId,
      montoCapital: 0.05,
      moneda: 'USD',
      tasaCambio: 300,
    });
    await Promise.all([
      prisma.cuentaPorCobrar.update({
        where: { id: loan.cuentaPorCobrarId },
        data: { montoDeudaFuncional: null, montoPagadoFuncional: null, monedaFuncional: null },
      }),
      prisma.cuentaPorPagar.update({
        where: { cuentaPorPagarId: debt.cuentaPorPagarId },
        data: { montoDeudaFuncional: null, montoPagadoFuncional: null, monedaFuncional: null },
      }),
    ]);
    const before = {
      account: await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaFxBId },
        select: { saldo: true },
      }),
      loan: await prisma.cuentaPorCobrar.findUniqueOrThrow({
        where: { id: loan.cuentaPorCobrarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      debt: await prisma.cuentaPorPagar.findUniqueOrThrow({
        where: { cuentaPorPagarId: debt.cuentaPorPagarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      reconciliations: await prisma.reconciliacionVenta.count({
        where: { tenantId: tenantBId, tipoReconciliacion: { in: ['PRESTAMO_CASH', 'DEUDA_CASH'] } },
      }),
      audits: await prisma.auditLog.count({ where: { usuarioId: userBId } }),
    };
    const loanUser = { userId: userBId, tenantId: tenantBId } as AuthenticatedUser;
    const debtUser = { userId: userBId, tenantId: tenantBId } as AuthenticatedUser;
    await expect(withTestTenant(tenantBId, () =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({
        input: {
          id: loan.id,
          monto: 0.0123,
          cuentaId: cuentaFxBId,
          tipoPagoId: tipoPagoBId,
          moneda: 'USD',
          tasaCambio: 300,
          idempotencyKey: `legacy-fx-loan-payment-${suffix}`,
        },
        user: loanUser,
      }))).rejects.toMatchObject({ code: 'FX_EVIDENCE_REQUIRED' });
    await expect(withTestTenant(tenantBId, () =>
      AccountingCashOperationsMutationService.registerCashDebtPayment({
        input: {
          id: debt.id,
          monto: 0.0123,
          cuentaId: cuentaFxBId,
          tipoPagoId: tipoPagoBId,
          moneda: 'USD',
          tasaCambio: 300,
          idempotencyKey: `legacy-fx-debt-payment-${suffix}`,
        },
        user: debtUser,
      }))).rejects.toMatchObject({ code: 'FX_EVIDENCE_REQUIRED' });
    expect({
      account: await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaFxBId },
        select: { saldo: true },
      }),
      loan: await prisma.cuentaPorCobrar.findUniqueOrThrow({
        where: { id: loan.cuentaPorCobrarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      debt: await prisma.cuentaPorPagar.findUniqueOrThrow({
        where: { cuentaPorPagarId: debt.cuentaPorPagarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      reconciliations: await prisma.reconciliacionVenta.count({
        where: { tenantId: tenantBId, tipoReconciliacion: { in: ['PRESTAMO_CASH', 'DEUDA_CASH'] } },
      }),
      audits: await prisma.auditLog.count({ where: { usuarioId: userBId } }),
    }).toEqual(before);
  });

  it('replays a concurrent same-key request once and rejects changed-payload reuse', async () => {
    const [first, concurrentReplay] = await Promise.all([
      createLoan({ idempotencyKey: idempotencyKeys[0], montoCapital: 40 }),
      createLoan({ idempotencyKey: idempotencyKeys[0], montoCapital: 40 }),
    ]);

    expect(first.id).toBe(concurrentReplay.id);
    expect(await loanSnapshot(tenantAId, cuentaAId, [userAId])).toEqual({
      saldo: 460,
      loans: 1,
      receivables: 1,
      reconciliations: 1,
      audits: 1,
    });
    await expect(
      createLoan({ idempotencyKey: idempotencyKeys[0], montoCapital: 41 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await loanSnapshot(tenantAId, cuentaAId, [userAId])).toEqual({
      saldo: 460,
      loans: 1,
      receivables: 1,
      reconciliations: 1,
      audits: 1,
    });
  });

  it('prevents overdraft for different concurrent keys near the available balance', async () => {
    const results = await Promise.allSettled([
      createLoan({
        idempotencyKey: idempotencyKeys[1],
        cuentaBancariaId: cuentaNearBalanceId,
        montoCapital: 60,
      }),
      createLoan({
        idempotencyKey: idempotencyKeys[2],
        cuentaBancariaId: cuentaNearBalanceId,
        montoCapital: 50,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'VALIDATION_ERROR' },
    });
    const [account, committedLoans] = await Promise.all([
      prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaNearBalanceId },
        select: { saldo: true },
      }),
      prisma.prestamoCash.findMany({
        where: { tenantId: tenantAId, cuentaBancariaId: cuentaNearBalanceId },
        select: { montoCapital: true },
      }),
    ]);
    expect(committedLoans).toHaveLength(1);
    const committedAmount = Number(committedLoans[0].montoCapital);
    expect([50, 60]).toContain(committedAmount);
    expect(account.saldo).toBe(100 - committedAmount);
    expect(account.saldo).toBeGreaterThanOrEqual(0);
  });

  it('rejects foreign client and bank references without writes', async () => {
    const before = await prisma.prestamoCash.count({ where: { tenantId: tenantAId } });
    await expect(
      createLoan({ idempotencyKey: idempotencyKeys[3], clienteId: clienteBId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      createLoan({ idempotencyKey: idempotencyKeys[4], cuentaBancariaId: cuentaBId }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await prisma.prestamoCash.count({ where: { tenantId: tenantAId } })).toBe(before);
    expect(await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaBId },
      select: { saldo: true },
    })).toMatchObject({ saldo: 500 });
  });

  it('replays concurrent debt creates once and rejects changed-payload reuse', async () => {
    const before = await debtSnapshot(tenantAId, cuentaAId, [userDebtId]);
    const [first, concurrentReplay] = await Promise.all([
      createDebt({ idempotencyKey: idempotencyKeys[7], montoCapital: 75 }),
      createDebt({ idempotencyKey: idempotencyKeys[7], montoCapital: 75 }),
    ]);

    expect(first.id).toBe(concurrentReplay.id);
    expect(await debtSnapshot(tenantAId, cuentaAId, [userDebtId])).toEqual({
      saldo: before.saldo + 75,
      debts: before.debts + 1,
      payables: before.payables + 1,
      reconciliations: before.reconciliations + 1,
      audits: before.audits + 1,
    });
    await expect(
      createDebt({ idempotencyKey: idempotencyKeys[7], montoCapital: 76 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await debtSnapshot(tenantAId, cuentaAId, [userDebtId])).toEqual({
      saldo: before.saldo + 75,
      debts: before.debts + 1,
      payables: before.payables + 1,
      reconciliations: before.reconciliations + 1,
      audits: before.audits + 1,
    });
    const linked = await prisma.reconciliacionVenta.findFirstOrThrow({
      where: { tenantId: tenantAId, idempotencyKey: idempotencyKeys[7] },
      select: { deudaCashId: true, idempotencyPayloadHash: true },
    });
    expect(linked.deudaCashId).toBe(first.id);
    expect(linked.idempotencyPayloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects foreign vendor and bank references without debt or balance writes', async () => {
    const before = await debtSnapshot(tenantAId, cuentaAId, [userDebtId]);
    await expect(
      createDebt({ idempotencyKey: `foreign-vendor-${suffix}`, proveedorId: vendorBId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      createDebt({ idempotencyKey: `foreign-bank-${suffix}`, cuentaBancariaId: cuentaBId }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await debtSnapshot(tenantAId, cuentaAId, [userDebtId])).toEqual(before);
    expect(await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaBId },
      select: { saldo: true },
    })).toMatchObject({ saldo: 500 });
  });

  it('rolls back every writer effect when strict audit raises a SQL error', async () => {
    const paymentLoan = await createLoan({
      idempotencyKey: `audit-payment-create-${suffix}`,
      cuentaBancariaId: cuentaAuditId,
      montoCapital: 10,
      userId: auditPaymentLoanUserId,
    });
    await prisma.$executeRawUnsafe(`CREATE TABLE "${markerTable}" ("usuarioId" TEXT PRIMARY KEY)`);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${auditFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO "${markerTable}" ("usuarioId") VALUES (NEW."usuarioId");
        IF NEW."usuarioId" = '${auditFailureUserId}' THEN
          RAISE EXCEPTION 'AUDIT_FAIL_INTEGRATION' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${auditTrigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${auditFunction}"()
    `);

    await expect(
      createLoan({
        idempotencyKey: idempotencyKeys[5],
        cuentaBancariaId: cuentaAuditId,
        montoCapital: 5,
        userId: auditControlUserId,
      }),
    ).resolves.toMatchObject({ id: expect.any(String) });

    const paymentInput = {
      id: paymentLoan.id,
      monto: 0.0123,
      cuentaId: cuentaAuditId,
      tipoPagoId,
      moneda: 'CUP',
      idempotencyKey: `audit-payment-positive-${suffix}`,
    };
    const positivePayment = await withTestTenant(tenantAId, () =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({
        input: paymentInput,
        user: { userId: auditPaymentControlUserId, tenantId: tenantAId } as AuthenticatedUser,
      }),
    );
    expect(positivePayment.reconciliacionId).toEqual(expect.any(String));

    const paymentBefore = {
      account: await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaAuditId },
        select: { saldo: true },
      }),
      loan: await prisma.prestamoCash.findUniqueOrThrow({
        where: { id: paymentLoan.id },
        select: { estado: true },
      }),
      receivable: await prisma.cuentaPorCobrar.findUniqueOrThrow({
        where: { id: paymentLoan.cuentaPorCobrarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      reconciliations: await prisma.reconciliacionVenta.count({
        where: { prestamoCashId: paymentLoan.id },
      }),
      audits: await prisma.auditLog.count({
          where: { usuarioId: { in: [auditPaymentControlUserId, auditFailureUserId] } },
      }),
    };
    const markerBeforePayment = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(String(markerBeforePayment[0].count)).toBe('2');

    let paymentFailure: unknown;
    try {
      await withTestTenant(tenantAId, () =>
        AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: { ...paymentInput, idempotencyKey: `audit-payment-failure-${suffix}` },
          user: { userId: auditFailureUserId, tenantId: tenantAId } as AuthenticatedUser,
        }),
      );
    } catch (error) {
      paymentFailure = error;
    }
    expect(paymentFailure).toBeTruthy();
    expect(String(paymentFailure)).toContain('AUDIT_FAIL_INTEGRATION');
    expect(String(paymentFailure)).toContain('22012');
    const paymentAfter = {
      account: await prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: cuentaAuditId },
        select: { saldo: true },
      }),
      loan: await prisma.prestamoCash.findUniqueOrThrow({
        where: { id: paymentLoan.id },
        select: { estado: true },
      }),
      receivable: await prisma.cuentaPorCobrar.findUniqueOrThrow({
        where: { id: paymentLoan.cuentaPorCobrarId },
        select: { montoPagado: true, montoPagadoFuncional: true, estado: true },
      }),
      reconciliations: await prisma.reconciliacionVenta.count({
        where: { prestamoCashId: paymentLoan.id },
      }),
      audits: await prisma.auditLog.count({
        where: { usuarioId: { in: [auditControlUserId, auditFailureUserId] } },
      }),
    };
    const markerAfterPayment = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(paymentAfter).toEqual(paymentBefore);
    expect(markerAfterPayment[0].count).toBe(markerBeforePayment[0].count);

    const before = await loanSnapshot(
      tenantAId,
      cuentaAuditId,
      [auditControlUserId, auditFailureUserId],
    );
    const markerBefore = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(String(markerBefore[0].count)).toBe('2');

    let failure: unknown;
    try {
      await createLoan({
        idempotencyKey: idempotencyKeys[6],
        cuentaBancariaId: cuentaAuditId,
        montoCapital: 7,
        userId: auditFailureUserId,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeTruthy();
    expect(String(failure)).toContain('AUDIT_FAIL_INTEGRATION');
    expect(String(failure)).toContain('22012');

    const after = await loanSnapshot(
      tenantAId,
      cuentaAuditId,
      [auditControlUserId, auditFailureUserId],
    );
    const markerAfter = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(after).toEqual(before);
    expect(markerAfter[0].count).toBe(markerBefore[0].count);

    await expect(
      createDebt({
        idempotencyKey: idempotencyKeys[8],
        cuentaBancariaId: cuentaAuditId,
        montoCapital: 5,
        userId: debtAuditControlUserId,
      }),
    ).resolves.toMatchObject({ id: expect.any(String) });
    const debtBefore = await debtSnapshot(
      tenantAId,
      cuentaAuditId,
      [debtAuditControlUserId, auditFailureUserId],
    );
    const debtMarkerBefore = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(String(debtMarkerBefore[0].count)).toBe('3');

    let debtFailure: unknown;
    try {
      await createDebt({
        idempotencyKey: idempotencyKeys[9],
        cuentaBancariaId: cuentaAuditId,
        montoCapital: 7,
        userId: auditFailureUserId,
      });
    } catch (error) {
      debtFailure = error;
    }
    expect(debtFailure).toBeTruthy();
    expect(String(debtFailure)).toContain('AUDIT_FAIL_INTEGRATION');
    expect(String(debtFailure)).toContain('22012');
    expect(await debtSnapshot(
      tenantAId,
      cuentaAuditId,
      [debtAuditControlUserId, auditFailureUserId],
    )).toEqual(debtBefore);
    const debtMarkerAfter = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${markerTable}"`,
    );
    expect(debtMarkerAfter).toEqual(debtMarkerBefore);
  });
});
