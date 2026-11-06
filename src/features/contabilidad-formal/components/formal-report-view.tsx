import type { JSX } from 'react';
import { CircleCheck } from 'lucide-react';

import type {
	FormalAccountBalance,
	FormalFinancialReportResolution,
	FormalPeriodResult,
} from '@/features/contabilidad-formal/services/formal-financial-report-contract';
import { FormalReportUnavailable } from './formal-report-unavailable';

interface FormalReportViewProps {
	/** Resolución del reporte formal: disponible o no disponible con su causa. */
	resolution: FormalFinancialReportResolution;
}

/** Tipos de cuenta que integran el balance general. */
const TIPOS_BALANCE: readonly string[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO'];

/** Etiquetas legibles de los tipos contables. */
const ETIQUETAS_TIPO: Record<string, string> = {
	ACTIVO: 'Activos',
	PASIVO: 'Pasivos',
	PATRIMONIO: 'Patrimonio',
};

/**
 * @description Agrupa las cuentas por tipo contable para presentar el balance.
 * @param {FormalAccountBalance[]} accounts - Saldos por cuenta.
 * @returns {JSX.Element} Tabla de cuentas agrupada por tipo.
 */
function FormalBalanceTable({ accounts }: { accounts: FormalAccountBalance[] }): JSX.Element {
	return (
		<div className="space-y-5">
			{TIPOS_BALANCE.map((tipo) => {
				const cuentas = accounts.filter((account) => account.type === tipo);
				if (cuentas.length === 0) return null;
				return (
					<section key={tipo} aria-label={ETIQUETAS_TIPO[tipo]}>
						<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
							{ETIQUETAS_TIPO[tipo]}
						</h3>
						<table className="mt-2 w-full text-sm">
							<caption className="sr-only">Cuentas de {ETIQUETAS_TIPO[tipo]}</caption>
							<tbody>
								{cuentas.map((account) => (
									<tr key={account.id} className="border-b border-border/60 last:border-b-0">
										<td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{account.code}</td>
										<td className="py-2 pr-3">{account.name}</td>
										<td className="py-2 text-right font-mono tabular-nums">{account.balance}</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				);
			})}
		</div>
	);
}

/**
 * @description Presenta el resultado del período por tipo contable.
 * @param {object} props - Ingresos, costos, gastos y resultado neto.
 * @returns {JSX.Element} Panel con el resultado del período.
 */
function FormalResultPanel({ result }: { result: FormalPeriodResult }): JSX.Element {
	const filas = [
		['Ingresos', result.income],
		['Costos', result.costs],
		['Gastos', result.expenses],
		['Resultado neto', result.net],
	] as const;
	return (
		<section aria-label="Estado de resultados del período" className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
			<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				Estado de resultados del período
			</h3>
			<dl className="mt-3 space-y-2">
				{filas.map(([etiqueta, valor]) => (
					<div key={etiqueta} className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
						<dt className="text-sm">{etiqueta}</dt>
						<dd className="font-mono text-sm tabular-nums">{valor}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/**
 * @description Presenta el reporte contable formal por cuentas y tipos contables.
 * @param {FormalReportViewProps} props - Resolución del reporte formal.
 * @returns {JSX.Element} Reporte disponible o estado de indisponibilidad.
 */
export function FormalReportView({ resolution }: FormalReportViewProps): JSX.Element {
	if (resolution.status === 'UNAVAILABLE') {
		return (
			<FormalReportUnavailable
				reason={resolution.reason}
				motivos={resolution.coverage?.motivos ?? []}
				problems={resolution.problems}
			/>
		);
	}

	return (
		<div className="space-y-6">
			<section
				role="status"
				aria-label="Estado del reporte formal"
				className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
			>
				<CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
				<p className="text-sm">
					Reporte del mayor formal con cobertura acreditada
					({resolution.coverage.fuentesCubiertas} de {resolution.coverage.fuentesEsperadas} fuentes).
					Importes en moneda funcional, con precisión decimal exacta.
				</p>
			</section>
			<FormalBalanceTable accounts={resolution.accounts} />
			<FormalResultPanel result={resolution.result} />
		</div>
	);
}
