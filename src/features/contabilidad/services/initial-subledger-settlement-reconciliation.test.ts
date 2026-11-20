/**
 * @description Conciliación de liquidaciones externas contra el submayor.
 * La evidencia FX de cada liquidación se construye con la misma valoración
 * que usa el writer, para que el caso válido verifique de verdad.
 */
import { describe, expect, it } from 'vitest';
import { buildFunctionalValuation } from '@/features/contabilidad-formal/lib/functional-valuation';
import {
	reconcileInitialSubledgerSettlements,
	type SettlementReconciliationAccount,
	type SettlementReconciliationSettlement,
} from './initial-subledger-settlement-reconciliation';

function evidencia(
	monto: number,
	moneda: string,
	tasa: number | null,
	fechaTasa: Date | null,
	catalogRateId: string | null,
) {
	const valuation = buildFunctionalValuation({
		monto,
		moneda,
		functionalCurrency: 'CUP',
		tasaCambio: tasa,
		fechaOperacion: new Date('2026-11-10T00:00:00Z'),
		fechaTasa,
		fxCatalogRateId: catalogRateId,
		source: 'initial-subledger-settlement',
	});
	if (valuation.fxEvidence == null) {
		throw new Error('la valoración de prueba no produjo evidencia');
	}
	// En misma moneda no hay conversión: el funcional es el propio monto.
	return {
		montoFuncional: (valuation.montoConvertido ?? monto).toFixed(4),
		tasaCambio: valuation.tasaCambio,
		rateEffectiveAt: valuation.fxEvidence.rateEffectiveAt
			? new Date(valuation.fxEvidence.rateEffectiveAt)
			: null,
		fxProvenanceKind: valuation.fxEvidence.fxProvenanceKind,
		fxProvenanceSource: valuation.fxEvidence.fxProvenanceSource,
		fxCatalogRateId: valuation.fxEvidence.fxCatalogRateId,
		fxEvidenceFingerprint: valuation.fxEvidence.fxEvidenceFingerprint,
		fxEvidenceVersion: valuation.fxEvidence.fxEvidenceVersion,
	};
}

function liquidacion(
	overrides: Partial<SettlementReconciliationSettlement> & { id: string; cuentaId: string },
): SettlementReconciliationSettlement {
	return {
		tipo: 'CXC',
		moneda: 'USD',
		montoOriginal: '40.0000',
		montoFuncional: '1000.0000',
		fecha: new Date('2026-11-10T00:00:00Z'),
		creadoEn: new Date('2026-11-10T10:00:00Z'),
		...evidencia(40, 'USD', 25, new Date('2026-11-10T00:00:00Z'), 'tasa-1'),
		...overrides,
	};
}

const cxc: SettlementReconciliationAccount = {
	tipo: 'CXC',
	id: 'cxc-1',
	monedaOriginal: 'USD',
	monedaFuncional: 'CUP',
	montoDeuda: '100.0000',
	montoDeudaFuncional: '2400.0000',
	montoPagado: '40.0000',
	montoPagadoFuncional: '960.0000',
	estado: 'PARCIAL',
};

describe('reconcileInitialSubledgerSettlements', () => {
	it('concilia un cobro parcial en divisa con su aplicado recalculado', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxc],
			liquidaciones: [liquidacion({ id: 'liq-1', cuentaId: 'cxc-1' })],
		});
		expect(resultado).toEqual({ conciliado: true, discrepancias: [] });
	});

	it('concilia dos cobros parciales con prorrateo acumulado', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [{ ...cxc, montoPagado: '70.0000', montoPagadoFuncional: '1680.0000' }],
			liquidaciones: [
				liquidacion({ id: 'liq-1', cuentaId: 'cxc-1' }),
				liquidacion({
					id: 'liq-2',
					cuentaId: 'cxc-1',
					montoOriginal: '30.0000',
					montoFuncional: '750.0000',
					fecha: new Date('2026-11-11T00:00:00Z'),
					creadoEn: new Date('2026-11-11T10:00:00Z'),
					...evidencia(30, 'USD', 25, new Date('2026-11-11T00:00:00Z'), 'tasa-1'),
				}),
			],
		});
		expect(resultado).toEqual({ conciliado: true, discrepancias: [] });
	});

	it('concilia un pago final en misma moneda con saldo cero y estado PAGADA', () => {
		const cxp: SettlementReconciliationAccount = {
			tipo: 'CXP',
			id: 'cxp-1',
			monedaOriginal: 'CUP',
			monedaFuncional: 'CUP',
			montoDeuda: '500.0000',
			montoDeudaFuncional: '500.0000',
			montoPagado: '500.0000',
			montoPagadoFuncional: '500.0000',
			saldoPendiente: '0.0000',
			estado: 'PAGADA',
		};
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxp],
			liquidaciones: [
				liquidacion({
					id: 'liq-1',
					cuentaId: 'cxp-1',
					tipo: 'CXP',
					moneda: 'CUP',
					montoOriginal: '500.0000',
					montoFuncional: '500.0000',
					...evidencia(500, 'CUP', null, null, null),
				}),
			],
		});
		expect(resultado).toEqual({ conciliado: true, discrepancias: [] });
	});

	it('reporta discrepancia cuando el monto pagado no suma las liquidaciones', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [{ ...cxc, montoPagado: '41.0000' }],
			liquidaciones: [liquidacion({ id: 'liq-1', cuentaId: 'cxc-1' })],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/montoPagado/i);
	});

	it('reporta discrepancia cuando el estado no corresponde al remanente', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [{ ...cxc, estado: 'PENDIENTE' }],
			liquidaciones: [liquidacion({ id: 'liq-1', cuentaId: 'cxc-1' })],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/estado/i);
	});

	it('reporta discrepancia cuando el saldo pendiente no es el remanente', () => {
		const cxp: SettlementReconciliationAccount = {
			tipo: 'CXP',
			id: 'cxp-1',
			monedaOriginal: 'CUP',
			monedaFuncional: 'CUP',
			montoDeuda: '500.0000',
			montoDeudaFuncional: '500.0000',
			montoPagado: '200.0000',
			montoPagadoFuncional: '200.0000',
			saldoPendiente: '10.0000',
			estado: 'PARCIAL',
		};
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxp],
			liquidaciones: [
				liquidacion({
					id: 'liq-1',
					cuentaId: 'cxp-1',
					tipo: 'CXP',
					moneda: 'CUP',
					montoOriginal: '200.0000',
					montoFuncional: '200.0000',
					...evidencia(200, 'CUP', null, null, null),
				}),
			],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/saldoPendiente/i);
	});

	it('reporta discrepancia cuando la evidencia FX de una liquidación no verifica', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxc],
			liquidaciones: [
				liquidacion({ id: 'liq-1', cuentaId: 'cxc-1', fxEvidenceFingerprint: 'huella-rota' }),
			],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/evidencia FX/i);
	});

	it('reporta discrepancia cuando una liquidación excede el saldo, sin lanzar', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxc],
			liquidaciones: [
				liquidacion({
					id: 'liq-1',
					cuentaId: 'cxc-1',
					montoOriginal: '150.0000',
					montoFuncional: '3750.0000',
					...evidencia(150, 'USD', 25, new Date('2026-11-10T00:00:00Z'), 'tasa-1'),
				}),
			],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/excede/i);
	});

	it('reporta discrepancia para una liquidación sin cuenta en el submayor', () => {
		const resultado = reconcileInitialSubledgerSettlements({
			cuentas: [cxc],
			liquidaciones: [liquidacion({ id: 'liq-1', cuentaId: 'cxc-inexistente' })],
		});
		expect(resultado.conciliado).toBe(false);
		expect(resultado.discrepancias.join(' ')).toMatch(/cuenta/i);
	});
});
