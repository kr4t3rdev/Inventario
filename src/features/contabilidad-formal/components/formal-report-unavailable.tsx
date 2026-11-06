import type { JSX } from 'react';
import { AlertCircle } from 'lucide-react';

import type { MotivoIndisponibilidadFormal } from '@/features/contabilidad-formal/services/formal-financial-report-contract';

/** Explicación legible de cada causa de indisponibilidad. */
const CAUSAS: Record<MotivoIndisponibilidadFormal, string> = {
	PERIODO_NO_ENCONTRADO: 'El período contable no pertenece a la empresa activa.',
	COVERAGE_NOT_CREDIFIED: 'El período no tiene cobertura global acreditada en el mayor formal.',
	REVERSAL_INTEGRITY_FAILED: 'Hay inconsistencias en los vínculos de reversión del mayor formal.',
};

/** Explicación legible de cada motivo que impide acreditar la cobertura. */
const MOTIVOS_COBERTURA: Record<string, string> = {
	REPLAY_AUSENTE: 'No hay una ejecución de replay para el período.',
	REPLAY_NO_COMPLETADO: 'La ejecución de replay del período no se completó.',
	FUENTES_OMITIDAS: 'La reconstrucción omitió fuentes que no pudieron verificarse.',
	IDENTIDADES_AMBIGUAS: 'Hay fuentes con identidad ambigua en el período.',
	VALORACION_NO_VERIFICABLE: 'Hay fuentes sin conversión de moneda o costo verificable.',
	FUERA_DE_PERIODO: 'Hay fuentes que pertenecen a otro período.',
	RECONCILIACION_NO_CONFORME: 'La reconciliación del replay no resultó conforme.',
	RECONCILIACION_INCOMPLETA: 'La reconciliación no cubrió todas las fuentes esperadas.',
	LIBRO_VACIO: 'El período no tiene asientos en el mayor formal.',
};

interface FormalReportUnavailableProps {
	/** Causa por la que el reporte no puede publicarse. */
	reason: MotivoIndisponibilidadFormal;
	/** Motivos que impiden acreditar la cobertura del período. */
	motivos: string[];
	/** Problemas de integridad de reversos detectados. */
	problems: { detalle: string }[];
}

/**
 * @description Explica por qué el reporte formal no está disponible.
 *
 * El estado es explícito: la causa, los motivos de cobertura y los problemas
 * de integridad. No se muestran importes parciales ni datos de otras fuentes.
 *
 * @param {FormalReportUnavailableProps} props - Causa, motivos y problemas.
 * @returns {JSX.Element} Estado de indisponibilidad con su causa.
 */
export function FormalReportUnavailable({
	reason,
	motivos,
	problems,
}: FormalReportUnavailableProps): JSX.Element {
	return (
		<section
			role="status"
			aria-label="Reporte no disponible"
			className="rounded-2xl border border-amber-300/80 bg-[oklch(0.97_0.035_82)] px-5 py-6 text-amber-950 dark:border-amber-800 dark:bg-[oklch(0.19_0.025_72)] dark:text-amber-50"
		>
			<div className="flex items-start gap-3">
				<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
				<div>
					<h2 className="text-lg font-semibold">Este reporte no está disponible</h2>
					<p className="mt-1 text-sm leading-6">{CAUSAS[reason]}</p>
					<p className="mt-1 text-sm leading-6 opacity-90">
						No se presentaron importes parciales ni datos de otras fuentes.
					</p>
				</div>
			</div>
			{motivos.length > 0 && (
				<ul className="mt-4 space-y-1 text-sm">
					{motivos.map((motivo) => (
						<li key={motivo}>{MOTIVOS_COBERTURA[motivo] ?? motivo}</li>
					))}
				</ul>
			)}
			{problems.length > 0 && (
				<ul className="mt-4 space-y-1 text-sm">
					{problems.map((problem, index) => (
						<li key={`${problem.detalle}-${index}`}>{problem.detalle}</li>
					))}
				</ul>
			)}
		</section>
	);
}
