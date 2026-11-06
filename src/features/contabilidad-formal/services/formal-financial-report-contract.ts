import type { ResultadoCoberturaGlobal } from './financial-ledger-coverage';
import type { ProblemaIntegridadReverso } from './financial-ledger-reversal-integrity';

/** Saldo de una cuenta contable presentado en el balance formal. */
export interface FormalAccountBalance {
	/** Identificador de la cuenta contable. */
	id: string;
	/** Código contable. */
	code: string;
	/** Nombre de la cuenta. */
	name: string;
	/** Tipo contable de la cuenta. */
	type: string;
	/** Naturaleza contable de la cuenta. */
	nature: string;
	/** Saldo decimal exacto. */
	balance: string;
}

/** Resultado del período presentado por tipo contable. */
export interface FormalPeriodResult {
	/** Ingresos del período. */
	income: string;
	/** Costos del período. */
	costs: string;
	/** Gastos del período. */
	expenses: string;
	/** Resultado neto del período. */
	net: string;
}

/** Causas por las que el reporte formal no puede publicarse. */
export type MotivoIndisponibilidadFormal =
	| 'PERIODO_NO_ENCONTRADO'
	| 'COVERAGE_NOT_CREDIFIED'
	| 'REVERSAL_INTEGRITY_FAILED';

/** Resolución del reporte formal: disponible o con causa explícita. */
export type FormalFinancialReportResolution =
	| {
		status: 'AVAILABLE';
		periodoId: string;
		cutoffAt: string;
		accounts: FormalAccountBalance[];
		result: FormalPeriodResult;
		coverage: ResultadoCoberturaGlobal;
	}
	| {
		status: 'UNAVAILABLE';
		reason: MotivoIndisponibilidadFormal;
		periodoId: string;
		coverage: ResultadoCoberturaGlobal | null;
		problems: ProblemaIntegridadReverso[];
	};
