import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '../accounting-cash-operations-mutation-service';
import { construirHashAsientoV2 } from '@/features/contabilidad-formal/services/posting-engine';
import { validateHashChain } from '@/features/contabilidad-formal/services/hash-chain-integrity';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_cash_${suffix}`;
const userId = `formal_user_${suffix}`;
const debtIdempotencyKey = `formal-payment-${suffix}`;
const user = { userId, tenantId, tenantRole: 'manager' } as AuthenticatedUser;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const auditFailureFunction = 'formal_cash_audit_failure_' + suffix;
const auditFailureTrigger = 'formal_cash_audit_trigger_' + suffix;
const ledgerFailureFunction = 'formal_cash_ledger_failure_' + suffix;
const ledgerFailureTrigger = 'formal_cash_ledger_trigger_' + suffix;
const allocationFailureFunction = 'formal_cash_allocation_failure_' + suffix;
const allocationFailureTrigger = 'formal_cash_allocation_trigger_' + suffix;
let fixture: {
  bankId: string;
  paymentTypeId: string;
  debtId: string;
  loanBankId: string;
  loanId: string;
  vendorId: string;
  clientId: string;
  moratoryIncomeAccountId: string;
  moratoryExpenseAccountId: string;
};

/** @description Captures persisted writer side effects for atomic-failure assertions. */
async function readDebtSnapshot(
  idempotencyKey: string,
  actorId: string,
  debtId = fixture.debtId,
  bankId = fixture.bankId,
) {
  const [bank, payable, debt, reconciliation, auditCount, asientos, allocationCount] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: bankId }, select: { saldo: true } }),
    prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId, deudaCash: { id: debtId } }, select: { montoPagado: true, montoPagadoFuncional: true } }),
    prisma.deudaCash.findUniqueOrThrow({
      where: { id: debtId },
      select: {
        cashInterestPrincipalRemaining: true,
        cashInterestAccruedThroughDate: true,
        cashInterestOrdinaryCarry: true,
        cashInterestMoratoryCarry: true,
      },
    }),
    prisma.reconciliacionVenta.findFirst({ where: { tenantId, idempotencyKey: 'cash-payment:' + idempotencyKey }, select: { reconciliacionId: true } }),
    prisma.auditLog.count({ where: { usuarioId: actorId, entidad: 'PAGO_DEUDA' } }),
    prisma.asiento.findMany({ where: { tenantId }, orderBy: { tenantSequence: 'asc' }, include: { lineas: { orderBy: { orden: 'asc' } } } }),
    prisma.cashPaymentInterestAllocation.count({ where: { tenantId } }),
  ]);
  return {
    bankBalance: bank.saldo,
    paid: payable.montoPagado.toString(),
    paidFunctional: payable.montoPagadoFuncional?.toString() ?? null,
    interestPrincipal: debt.cashInterestPrincipalRemaining?.toString() ?? null,
    interestCheckpoint: debt.cashInterestAccruedThroughDate?.toISOString() ?? null,
    ordinaryCarry: debt.cashInterestOrdinaryCarry?.toString() ?? null,
    moratoryCarry: debt.cashInterestMoratoryCarry?.toString() ?? null,
    reconciliationId: reconciliation?.reconciliacionId ?? null,
    auditCount,
    allocationCount,
    ledger: asientos.map((row) => ({ id: row.asientoId, hash: row.hash, hashAnterior: row.hashAnterior, seq: row.tenantSequence?.toString() ?? null })),
  };
}

async function createInterestObligations() {
  const grantDate = new Date('2025-01-01T00:00:00.000Z');
  const maturityDate = new Date('2025-01-21T00:00:00.000Z');
  const [payable, receivable] = await Promise.all([
    prisma.cuentaPorPagar.create({
      data: {
        tenantId,
        numeroFactura: `interest-payable-${suffix}`,
        proveedorId: fixture.vendorId,
        proveedorNombre: 'formal-vendor',
        montoDeuda: 1000,
        montoPagado: 0,
        montoDeudaFuncional: 300000,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 300,
        saldoPendiente: 1000,
        moneda: 'USD',
        estado: 'PENDIENTE',
        tipo: 'compra',
        tipoDeuda: 'DEUDA_CASH',
        fechaEmision: grantDate,
        fechaVencimiento: maturityDate,
      },
    }),
    prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: fixture.clientId,
        numeroFactura: `interest-receivable-${suffix}`,
        montoDeuda: 1000,
        montoPagado: 0,
        montoOriginal: 1000,
        montoDeudaFuncional: 300000,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 300,
        estado: 'PENDIENTE',
        fechaVencimiento: maturityDate,
        tipoCuenta: 'PRESTAMO_CASH',
      },
    }),
  ]);
  const [debt, loan] = await Promise.all([
    prisma.deudaCash.create({
      data: {
        tenantId,
        proveedorId: fixture.vendorId,
        cuentaPorPagarId: payable.cuentaPorPagarId,
        montoCapital: 1000,
        moneda: 'USD',
        tasaInteres: 12,
        fechaVencimiento: maturityDate,
        createdById: userId,
        estado: 'ACTIVO',
        cuentaBancariaId: fixture.bankId,
        ordinaryAnnualRate: 12,
        moratoryAnnualRate: 24,
        cashInterestPolicyVersion: 1,
        cashInterestGrantDate: grantDate,
        cashInterestMaturityDate: maturityDate,
        cashInterestAccruedThroughDate: grantDate,
        cashInterestPrincipalRemaining: 1000,
        cashInterestOrdinaryCarry: 0,
        cashInterestMoratoryCarry: 0,
      },
    }),
    prisma.prestamoCash.create({
      data: {
        tenantId,
        clienteId: fixture.clientId,
        cuentaPorCobrarId: receivable.id,
        montoCapital: 1000,
        moneda: 'USD',
        tasaInteres: 12,
        fechaOtorgamiento: grantDate,
        fechaVencimiento: maturityDate,
        createdById: userId,
        estado: 'ACTIVO',
        tasaCambioAlCrear: 300,
        cuentaBancariaId: fixture.loanBankId,
        ordinaryAnnualRate: 12,
        moratoryAnnualRate: 24,
        cashInterestPolicyVersion: 1,
        cashInterestGrantDate: grantDate,
        cashInterestMaturityDate: maturityDate,
        cashInterestAccruedThroughDate: grantDate,
        cashInterestPrincipalRemaining: 1000,
        cashInterestOrdinaryCarry: 0,
        cashInterestMoratoryCarry: 0,
      },
    }),
  ]);
  return { debtId: debt.id, loanId: loan.id };
}


describe('cash debt payment formal posting on isolated PostgreSQL', () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const [identity] = await prisma.$queryRawUnsafe<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>("SELECT current_database() AS \"databaseName\", current_user AS \"roleName\", inet_server_port() AS \"serverPort\"");
    assertDisposableDatabaseIdentity(identity, process.env);
    await prisma.tenant.create({
      data: { tenantId, nombre: 'formal-cash-payment-it', slug: `formal-cash-payment-${suffix}` },
    });
    const now = new Date();
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
      },
    });
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
        fechaFin: new Date('2025-01-31T23:59:59.999Z'),
      },
    });
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2025-02-01T00:00:00.000Z'),
        fechaFin: new Date('2025-02-28T23:59:59.999Z'),
      },
    });
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
    await seedPlantillasGlobales(prisma as never);
    const [moratoryIncome, moratoryExpense] = await Promise.all([
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '4.6' } },
      }),
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '6.6' } },
      }),
    ]);
    await prisma.tenantLicense.create({
      data: {
        tenantId,
        activa: true,
        expiracion: new Date(Date.now() + 86_400_000),
        features: { 'contabilidad-formal': true },
      },
    });
    const [bank, loanBank, paymentType, vendor, client] = await Promise.all([
      prisma.cuentaBancaria.create({
        data: {
          tenantId,
          nombreBanco: 'formal-test-bank',
          numeroCuenta: `formal-${suffix}`,
          tipoCuenta: 'CORRIENTE',
          moneda: 'CUP',
          saldo: 10000,
        },
      }),
      prisma.cuentaBancaria.create({
        data: {
          tenantId,
          nombreBanco: 'formal-loan-bank',
          numeroCuenta: `formal-loan-${suffix}`,
          tipoCuenta: 'CORRIENTE',
          moneda: 'CUP',
          saldo: 0,
        },
      }),
      prisma.tipoPago.create({ data: { tenantId, nombre: `formal-payment-${suffix}` } }),
      prisma.vendor.create({ data: { tenantId, nombre: `formal-vendor-${suffix}` } }),
      prisma.cliente.create({ data: { tenantId, nombre: `formal-client-${suffix}` } }),
    ]);
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const payable = await prisma.cuentaPorPagar.create({
      data: {
        tenantId,
        numeroFactura: `formal-invoice-${suffix}`,
        proveedorId: vendor.vendorId,
        proveedorNombre: vendor.nombre,
        montoDeuda: 100,
        montoPagado: 0,
        montoDeudaFuncional: 30000,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 300,
        saldoPendiente: 100,
        moneda: 'USD',
        estado: 'PENDIENTE',
        tipo: 'servicio',
        tipoDeuda: 'DEUDA_CASH',
      },
    });
    await prisma.deudaCash.create({
      data: {
        tenantId,
        proveedorId: vendor.vendorId,
        cuentaPorPagarId: payable.cuentaPorPagarId,
        montoCapital: 100,
        moneda: 'USD',
        createdById: userId,
        estado: 'ACTIVO',
        ordinaryAnnualRate: 0,
        moratoryAnnualRate: 0,
        cashInterestPolicyVersion: 1,
        cashInterestGrantDate: todayDate,
        cashInterestAccruedThroughDate: todayDate,
        cashInterestPrincipalRemaining: 100,
        cashInterestOrdinaryCarry: 0,
        cashInterestMoratoryCarry: 0,
      },
    });
    await prisma.deudaCash.update({
      where: { cuentaPorPagarId: payable.cuentaPorPagarId },
      data: { cuentaBancariaId: bank.cuentaId },
    });
    const receivable = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: client.clienteId,
        numeroFactura: `formal-receivable-${suffix}`,
        montoDeuda: '0.0123',
        montoPagado: 0,
        montoOriginal: '0.0123',
        montoDeudaFuncional: '3.6900',
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 300,
        estado: 'PENDIENTE',
        tipoCuenta: 'PRESTAMO_CASH',
      },
    });
    const loan = await prisma.prestamoCash.create({
      data: {
        tenantId,
        clienteId: client.clienteId,
        cuentaPorCobrarId: receivable.id,
        montoCapital: '0.0123',
        moneda: 'USD',
        createdById: userId,
        tasaCambioAlCrear: 300,
        cuentaBancariaId: loanBank.cuentaId,
        ordinaryAnnualRate: 0,
        moratoryAnnualRate: 0,
        cashInterestPolicyVersion: 1,
        cashInterestGrantDate: todayDate,
        cashInterestAccruedThroughDate: todayDate,
        cashInterestPrincipalRemaining: '0.0123',
        cashInterestOrdinaryCarry: 0,
        cashInterestMoratoryCarry: 0,
      },
    });
    fixture = {
      bankId: bank.cuentaId,
      paymentTypeId: paymentType.tipoId,
      debtId: (await prisma.deudaCash.findUniqueOrThrow({
        where: { cuentaPorPagarId: payable.cuentaPorPagarId },
        select: { id: true },
      })).id,
      loanBankId: loanBank.cuentaId,
      loanId: loan.id,
      vendorId: vendor.vendorId,
      clientId: client.clienteId,
      moratoryIncomeAccountId: moratoryIncome.cuentaContableId,
      moratoryExpenseAccountId: moratoryExpense.cuentaContableId,
    };
    await prisma.$executeRawUnsafe("CREATE FUNCTION public.\"" + auditFailureFunction + "\"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.\"entidad\" = 'PAGO_DEUDA' AND NEW.\"usuarioId\" LIKE 'formal_audit_fail_%' THEN PERFORM 1 / 0; END IF; RETURN NEW; END $$");
    await prisma.$executeRawUnsafe("CREATE TRIGGER \"" + auditFailureTrigger + "\" BEFORE INSERT ON public.\"AuditLog\" FOR EACH ROW EXECUTE FUNCTION public.\"" + auditFailureFunction + "\"()");
    await prisma.$executeRawUnsafe("CREATE FUNCTION public.\"" + ledgerFailureFunction + "\"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.\"tenantId\" = '" + tenantId + "' AND NEW.\"origenTipo\" = 'reconciliacion_gasto' AND NEW.\"createdBy\" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'formal integration forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$");
    await prisma.$executeRawUnsafe("CREATE TRIGGER \"" + ledgerFailureTrigger + "\" BEFORE INSERT ON public.\"asientos\" FOR EACH ROW EXECUTE FUNCTION public.\"" + ledgerFailureFunction + "\"()");
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS \"" + auditFailureTrigger + "\" ON public.\"AuditLog\"");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS public.\"" + auditFailureFunction + "\"()");
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS \"" + ledgerFailureTrigger + "\" ON public.\"asientos\"");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS public.\"" + ledgerFailureFunction + "\"()");
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS \"" + allocationFailureTrigger + "\" ON public.\"cash_payment_interest_allocations\"");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS public.\"" + allocationFailureFunction + "\"()");
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
  });

  it('revierte los cambios del seed cuando existe una colisión sin rol asignado', async () => {
    const role = { tenantId, rol: 'INTERESES_MORATORIOS_GANADOS' };
    const diariesBefore = await prisma.diario.count({ where: { tenantId } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.cuentaRolTenant.delete({ where: { tenantId_rol: role } });
      await tx.cuentaContable.update({
        where: { cuentaContableId: fixture.moratoryIncomeAccountId },
        data: { esDeSistema: false },
      });
      await tx.diario.deleteMany({ where: { tenantId } });
      await seedPlanContable(tx as never, tenantId);
    })).rejects.toThrow('4.6');
    expect(await prisma.diario.count({ where: { tenantId } })).toBe(diariesBefore);
    expect(await prisma.cuentaRolTenant.findUnique({ where: { tenantId_rol: role } })).not.toBeNull();
  });

  it('preserva la asignación personalizada cuando el código predeterminado está ocupado', async () => {
    const rollback = new Error('rollback seed collision review');
    await expect(prisma.$transaction(async (tx) => {
      const role = { tenantId, rol: 'INTERESES_MORATORIOS_GANADOS' };
      await tx.cuentaRolTenant.update({
        where: { tenantId_rol: role }, data: { cuentaId: fixture.moratoryExpenseAccountId },
      });
      await tx.cuentaContable.update({
        where: { cuentaContableId: fixture.moratoryIncomeAccountId }, data: { esDeSistema: false },
      });
      await seedPlanContable(tx as never, tenantId);
      const mapping = await tx.cuentaRolTenant.findUniqueOrThrow({ where: { tenantId_rol: role } });
      expect(mapping.cuentaId).toBe(fixture.moratoryExpenseAccountId);
      throw rollback;
    })).rejects.toBe(rollback);
  });

  it('preserva la asignación y el nombre personalizados al resembrar', async () => {
    const rollback = new Error('rollback seed review');
    await expect(prisma.$transaction(async (tx) => {
      const role = { tenantId, rol: 'INTERESES_MORATORIOS_GANADOS' };
      await tx.cuentaRolTenant.update({
        where: { tenantId_rol: role },
        data: { cuentaId: fixture.moratoryExpenseAccountId },
      });
      await tx.cuentaContable.update({
        where: { cuentaContableId: fixture.moratoryIncomeAccountId },
        data: { nombre: 'Nombre personalizado' },
      });
      await seedPlanContable(tx as never, tenantId);
      const [mapping, account] = await Promise.all([
        tx.cuentaRolTenant.findUniqueOrThrow({ where: { tenantId_rol: role } }),
        tx.cuentaContable.findUniqueOrThrow({
          where: { cuentaContableId: fixture.moratoryIncomeAccountId },
        }),
      ]);
      expect(mapping.cuentaId).toBe(fixture.moratoryExpenseAccountId);
      expect(account.nombre).toBe('Nombre personalizado');
      throw rollback;
    })).rejects.toBe(rollback);
  });

  it('posts exactly one balanced, FX-evidenced journal with the cash payment and reuses it on idempotent replay', async () => {
    const input = {
      id: fixture.debtId,
      monto: 0.0123,
      cuentaId: fixture.bankId,
      tipoPagoId: fixture.paymentTypeId,
      moneda: 'USD',
      tasaCambio: 300,
      idempotencyKey: debtIdempotencyKey,
    };

    const first = await withTestTenant(tenantId, () =>
      AccountingCashOperationsMutationService.registerCashDebtPayment({ input, user }),
    );
    const second = await withTestTenant(tenantId, () =>
      AccountingCashOperationsMutationService.registerCashDebtPayment({ input, user }),
    );
    const asiento = await prisma.asiento.findUnique({
      where: {
        tenantId_origenTipo_origenId: {
          tenantId,
          origenTipo: 'reconciliacion_gasto',
          origenId: first.reconciliacionId,
        },
      },
      include: { lineas: { include: { cuenta: true } } },
    });
    const [bank, payable, journalCount] = await Promise.all([
      prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: fixture.bankId },
        select: { saldo: true },
      }),
      prisma.cuentaPorPagar.findFirstOrThrow({
        where: { tenantId, deudaCash: { id: fixture.debtId } },
        select: { montoPagado: true, montoPagadoFuncional: true },
      }),
      prisma.asiento.count({ where: { tenantId, origenId: first.reconciliacionId } }),
    ]);

    expect(second.reconciliacionId).toBe(first.reconciliacionId);
    expect(journalCount).toBe(1);
    expect(asiento).not.toBeNull();
    expect(asiento?.estado).toBe('CONTABILIZADO');
    expect(asiento?.tenantSequence).not.toBeNull();
    expect(asiento?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(asiento?.lineas).toHaveLength(2);
    expect(asiento?.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(3.69);
    expect(asiento?.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(3.69);
    const debitLine = asiento?.lineas.find((line) => Number(line.debe) > 0);
    const creditLine = asiento?.lineas.find((line) => Number(line.haber) > 0);
    expect(debitLine?.monedaOriginal).toBe('CUP');
    expect(debitLine?.montoOriginal.toFixed(4)).toBe('3.6900');
    expect(debitLine?.tasaCambio).toBeNull();
    expect(creditLine?.monedaOriginal).toBe('USD');
    expect(creditLine?.montoOriginal.toFixed(4)).toBe('0.0123');
    expect(Number(creditLine?.tasaCambio)).toBe(300);
    expect(creditLine?.fxEvidenceFingerprint).toBe(first.fxEvidenceFingerprint);
    expect(creditLine?.cuenta.codigo).toBe('1.1.02');
    expect(bank.saldo).toBe(9996.31);
    expect(Number(payable.montoPagado)).toBeCloseTo(0.0123, 4);
    expect(Number(payable.montoPagadoFuncional)).toBe(3.69);
  });
  it('posts one balanced loan collection with exact sub-cent FX evidence', async () => {
    const input = {
      id: fixture.loanId,
      monto: 0.0123,
      cuentaId: fixture.loanBankId,
      tipoPagoId: fixture.paymentTypeId,
      moneda: 'USD',
      tasaCambio: 300,
      idempotencyKey: `loan-${debtIdempotencyKey}`,
    };
    const first = await withTestTenant(tenantId, () =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({ input, user }),
    );
    const second = await withTestTenant(tenantId, () =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({ input, user }),
    );
    const asiento = await prisma.asiento.findUnique({
      where: {
        tenantId_origenTipo_origenId: {
          tenantId,
          origenTipo: 'reconciliacion_venta',
          origenId: first.reconciliacionId,
        },
      },
      include: { lineas: { include: { cuenta: true } } },
    });
    const [account, receivable, journalCount] = await Promise.all([
      prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: fixture.loanBankId }, select: { saldo: true } }),
      prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId, prestamoCash: { id: fixture.loanId } }, select: { montoPagado: true, montoPagadoFuncional: true } }),
      prisma.asiento.count({ where: { tenantId, origenId: first.reconciliacionId } }),
    ]);
    expect(second.reconciliacionId).toBe(first.reconciliacionId);
    expect(journalCount).toBe(1);
    expect(asiento?.lineas).toHaveLength(2);
    expect(asiento?.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(3.69);
    expect(asiento?.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(3.69);
    const debitLine = asiento?.lineas.find((line) => Number(line.debe) > 0);
    const creditLine = asiento?.lineas.find((line) => Number(line.haber) > 0);
    expect(debitLine?.cuenta.codigo).toBe('1.1.02');
    expect(debitLine?.monedaOriginal).toBe('USD');
    expect(debitLine?.montoOriginal.toFixed(4)).toBe('0.0123');
    expect(debitLine?.tasaCambio?.toNumber()).toBe(300);
    expect(debitLine?.fxEvidenceFingerprint).toBe(first.fxEvidenceFingerprint);
    expect(creditLine?.monedaOriginal).toBe('CUP');
    expect(creditLine?.montoOriginal.toFixed(4)).toBe('3.6900');
    expect(account.saldo).toBe(3.69);
    expect(Number(receivable.montoPagado)).toBeCloseTo(0.0123, 4);
    expect(Number(receivable.montoPagadoFuncional)).toBe(3.69);
  });

  it('serializes concurrent same-key payments into one reconciliation and one valid ledger node', async () => {
    const key = 'race-' + suffix;
    const input = { id: fixture.debtId, monto: 1.25, cuentaId: fixture.bankId, tipoPagoId: fixture.paymentTypeId, moneda: 'USD', tasaCambio: 300, idempotencyKey: key };
    const results = await Promise.all([1, 2].map(() => withTestTenant(tenantId, () =>
      AccountingCashOperationsMutationService.registerCashDebtPayment({ input, user }),
    )));
    const [reconciliationCount, journal, rows] = await Promise.all([
      prisma.reconciliacionVenta.count({ where: { tenantId, idempotencyKey: 'cash-payment:' + key } }),
      prisma.asiento.findUnique({ where: { tenantId_origenTipo_origenId: { tenantId, origenTipo: 'reconciliacion_gasto', origenId: results[0].reconciliacionId } }, include: { lineas: { orderBy: { orden: 'asc' } } } }),
      prisma.asiento.findMany({ where: { tenantId }, orderBy: { tenantSequence: 'asc' }, include: { lineas: { orderBy: { orden: 'asc' } } } }),
    ]);
    expect(results[1].reconciliacionId).toBe(results[0].reconciliacionId);
    expect(reconciliationCount).toBe(1);
    expect(journal?.tenantSequence).toBe(BigInt(3));
    expect(rows.map((row) => row.tenantSequence)).toEqual(rows.map((_, index) => BigInt(index + 1)));
    const integrity = validateHashChain(rows, (row) => construirHashAsientoV2({
      tenantId: row.tenantId, diarioId: row.diarioId, periodoId: row.periodoId, numero: row.numero,
      fecha: row.fecha, origenTipo: row.origenTipo, origenId: row.origenId,
      lineas: row.lineas.map((line) => ({ orden: line.orden, cuentaId: line.cuentaId, debe: line.debe, haber: line.haber })),
      hashAnterior: row.hashAnterior, tenantSequence: row.tenantSequence ?? BigInt(0),
    }));
    expect(integrity.valid).toBe(true);
  });

  it('accrues and posts interest for loans and debts with partial payments and immutable replay', async () => {
    const obligations = await createInterestObligations();
    const ordinaryInterestAccount = await prisma.cuentaRolTenant.findFirstOrThrow({
      where: { tenantId, rol: 'GASTOS_FINANCIEROS' },
      select: { cuentaId: true },
    });
    const loanInterestAccount = await prisma.cuentaRolTenant.findFirstOrThrow({
      where: { tenantId, rol: 'INTERESES_GANADOS' },
      select: { cuentaId: true },
    });

    const run = async (
      kind: 'debt' | 'loan',
      amount: number,
      idempotencyKey: string,
      paymentDate: string,
    ) => {
      const input = {
        id: kind === 'debt' ? obligations.debtId : obligations.loanId,
        monto: amount,
        cuentaId: kind === 'debt' ? fixture.bankId : fixture.loanBankId,
        tipoPagoId: fixture.paymentTypeId,
        moneda: 'USD',
        tasaCambio: 300,
        idempotencyKey,
      };
      const clock = () => new Date(`${paymentDate}T12:00:00.000Z`);
      return withTestTenant(tenantId, () => kind === 'debt'
        ? AccountingCashOperationsMutationService.registerCashDebtPayment({ input, user, clock })
        : AccountingCashOperationsMutationService.registerCashLoanPayment({ input, user, clock }));
    };

    for (const kind of ['debt', 'loan'] as const) {
      const firstKey = `interest-${kind}-first-${suffix}`;
      const secondKey = `interest-${kind}-second-${suffix}`;
      const thirdKey = `interest-${kind}-third-${suffix}`;
      const first = await run(kind, 8, firstKey, '2025-01-31');
      const firstAllocation = await prisma.cashPaymentInterestAllocation.findUniqueOrThrow({
        where: { tenantId_reconciliacionId: { tenantId, reconciliacionId: first.reconciliacionId } },
      });
      expect(firstAllocation.ordinaryElapsedDays).toBe(30);
      expect(firstAllocation.moratoryElapsedDays).toBe(10);
      expect(firstAllocation.ordinaryAccruedThisPeriod
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toFixed(4)).toBe('9.8630');
      expect(firstAllocation.moratoryAccruedThisPeriod
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toFixed(4)).toBe('6.5753');
      expect(firstAllocation.moratoryAllocated.toFixed(4)).toBe('6.5753');
      expect(firstAllocation.ordinaryAllocated.toFixed(4)).toBe('1.4247');
      expect(firstAllocation.principalAllocated.toFixed(4)).toBe('0.0000');
      expect(firstAllocation.principalAfter.toFixed(4)).toBe('1000.0000');

      const second = await run(kind, 9, secondKey, '2025-01-31');
      const secondAllocation = await prisma.cashPaymentInterestAllocation.findUniqueOrThrow({
        where: { tenantId_reconciliacionId: { tenantId, reconciliacionId: second.reconciliacionId } },
      });
      expect(secondAllocation.ordinaryElapsedDays).toBe(0);
      expect(secondAllocation.moratoryElapsedDays).toBe(0);
      expect(secondAllocation.moratoryAllocated.toFixed(4)).toBe('0.0000');
      expect(secondAllocation.ordinaryAllocated.toFixed(4)).toBe('8.4383');
      expect(secondAllocation.principalAllocated.toFixed(4)).toBe('0.5617');
      expect(secondAllocation.principalAfter.toFixed(4)).toBe('999.4383');
      expect(secondAllocation.ordinaryCarryAfter.toNumber()).toBeGreaterThan(0);

      const third = await run(kind, 1, thirdKey, '2025-02-01');
      const thirdAllocation = await prisma.cashPaymentInterestAllocation.findUniqueOrThrow({
        where: { tenantId_reconciliacionId: { tenantId, reconciliacionId: third.reconciliacionId } },
      });
      expect(thirdAllocation.ordinaryElapsedDays).toBe(1);
      expect(thirdAllocation.moratoryElapsedDays).toBe(1);
      expect(thirdAllocation.principalBefore.toFixed(4)).toBe('999.4383');
      const principalBefore = new Prisma.Decimal('999.4383');
      const expectedOrdinary = principalBefore.mul(12).div(100 * 365);
      const expectedMoratory = principalBefore.mul(24).div(100 * 365);
      expect(thirdAllocation.ordinaryAccruedThisPeriod.toNumber())
        .toBeCloseTo(expectedOrdinary.toNumber(), 12);
      expect(thirdAllocation.moratoryAccruedThisPeriod.toNumber())
        .toBeCloseTo(expectedMoratory.toNumber(), 12);
      expect(thirdAllocation.functionalAmount.toFixed(4)).toBe('300.0000');
      expect(thirdAllocation.fxEvidenceFingerprint).toBe(third.fxEvidenceFingerprint);

      const journal = await prisma.asiento.findFirstOrThrow({
        where: { tenantId, origenId: third.reconciliacionId },
        include: { lineas: { include: { cuenta: true } } },
      });
      const moratoryAccountId = kind === 'debt'
        ? fixture.moratoryExpenseAccountId
        : fixture.moratoryIncomeAccountId;
      const ordinaryAccountId = kind === 'debt'
        ? ordinaryInterestAccount.cuentaId
        : loanInterestAccount.cuentaId;
      const moratoryLine = journal.lineas.find((line) => line.cuentaId === moratoryAccountId);
      const ordinaryLine = journal.lineas.find((line) => line.cuentaId === ordinaryAccountId);
      expect(moratoryLine).toBeDefined();
      expect(ordinaryLine).toBeDefined();
      expect(moratoryLine?.cuentaId).not.toBe(ordinaryLine?.cuentaId);
      expect(journal.lineas.reduce((sum, line) => sum + Number(line.debe), 0))
        .toBeCloseTo(300, 4);
      expect(journal.lineas.reduce((sum, line) => sum + Number(line.haber), 0))
        .toBeCloseTo(300, 4);
      await expect(prisma.cashPaymentInterestAllocation.update({
        where: {
          tenantId_reconciliacionId: {
            tenantId,
            reconciliacionId: third.reconciliacionId,
          },
        },
        data: { functionalAmount: 0 },
      })).rejects.toThrow(/cash payment interest allocation is immutable/);
      await expect(prisma.cashPaymentInterestAllocation.delete({
        where: {
          tenantId_reconciliacionId: {
            tenantId,
            reconciliacionId: third.reconciliacionId,
          },
        },
      })).rejects.toThrow(/cash payment interest allocation is immutable/);

      const rowsBeforeConcurrentReplay = await prisma.cashPaymentInterestAllocation.count({
        where: { tenantId, obligationType: kind },
      });
      const journalsBeforeConcurrentReplay = await prisma.asiento.count({
        where: { tenantId },
      });
      const concurrentKey = `interest-${kind}-concurrent-${suffix}`;
      const concurrentResults = await Promise.all([
        run(kind, 0.1, concurrentKey, '2025-02-02'),
        run(kind, 0.1, concurrentKey, '2025-02-02'),
      ]);
      expect(concurrentResults[1].reconciliacionId)
        .toBe(concurrentResults[0].reconciliacionId);
      expect(await prisma.cashPaymentInterestAllocation.count({
        where: { tenantId, obligationType: kind },
      })).toBe(rowsBeforeConcurrentReplay + 1);
      expect(await prisma.asiento.count({ where: { tenantId } }))
        .toBe(journalsBeforeConcurrentReplay + 1);

      const beforeReplay = await prisma.cashPaymentInterestAllocation.findMany({
        where: { tenantId, obligationType: kind },
        orderBy: { createdAt: 'asc' },
        select: { id: true, eventFingerprint: true, paymentDate: true, principalAfter: true },
      });
      const journalCountBeforeReplay = await prisma.asiento.count({ where: { tenantId } });
      const replay = await run(kind, 9, secondKey, '2025-02-02');
      const afterReplay = await prisma.cashPaymentInterestAllocation.findMany({
        where: { tenantId, obligationType: kind },
        orderBy: { createdAt: 'asc' },
        select: { id: true, eventFingerprint: true, paymentDate: true, principalAfter: true },
      });
      expect(replay.reconciliacionId).toBe(second.reconciliacionId);
      expect(afterReplay).toEqual(beforeReplay);
      expect(await prisma.asiento.count({ where: { tenantId } })).toBe(journalCountBeforeReplay);
    }
  });

  it('rolls back cash, payable, reconciliation, strict audit, and ledger state when audit fails', async () => {
    const obligation = await createInterestObligations();
    const key = 'audit-failure-' + suffix;
    const failingUser = { ...user, userId: 'formal_audit_fail_' + suffix } as AuthenticatedUser;
    const before = await readDebtSnapshot(key, failingUser.userId, obligation.debtId);
    await expect(withTestTenant(tenantId, () => AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: { id: obligation.debtId, monto: 1, cuentaId: fixture.bankId, tipoPagoId: fixture.paymentTypeId, moneda: 'USD', tasaCambio: 300, idempotencyKey: key },
      user: failingUser,
      clock: () => new Date('2025-01-31T12:00:00.000Z'),
    }))).rejects.toThrow('division by zero');
    expect(await readDebtSnapshot(key, failingUser.userId, obligation.debtId)).toEqual(before);
  });

  it('rolls back the full writer transaction when the formal asiento insert fails', async () => {
    const obligation = await createInterestObligations();
    const key = 'ledger-failure-' + suffix;
    const failingUser = { ...user, userId: 'formal_ledger_fail_' + suffix } as AuthenticatedUser;
    const before = await readDebtSnapshot(key, failingUser.userId, obligation.debtId);
    await expect(withTestTenant(tenantId, () => AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: { id: obligation.debtId, monto: 1, cuentaId: fixture.bankId, tipoPagoId: fixture.paymentTypeId, moneda: 'USD', tasaCambio: 300, idempotencyKey: key },
      user: failingUser,
      clock: () => new Date('2025-01-31T12:00:00.000Z'),
    }))).rejects.toThrow();
    expect(await readDebtSnapshot(key, failingUser.userId, obligation.debtId)).toEqual(before);
  });

  it('rolls back all interest writer effects when immutable allocation insertion fails', async () => {
    const obligation = await createInterestObligations();
    const key = 'allocation-failure-' + suffix;
    const before = await readDebtSnapshot(key, user.userId, obligation.debtId);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION public."${allocationFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $func$ BEGIN IF NEW."tenantId" = '${tenantId}' THEN RAISE EXCEPTION 'forced interest allocation failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $func$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER "' + allocationFailureTrigger + '" BEFORE INSERT ON public."cash_payment_interest_allocations" FOR EACH ROW EXECUTE FUNCTION public."' + allocationFailureFunction + '"()',
    );
    try {
      await expect(withTestTenant(tenantId, () => AccountingCashOperationsMutationService.registerCashDebtPayment({
        input: { id: obligation.debtId, monto: 1, cuentaId: fixture.bankId, tipoPagoId: fixture.paymentTypeId, moneda: 'USD', tasaCambio: 300, idempotencyKey: key },
        user,
        clock: () => new Date('2025-01-31T12:00:00.000Z'),
      }))).rejects.toThrow('forced interest allocation failure');
      expect(await readDebtSnapshot(key, user.userId, obligation.debtId)).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "' + allocationFailureTrigger + '" ON public."cash_payment_interest_allocations"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS public."' + allocationFailureFunction + '"()');
    }
  });

  it('fails closed for legacy debts without a versioned interest snapshot', async () => {
    const payable = await prisma.cuentaPorPagar.create({
      data: {
        tenantId,
        numeroFactura: `legacy-interest-${suffix}`,
        proveedorId: fixture.vendorId,
        proveedorNombre: 'formal-vendor',
        montoDeuda: 100,
        montoPagado: 0,
        montoDeudaFuncional: 30000,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
        tasaCambio: 300,
        saldoPendiente: 100,
        moneda: 'USD',
        estado: 'PENDIENTE',
        tipo: 'compra',
        tipoDeuda: 'DEUDA_CASH',
      },
    });
    const legacyDebt = await prisma.deudaCash.create({
      data: {
        tenantId,
        proveedorId: fixture.vendorId,
        cuentaPorPagarId: payable.cuentaPorPagarId,
        montoCapital: 100,
        moneda: 'USD',
        tasaInteres: 12,
        createdById: userId,
        estado: 'ACTIVO',
        cuentaBancariaId: fixture.bankId,
      },
    });
    const key = 'legacy-interest-' + suffix;
    const before = await readDebtSnapshot(key, user.userId, legacyDebt.id);
    await expect(withTestTenant(tenantId, () => AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: { id: legacyDebt.id, monto: 1, cuentaId: fixture.bankId, tipoPagoId: fixture.paymentTypeId, moneda: 'USD', tasaCambio: 300, idempotencyKey: key },
      user,
      clock: () => new Date('2025-01-31T12:00:00.000Z'),
    }))).rejects.toMatchObject({ code: 'INTEREST_SNAPSHOT_REQUIRED' });
    expect(await readDebtSnapshot(key, user.userId, legacyDebt.id)).toEqual(before);
  });

  it('rejects a SQL line that references an account owned by another tenant', async () => {
    const foreignTenantId = 'formal_foreign_' + suffix;
    await prisma.tenant.create({ data: { tenantId: foreignTenantId, nombre: 'formal-foreign-it', slug: 'formal-foreign-' + suffix } });
    const foreignAccount = await prisma.cuentaContable.create({
      data: { tenantId: foreignTenantId, codigo: '9.9.99', nombre: 'foreign', tipo: 'ACTIVO', naturaleza: 'DEUDORA' },
    });
    const asiento = await prisma.asiento.findFirstOrThrow({ where: { tenantId }, select: { asientoId: true } });
    const lineId = 'foreign_line_' + suffix;
    const sql = 'INSERT INTO "asiento_lineas" ("lineaId", "tenantId", "asientoId", "orden", "cuentaId", "debe", "haber", "monedaOriginal", "montoOriginal") VALUES ($1, $2, $3, 999, $4, 1, 0, $5, 1)';
    await expect(prisma.$executeRawUnsafe(sql, lineId, tenantId, asiento.asientoId, foreignAccount.cuentaContableId, 'CUP')).rejects.toThrow();
    expect(await prisma.asientoLinea.count({ where: { lineaId: lineId } })).toBe(0);
  });

});
