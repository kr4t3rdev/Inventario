/**
 * @description Conciliación de liquidaciones externas de CxC/CxP iniciales
 * contra el submayor (tarea 4, tramo 3). Por auxiliar comprueba importes
 * originales, funcionales aplicados, estado, saldo pendiente y evidencia FX
 * de cada liquidación.
 * @module src/features/contabilidad/services/initial-subledger-settlement-reconciliation
 */

export interface SettlementReconciliationAccount {
	tipo: 'CXC' | 'CXP';
	id: string;
	monedaOriginal: string;
	monedaFuncional: string;
	montoDeuda: string;
	montoDeudaFuncional: string;
	montoPagado: string;
	montoPagadoFuncional: string;
	saldoPendiente?: string | null;
	estado: string;
}

export interface SettlementReconciliationSettlement {
	id: string;
	cuentaId: string;
	tipo: 'CXC' | 'CXP';
	moneda: string;
	montoOriginal: string;
	montoFuncional: string;
	fecha: Date;
	creadoEn?: Date | null;
	tasaCambio?: number | string | null;
	rateEffectiveAt?: Date | string | null;
	fxProvenanceKind?: string | null;
	fxProvenanceSource?: string | null;
	fxCatalogRateId?: string | null;
	fxEvidenceFingerprint?: string | null;
	fxEvidenceVersion?: number | null;
}

export interface SettlementReconciliationInput {
	cuentas: readonly SettlementReconciliationAccount[];
	liquidaciones: readonly SettlementReconciliationSettlement[];
}

export interface SettlementReconciliationResult {
	conciliado: boolean;
	discrepancias: string[];
}

import { Prisma } from '@/generated/prisma';
import { verifyAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { calculateInitialSubledgerSettlement } from './initial-subledger-settlement';

const Decimal = Prisma.Decimal.clone({ precision: 80 });
const ZERO = new Decimal(0);

/** @description Ordena liquidaciones como las procesó el writer: fecha efectiva, creación e id. */
function compararLiquidaciones(
	a: SettlementReconciliationSettlement,
	b: SettlementReconciliationSettlement,
): number {
	const fechaA = new Date(a.fecha).getTime();
	const fechaB = new Date(b.fecha).getTime();
	if (fechaA !== fechaB) return fechaA - fechaB;
	const creadoA = new Date(a.creadoEn ?? a.fecha).getTime();
	const creadoB = new Date(b.creadoEn ?? b.fecha).getTime();
	if (creadoA !== creadoB) return creadoA - creadoB;
	return a.id.localeCompare(b.id);
}

/** @description Traduce el código de la calculadora a una discrepancia legible. */
function mensajeCalculadora(error: unknown): string {
	const code = error instanceof Error ? error.message : String(error);
	if (code.includes('INITIAL_SETTLEMENT_EXCEEDS_BALANCE')) {
		return `la liquidación excede el saldo (${code})`;
	}
	if (code.includes('INITIAL_SETTLEMENT_CURRENCY_MISMATCH')) {
		return `la liquidación está en otra moneda (${code})`;
	}
	if (code.includes('INITIAL_SETTLEMENT_AMOUNT_INVALID')) {
		return `la liquidación trae un importe no válido (${code})`;
	}
	return code;
}

/**
 * @description Concilia liquidaciones externas de CxC/CxP iniciales contra el
 * submayor. Por auxiliar recorre las liquidaciones en el orden en que el
 * writer las procesó, recalcula el aplicado con la misma calculadora y
 * comprueba: suma de originales contra `montoPagado`, suma de aplicados
 * contra `montoPagadoFuncional`, estado según el remanente, `saldoPendiente`
 * en CxP y evidencia FX de cada liquidación. Nunca lanza: las discrepancias
 * se devuelven para auditarlas.
 * @param {SettlementReconciliationInput} input - Cuentas iniciales y sus liquidaciones.
 * @returns {SettlementReconciliationResult} Conciliación y discrepancias, si las hay.
 */
export function reconcileInitialSubledgerSettlements(
	input: SettlementReconciliationInput,
): SettlementReconciliationResult {
	const discrepancias: string[] = [];
	const cuentas = new Map(input.cuentas.map((cuenta) => [cuenta.id, cuenta]));
	const porCuenta = new Map<string, SettlementReconciliationSettlement[]>();
	for (const liquidacion of input.liquidaciones) {
		const cuenta = cuentas.get(liquidacion.cuentaId);
		if (!cuenta) {
			discrepancias.push(
				`La liquidación ${liquidacion.id} no tiene cuenta en el submayor (${liquidacion.cuentaId})`,
			);
			continue;
		}
		if (cuenta.tipo !== liquidacion.tipo) {
			discrepancias.push(
				`La liquidación ${liquidacion.id} es de tipo ${liquidacion.tipo} y la cuenta ${cuenta.id} es ${cuenta.tipo}`,
			);
		}
		if (
			liquidacion.moneda.trim().toUpperCase() !== cuenta.monedaOriginal.trim().toUpperCase()
		) {
			discrepancias.push(
				`La liquidación ${liquidacion.id} está en ${liquidacion.moneda} y la cuenta ${cuenta.id} en ${cuenta.monedaOriginal}`,
			);
		}
		const fxOk = verifyAppliedFxEvidence({
			originalAmount: Number(liquidacion.montoOriginal),
			originalCurrency: liquidacion.moneda,
			functionalCurrency: cuenta.monedaFuncional,
			convertedAmount: Number(liquidacion.montoFuncional),
			exchangeRate: liquidacion.tasaCambio == null ? null : Number(liquidacion.tasaCambio),
			rateEffectiveAt: liquidacion.rateEffectiveAt ?? null,
			fxProvenanceKind: liquidacion.fxProvenanceKind ?? null,
			fxProvenanceSource: liquidacion.fxProvenanceSource ?? null,
			fxCatalogRateId: liquidacion.fxCatalogRateId ?? null,
			fxEvidenceFingerprint: liquidacion.fxEvidenceFingerprint ?? null,
			fxEvidenceVersion: liquidacion.fxEvidenceVersion ?? null,
		});
		if (!fxOk) {
			discrepancias.push(
				`La evidencia FX de la liquidación ${liquidacion.id} no verifica`,
			);
		}
		const lista = porCuenta.get(liquidacion.cuentaId) ?? [];
		lista.push(liquidacion);
		porCuenta.set(liquidacion.cuentaId, lista);
	}

	for (const cuenta of input.cuentas) {
		const liquidaciones = [...(porCuenta.get(cuenta.id) ?? [])].sort(compararLiquidaciones);
		let balanceOriginal: Prisma.Decimal;
		let balanceFunctional: Prisma.Decimal;
		try {
			balanceOriginal = new Decimal(cuenta.montoDeuda);
			balanceFunctional = new Decimal(cuenta.montoDeudaFuncional);
		} catch {
			discrepancias.push(`La cuenta ${cuenta.id} trae un saldo inicial no válido`);
			continue;
		}
		let sumaOriginal = new Decimal(0);
		let sumaAplicado = new Decimal(0);
		let recorridoOk = true;
		for (const liquidacion of liquidaciones) {
			try {
				const calculo = calculateInitialSubledgerSettlement({
					role: cuenta.tipo === 'CXC' ? 'receivable' : 'payable',
					balanceOriginal: balanceOriginal.toFixed(4),
					balanceFunctional: balanceFunctional.toFixed(4),
					obligationCurrency: cuenta.monedaOriginal,
					paymentCurrency: liquidacion.moneda,
					functionalCurrency: cuenta.monedaFuncional,
					paymentOriginal: liquidacion.montoOriginal,
					paymentFunctional: liquidacion.montoFuncional,
				});
				sumaOriginal = sumaOriginal.plus(calculo.appliedOriginal);
				sumaAplicado = sumaAplicado.plus(calculo.appliedBookFunctional);
				balanceOriginal = new Decimal(calculo.remainingOriginal);
				balanceFunctional = new Decimal(calculo.remainingBookFunctional);
			} catch (error) {
				recorridoOk = false;
				discrepancias.push(
					`La liquidación ${liquidacion.id} no se puede aplicar a la cuenta ${cuenta.id}: ${mensajeCalculadora(error)}`,
				);
				break;
			}
		}
		if (!recorridoOk) continue;
		try {
			if (!sumaOriginal.eq(new Decimal(cuenta.montoPagado))) {
				discrepancias.push(
					`La cuenta ${cuenta.id} declara montoPagado ${cuenta.montoPagado} y las liquidaciones suman ${sumaOriginal.toFixed(4)}`,
				);
			}
			if (!sumaAplicado.eq(new Decimal(cuenta.montoPagadoFuncional))) {
				discrepancias.push(
					`La cuenta ${cuenta.id} declara montoPagadoFuncional ${cuenta.montoPagadoFuncional} y las liquidaciones aplicadas suman ${sumaAplicado.toFixed(4)}`,
				);
			}
		} catch {
			discrepancias.push(`La cuenta ${cuenta.id} trae un monto pagado no válido`);
			continue;
		}
		const estadoEsperado = balanceOriginal.eq(ZERO)
			? 'PAGADA'
			: liquidaciones.length > 0
				? 'PARCIAL'
				: 'PENDIENTE';
		if (cuenta.estado === 'ANULADA') {
			if (liquidaciones.length > 0 || !new Decimal(cuenta.montoPagado).eq(ZERO)) {
				discrepancias.push(
					`La cuenta ${cuenta.id} está ANULADA y tiene liquidaciones o pagos`,
				);
			}
		} else if (cuenta.estado !== estadoEsperado) {
			discrepancias.push(
				`La cuenta ${cuenta.id} está en estado ${cuenta.estado} y debería estar ${estadoEsperado}`,
			);
		}
		if (
			cuenta.tipo === 'CXP' &&
			cuenta.saldoPendiente != null &&
			!new Decimal(cuenta.saldoPendiente).eq(balanceOriginal)
		) {
			discrepancias.push(
				`La cuenta ${cuenta.id} declara saldoPendiente ${cuenta.saldoPendiente} y el remanente es ${balanceOriginal.toFixed(4)}`,
			);
		}
	}
	return { conciliado: discrepancias.length === 0, discrepancias };
}
