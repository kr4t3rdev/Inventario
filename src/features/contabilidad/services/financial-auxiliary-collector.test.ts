import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { calculateCashObligationPaymentAllocation } from '@/features/contabilidad-formal/lib/cash-obligation-payment-allocation';
import { cashPaymentAllocationFingerprint } from '@/features/contabilidad-formal/lib/cash-payment-allocation-fingerprint';

import { collectFinancialAuxiliaryEvidence } from './financial-auxiliary-checkpoint-service';

describe('financial auxiliary evidence collector', () => {
	it('reconstructs foreign cash receivables after interest accrual and partial payments', async () => {
		const grantDate = new Date('2026-01-01T00:00:00.000Z');
		const paymentDate = new Date('2026-02-01T00:00:00.000Z');
		const allocation = calculateCashObligationPaymentAllocation({
			obligation: {
				policyVersion: 1,
				grantDate,
				maturityDate: null,
				accruedThroughDate: grantDate,
				principalRemaining: '100',
				ordinaryAnnualRate: '12',
				moratoryAnnualRate: '0',
				ordinaryCarry: '0',
				moratoryCarry: '0',
			},
			paymentAmount: '30',
			paymentDate,
		});
		const secondAllocation = calculateCashObligationPaymentAllocation({
			obligation: {
				policyVersion: 1,
				grantDate,
				maturityDate: null,
				accruedThroughDate: allocation.accruedThroughDate,
				principalRemaining: allocation.principalAfter.toDecimalPlaces(4),
				ordinaryAnnualRate: '12',
				moratoryAnnualRate: '0',
				ordinaryCarry: allocation.ordinaryCarryAfter.toDecimalPlaces(18),
				moratoryCarry: allocation.moratoryCarryAfter.toDecimalPlaces(18),
			},
			paymentAmount: '20',
			paymentDate,
		});
		const roundedDelta = (carry: typeof allocation.ordinaryCarryBefore, accrued: typeof allocation.ordinaryAccruedThisPeriod) =>
			carry.plus(accrued).toDecimalPlaces(4).minus(carry.toDecimalPlaces(4));
		const interest = roundedDelta(allocation.ordinaryCarryBefore, allocation.ordinaryAccruedThisPeriod)
			.plus(roundedDelta(allocation.moratoryCarryBefore, allocation.moratoryAccruedThisPeriod));
		const initialFx = buildAppliedFxEvidence({
			originalAmount: 100, originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: 25, convertedAmount: 2500, rateEffectiveAt: grantDate, source: 'cash-loan-create',
		});
		const paymentFx = buildAppliedFxEvidence({
			originalAmount: 30, originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: 25, convertedAmount: 750, rateEffectiveAt: paymentDate, source: 'cash-loan-payment',
		});
		const secondPaymentFx = buildAppliedFxEvidence({
			originalAmount: 20, originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: 25, convertedAmount: 500, rateEffectiveAt: paymentDate, source: 'cash-loan-payment',
		});
		const fxJson = (evidence: typeof initialFx, amount: string, functionalAmount: string, date: Date, rate: string, source: string) => ({
			...evidence,
			originalAmount: amount,
			originalCurrency: 'USD',
			functionalAmount,
			functionalCurrency: 'CUP',
			exchangeRate: rate,
			rateEffectiveAt: date.toISOString(),
			fxProvenanceSource: source,
		});
		const persistedAllocation = {
			...allocation,
			principalBefore: allocation.principalBefore.toDecimalPlaces(4),
			overduePrincipalBefore: allocation.overduePrincipalBefore.toDecimalPlaces(4),
			ordinaryCarryBefore: allocation.ordinaryCarryBefore.toDecimalPlaces(18),
			moratoryCarryBefore: allocation.moratoryCarryBefore.toDecimalPlaces(18),
			ordinaryAccruedThisPeriod: allocation.ordinaryAccruedThisPeriod.toDecimalPlaces(18),
			moratoryAccruedThisPeriod: allocation.moratoryAccruedThisPeriod.toDecimalPlaces(18),
			principalAfter: allocation.principalAfter.toDecimalPlaces(4),
			ordinaryCarryAfter: allocation.ordinaryCarryAfter.toDecimalPlaces(18),
			moratoryCarryAfter: allocation.moratoryCarryAfter.toDecimalPlaces(18),
			reconciliacionId: 'payment-1',
			obligationType: 'loan',
			policyVersion: 1,
			accrualCheckpointDate: allocation.accruedThroughDate,
			paymentAmount: new Prisma.Decimal('30'),
			moratoryAllocated: allocation.allocation.allocated.moratoryInterest,
			ordinaryAllocated: allocation.allocation.allocated.ordinaryInterest,
			principalAllocated: allocation.allocation.allocated.principal,
			ordinaryFunctional: allocation.allocation.allocated.ordinaryInterest.mul(25).toDecimalPlaces(4),
			moratoryFunctional: allocation.allocation.allocated.moratoryInterest.mul(25).toDecimalPlaces(4),
			principalFunctional: new Prisma.Decimal('750').minus(
				allocation.allocation.allocated.ordinaryInterest.plus(allocation.allocation.allocated.moratoryInterest)
					.mul(25).toDecimalPlaces(4),
			),
			functionalAmount: new Prisma.Decimal('750'),
			functionalCurrency: 'CUP',
			fxEvidenceFingerprint: paymentFx.fxEvidenceFingerprint,
		};
		const allocationWithFingerprint = {
			...persistedAllocation,
			eventFingerprint: cashPaymentAllocationFingerprint(persistedAllocation),
		};
		const persistedSecondAllocation = {
			...secondAllocation,
			principalBefore: secondAllocation.principalBefore.toDecimalPlaces(4),
			overduePrincipalBefore: secondAllocation.overduePrincipalBefore.toDecimalPlaces(4),
			ordinaryCarryBefore: secondAllocation.ordinaryCarryBefore.toDecimalPlaces(18),
			moratoryCarryBefore: secondAllocation.moratoryCarryBefore.toDecimalPlaces(18),
			ordinaryAccruedThisPeriod: secondAllocation.ordinaryAccruedThisPeriod.toDecimalPlaces(18),
			moratoryAccruedThisPeriod: secondAllocation.moratoryAccruedThisPeriod.toDecimalPlaces(18),
			principalAfter: secondAllocation.principalAfter.toDecimalPlaces(4),
			ordinaryCarryAfter: secondAllocation.ordinaryCarryAfter.toDecimalPlaces(18),
			moratoryCarryAfter: secondAllocation.moratoryCarryAfter.toDecimalPlaces(18),
			reconciliacionId: 'payment-2',
			obligationType: 'loan',
			policyVersion: 1,
			accrualCheckpointDate: secondAllocation.accruedThroughDate,
			paymentAmount: new Prisma.Decimal('20'),
			moratoryAllocated: secondAllocation.allocation.allocated.moratoryInterest,
			ordinaryAllocated: secondAllocation.allocation.allocated.ordinaryInterest,
			principalAllocated: secondAllocation.allocation.allocated.principal,
			ordinaryFunctional: secondAllocation.allocation.allocated.ordinaryInterest.mul(25).toDecimalPlaces(4),
			moratoryFunctional: secondAllocation.allocation.allocated.moratoryInterest.mul(25).toDecimalPlaces(4),
			principalFunctional: new Prisma.Decimal('500').minus(
				secondAllocation.allocation.allocated.ordinaryInterest.plus(secondAllocation.allocation.allocated.moratoryInterest)
					.mul(25).toDecimalPlaces(4),
			),
			functionalAmount: new Prisma.Decimal('500'),
			functionalCurrency: 'CUP',
			fxEvidenceFingerprint: secondPaymentFx.fxEvidenceFingerprint,
		};
		const secondAllocationWithFingerprint = {
			...persistedSecondAllocation,
			eventFingerprint: cashPaymentAllocationFingerprint(persistedSecondAllocation),
		};
		const persistedDebtAllocation = { ...persistedAllocation, obligationType: 'debt' };
		const debtAllocationWithFingerprint = {
			...persistedDebtAllocation,
			eventFingerprint: cashPaymentAllocationFingerprint(persistedDebtAllocation),
		};
		const persistedSecondDebtAllocation = { ...persistedSecondAllocation, obligationType: 'debt' };
		const secondDebtAllocationWithFingerprint = {
			...persistedSecondDebtAllocation,
			eventFingerprint: cashPaymentAllocationFingerprint(persistedSecondDebtAllocation),
		};
		const client = {
			cuentaBancaria: { findMany: vi.fn().mockResolvedValue([]) },
			stockUbicacion: { findMany: vi.fn().mockResolvedValue([]) },
			compraDocumentoItem: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([{
				id: 'ar-cash-loan', montoDeuda: new Prisma.Decimal('100').plus(interest).toString(),
				montoPagado: '50', estado: 'PARCIAL', monedaOriginal: 'USD', monedaFuncional: 'CUP',
				montoDeudaFuncional: new Prisma.Decimal('2500').plus(interest.mul(25).toDecimalPlaces(4)).toString(), montoPagadoFuncional: '1250',
				fxEvidenceJson: fxJson(initialFx, '100.0000', '2500.0000', grantDate, '25.0000000000', 'cash-loan-create'),
				fxEvidenceFingerprint: initialFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
				prestamoCash: {
					moneda: 'USD', montoCapital: '100', cashInterestPolicyVersion: 1,
					cashInterestGrantDate: grantDate, cashInterestMaturityDate: null,
					ordinaryAnnualRate: '12', moratoryAnnualRate: '0',
					cashInterestAccruedThroughDate: secondAllocation.accruedThroughDate,
					cashInterestPrincipalRemaining: persistedSecondAllocation.principalAfter,
					cashInterestOrdinaryCarry: persistedSecondAllocation.ordinaryCarryAfter,
					cashInterestMoratoryCarry: persistedSecondAllocation.moratoryCarryAfter,
					reconciliaciones: [{
						reconciliacionId: 'payment-2', monto: '20', montoConvertido: '500', moneda: 'USD',
						functionalCurrency: 'CUP', tasaCambio: '25', rateEffectiveAt: paymentDate,
						fxProvenanceSource: 'cash-loan-payment', fxCatalogRateId: null,
						fxEvidenceJson: fxJson(secondPaymentFx, '20.0000', '500.0000', paymentDate, '25.0000000000', 'cash-loan-payment'),
						fxEvidenceFingerprint: secondPaymentFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
						fechaReconciliacion: paymentDate, cashInterestAllocation: secondAllocationWithFingerprint,
					}, {
						reconciliacionId: 'payment-1', monto: '30', montoConvertido: '750', moneda: 'USD',
						functionalCurrency: 'CUP', tasaCambio: '25', rateEffectiveAt: paymentDate,
						fxProvenanceSource: 'cash-loan-payment', fxCatalogRateId: null,
						fxEvidenceJson: fxJson(paymentFx, '30.0000', '750.0000', paymentDate, '25.0000000000', 'cash-loan-payment'),
						fxEvidenceFingerprint: paymentFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
						fechaReconciliacion: paymentDate,
						cashInterestAllocation: allocationWithFingerprint,
					}],
				},
			}]) },
			cuentaPorPagar: { findMany: vi.fn().mockResolvedValue([]) },
			inyeccionCapital: { findMany: vi.fn().mockResolvedValue([]) },
		};

		const evidence = await collectFinancialAuxiliaryEvidence({
			client: client as never,
			tenantId: 'tenant-1',
			cutoffAt: new Date('2026-03-01T00:00:00.000Z'),
			functionalCurrency: 'CUP',
		});

		expect(evidence.receivables[0].originalAmount).toBe(interest.plus('50').toString());
		expect(evidence.receivables[0].functionalAmount).toBe(interest.mul('25').plus('1250').toString());

		client.cuentaPorPagar.findMany.mockResolvedValue([{
			cuentaPorPagarId: 'ap-cash-debt',
			saldoPendiente: new Prisma.Decimal('100').plus(interest).minus('50').toString(),
			montoDeuda: new Prisma.Decimal('100').plus(interest).toString(),
			montoPagado: '50', montoDeudaFuncional: new Prisma.Decimal('2500').plus(interest.mul(25)).toString(),
			montoPagadoFuncional: '1250', moneda: 'USD', monedaOriginal: 'USD', monedaFuncional: 'CUP',
			estado: 'PARCIAL', fxEvidenceJson: fxJson(initialFx, '100.0000', '2500.0000', grantDate, '25.0000000000', 'cash-loan-create'),
			fxEvidenceFingerprint: initialFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
			deudaCash: {
				moneda: 'USD', montoCapital: '100', cashInterestPolicyVersion: 1,
				cashInterestGrantDate: grantDate, cashInterestMaturityDate: null,
			ordinaryAnnualRate: '12', moratoryAnnualRate: '0',
				cashInterestAccruedThroughDate: secondAllocation.accruedThroughDate,
				cashInterestPrincipalRemaining: persistedSecondAllocation.principalAfter,
				cashInterestOrdinaryCarry: persistedSecondAllocation.ordinaryCarryAfter,
				cashInterestMoratoryCarry: persistedSecondAllocation.moratoryCarryAfter,
				reconciliaciones: [{
					reconciliacionId: 'payment-2', monto: '20', montoConvertido: '500', moneda: 'USD',
					functionalCurrency: 'CUP', tasaCambio: '25', rateEffectiveAt: paymentDate,
					fxProvenanceSource: 'cash-loan-payment', fxCatalogRateId: null,
					fxEvidenceJson: fxJson(secondPaymentFx, '20.0000', '500.0000', paymentDate, '25.0000000000', 'cash-loan-payment'),
					fxEvidenceFingerprint: secondPaymentFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
					fechaReconciliacion: paymentDate, cashInterestAllocation: secondDebtAllocationWithFingerprint,
				}, {
					reconciliacionId: 'payment-1', monto: '30', montoConvertido: '750', moneda: 'USD',
					functionalCurrency: 'CUP', tasaCambio: '25', rateEffectiveAt: paymentDate,
					fxProvenanceSource: 'cash-loan-payment', fxCatalogRateId: null,
					fxEvidenceJson: fxJson(paymentFx, '30.0000', '750.0000', paymentDate, '25.0000000000', 'cash-loan-payment'),
					fxEvidenceFingerprint: paymentFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
					fechaReconciliacion: paymentDate, cashInterestAllocation: debtAllocationWithFingerprint,
				}],
			},
		}]);
		const payableEvidence = await collectFinancialAuxiliaryEvidence({
			client: client as never,
			tenantId: 'tenant-1',
			cutoffAt: new Date('2026-03-01T00:00:00.000Z'),
			functionalCurrency: 'CUP',
		});
		expect(payableEvidence.payables[0].originalAmount).toBe(interest.plus('50').toString());
		expect(payableEvidence.payables[0].functionalAmount).toBe(interest.mul('25').plus('1250').toString());
	});

	it('rejects payables whose stored pending balance differs from debt less payments', async () => {
		const rateEffectiveAt = new Date('2026-01-01T00:00:00.000Z');
		const fx = buildAppliedFxEvidence({
			originalAmount: 10,
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: 25,
			convertedAmount: 250,
			rateEffectiveAt,
			source: 'approved',
		});
		const client = {
			cuentaBancaria: { findMany: vi.fn().mockResolvedValue([]) },
			stockUbicacion: { findMany: vi.fn().mockResolvedValue([]) },
			compraDocumentoItem: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaPorPagar: { findMany: vi.fn().mockResolvedValue([{
				cuentaPorPagarId: 'ap-inconsistent', saldoPendiente: '0.00', moneda: 'USD',
				monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeuda: '10.00',
				montoPagado: '3.00', montoDeudaFuncional: '250.00', montoPagadoFuncional: '75.00',
				estado: 'PARCIAL', fxEvidenceJson: {
					...fx, originalAmount: '10.00', originalCurrency: 'USD', functionalAmount: '250.00',
					functionalCurrency: 'CUP', exchangeRate: '25.0000000000',
					rateEffectiveAt: rateEffectiveAt.toISOString(),
				},
				fxEvidenceFingerprint: fx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
			}]) },
			inyeccionCapital: { findMany: vi.fn().mockResolvedValue([]) },
		};

		const evidence = await collectFinancialAuxiliaryEvidence({
			client: client as never,
			tenantId: 'tenant-1',
			cutoffAt: new Date('2026-04-01T00:00:00.000Z'),
			functionalCurrency: 'CUP',
		});

		expect(evidence.payables[0].functionalAmount).toBeNull();
	});

  it('uses only fingerprint-verified functional balances for foreign receivables and payables', async () => {
    const rateEffectiveAt = new Date('2026-01-01T00:00:00.000Z');
    const receivableFx = buildAppliedFxEvidence({
      originalAmount: 10,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 25,
      convertedAmount: 250,
      rateEffectiveAt,
      source: 'approved',
    });
    const payableFx = buildAppliedFxEvidence({
      originalAmount: 10,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 25,
      convertedAmount: 250,
      rateEffectiveAt,
      source: 'approved',
    });
    const mismatchedOriginalFx = buildAppliedFxEvidence({
      originalAmount: 11,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 25,
      convertedAmount: 275,
      rateEffectiveAt,
      source: 'approved',
    });
    const fxJson = (evidence: typeof receivableFx) => ({
      ...evidence,
      originalAmount: '10.00',
      originalCurrency: 'USD',
      functionalAmount: '250.00',
      functionalCurrency: 'CUP',
      exchangeRate: '25.0000000000',
      rateEffectiveAt: rateEffectiveAt.toISOString(),
    });
    const client = {
      cuentaBancaria: { findMany: vi.fn().mockResolvedValue([]) },
      stockUbicacion: { findMany: vi.fn().mockResolvedValue([]) },
      compraDocumentoItem: { findMany: vi.fn().mockResolvedValue([]) },
      cuentaPorCobrar: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'ar-usd', montoDeuda: '10.00', montoPagado: '2.00', estado: 'PARCIAL',
          monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeudaFuncional: '250.00',
          montoPagadoFuncional: '50.00', fxEvidenceJson: fxJson(receivableFx),
          fxEvidenceFingerprint: receivableFx.fxEvidenceFingerprint,
          fxEvidenceVersion: 1, prestamoCash: null,
        }]),
      },
      cuentaPorPagar: {
        findMany: vi.fn().mockResolvedValue([{
          cuentaPorPagarId: 'ap-usd', saldoPendiente: '7.00', moneda: 'USD',
          monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeuda: '10.00',
          montoPagado: '3.00', montoDeudaFuncional: '250.00', montoPagadoFuncional: '75.00',
          estado: 'PARCIAL', fxEvidenceJson: fxJson(payableFx),
          fxEvidenceFingerprint: payableFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
        }]),
      },
      inyeccionCapital: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const evidence = await collectFinancialAuxiliaryEvidence({
      client: client as never,
      tenantId: 'tenant-1',
      cutoffAt: new Date('2026-04-01T00:00:00.000Z'),
      functionalCurrency: 'CUP',
    });

    expect(evidence.receivables[0]).toMatchObject({
      sourceId: 'ar-usd',
      originalAmount: '8',
      originalCurrency: 'USD',
      functionalAmount: '200',
      identity: { debt: '10.00', paid: '2.00', fxEvidenceFingerprint: receivableFx.fxEvidenceFingerprint },
      fxEvidence: fxJson(receivableFx),
    });
    expect(evidence.payables[0]).toMatchObject({
      sourceId: 'ap-usd',
			originalAmount: '7',
      originalCurrency: 'USD',
      functionalAmount: '175',
      identity: { debt: '10.00', paid: '3.00', fxEvidenceFingerprint: payableFx.fxEvidenceFingerprint },
      fxEvidence: fxJson(payableFx),
    });

    client.cuentaPorCobrar.findMany.mockResolvedValue([{
      id: 'ar-usd', montoDeuda: '10.00', montoPagado: '2.00', estado: 'PARCIAL',
      monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeudaFuncional: '250.00',
      montoPagadoFuncional: '50.00', fxEvidenceJson: fxJson(receivableFx),
      fxEvidenceFingerprint: 'tampered-fingerprint', fxEvidenceVersion: 1, prestamoCash: null,
    }]);
    client.cuentaPorPagar.findMany.mockResolvedValue([{
      cuentaPorPagarId: 'ap-usd', saldoPendiente: '7.00', moneda: 'USD',
      monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeuda: '10.00',
      montoPagado: '3.00', montoDeudaFuncional: '250.00', montoPagadoFuncional: '75.00',
      estado: 'PARCIAL', fxEvidenceJson: fxJson(payableFx),
      fxEvidenceFingerprint: 'tampered-fingerprint', fxEvidenceVersion: 1,
    }]);
    const unverified = await collectFinancialAuxiliaryEvidence({
      client: client as never,
      tenantId: 'tenant-1',
      cutoffAt: new Date('2026-04-01T00:00:00.000Z'),
      functionalCurrency: 'CUP',
    });
    expect(unverified.receivables[0].functionalAmount).toBeNull();
    expect(unverified.payables[0].functionalAmount).toBeNull();

    client.cuentaPorCobrar.findMany.mockResolvedValue([{
      id: 'ar-usd', montoDeuda: '10.00', montoPagado: '2.00', estado: 'PARCIAL',
      monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeudaFuncional: '251.00',
      montoPagadoFuncional: '50.00', fxEvidenceJson: fxJson(receivableFx),
      fxEvidenceFingerprint: receivableFx.fxEvidenceFingerprint,
      fxEvidenceVersion: 1, prestamoCash: null,
    }]);
    client.cuentaPorPagar.findMany.mockResolvedValue([{
      cuentaPorPagarId: 'ap-usd', saldoPendiente: '7.00', moneda: 'USD',
      monedaOriginal: 'USD', monedaFuncional: 'CUP', montoDeuda: '10.00',
      montoPagado: '3.00', montoDeudaFuncional: '275.00', montoPagadoFuncional: '75.00',
      estado: 'PARCIAL', fxEvidenceJson: fxJson(mismatchedOriginalFx),
      fxEvidenceFingerprint: mismatchedOriginalFx.fxEvidenceFingerprint, fxEvidenceVersion: 1,
    }]);
    const inconsistent = await collectFinancialAuxiliaryEvidence({
      client: client as never,
      tenantId: 'tenant-1',
      cutoffAt: new Date('2026-04-01T00:00:00.000Z'),
      functionalCurrency: 'CUP',
    });
    expect(inconsistent.receivables[0].functionalAmount).toBeNull();
    expect(inconsistent.payables[0].functionalAmount).toBeNull();
  });
});
