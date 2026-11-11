import type { Prisma } from '@/generated/prisma';
import { cashCreatePayloadHash } from '@/lib/services/cash-create-idempotency';

type AllocationFingerprintInput = Pick<Prisma.CashPaymentInterestAllocationGetPayload<object>,
	'reconciliacionId' | 'obligationType' | 'policyVersion' | 'paymentDate' | 'principalBefore' |
	'ordinaryAnnualRate' | 'moratoryAnnualRate' | 'ordinaryCarryBefore' | 'moratoryCarryBefore' |
	'paymentAmount' | 'functionalAmount' | 'fxEvidenceFingerprint' | 'ordinaryAllocated' |
	'moratoryAllocated' | 'principalAllocated'>;

/**
 * @description Calcula la huella de la asignación inmutable de un pago Cash.
 * @param {AllocationFingerprintInput} allocation - Evidencia persistida de la distribución.
 * @returns {string} Huella canónica del evento.
 */
export function cashPaymentAllocationFingerprint(allocation: AllocationFingerprintInput): string {
	return cashCreatePayloadHash({
		reconciliationId: allocation.reconciliacionId,
		obligationType: allocation.obligationType,
		policyVersion: allocation.policyVersion,
		paymentDate: allocation.paymentDate.toISOString().slice(0, 10),
		principalBefore: allocation.principalBefore.toFixed(4),
		ordinaryAnnualRate: allocation.ordinaryAnnualRate.toFixed(10),
		moratoryAnnualRate: allocation.moratoryAnnualRate.toFixed(10),
		ordinaryCarryBefore: allocation.ordinaryCarryBefore.toString(),
		moratoryCarryBefore: allocation.moratoryCarryBefore.toString(),
		paymentAmount: allocation.paymentAmount.toFixed(4),
		functionalAmount: allocation.functionalAmount.toFixed(4),
		fxEvidenceFingerprint: allocation.fxEvidenceFingerprint,
		ordinaryAllocated: allocation.ordinaryAllocated.toFixed(4),
		moratoryAllocated: allocation.moratoryAllocated.toFixed(4),
		principalAllocated: allocation.principalAllocated.toFixed(4),
	});
}
