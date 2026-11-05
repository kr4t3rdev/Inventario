import type { Prisma } from '@/generated/prisma';
import { calculateLedgerBalance } from './financial-ledger-balance';
import { calculateLedgerResult } from './financial-ledger-result';
import { readFinancialLedger } from './financial-ledger-reader';
import type { FormalAccountBalance, FormalPeriodResult } from './formal-financial-report-contract';

/** Parámetros de agregación del mayor formal. */
export interface FormalReportDataParams {
	/** Tenant propietario del mayor. */
	tenantId: string;
	/** Inicio inclusivo del período del resultado. */
	from: Date;
	/** Corte inclusivo del balance acumulado y del resultado. */
	cutoffAt: Date;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
}

/** Datos formales derivados del mayor. */
export interface FormalReportData {
	/** Saldos acumulados por cuenta al corte. */
	accounts: FormalAccountBalance[];
	/** Resultado del período por tipo contable. */
	result: FormalPeriodResult;
}

/**
 * @description Agrega el mayor formal al contrato del reporte.
 *
 * El balance es acumulado hasta el corte y el resultado corresponde solo al
 * período, sin los asientos de cierre ni sus reversos: el cierre traslada el
 * resultado a patrimonio y no debe alterar la lectura del período.
 *
 * @param {FormalReportDataParams} params - Tenant, período y corte.
 * @returns {Promise<FormalReportData>} Balance por cuenta y resultado del período.
 */
export async function readFormalReportData(
	params: FormalReportDataParams,
): Promise<FormalReportData> {
	const [acumuladas, delPeriodo] = await Promise.all([
		readFinancialLedger({
			tenantId: params.tenantId,
			cutoffAt: params.cutoffAt,
			client: params.client,
		}),
		readFinancialLedger({
			tenantId: params.tenantId,
			from: params.from,
			cutoffAt: params.cutoffAt,
			excludeClosingEntries: true,
			client: params.client,
		}),
	]);

	return {
		accounts: calculateLedgerBalance(acumuladas),
		result: calculateLedgerResult(calculateLedgerBalance(delPeriodo)),
	};
}
