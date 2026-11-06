import type { ResultadoCoberturaGlobal } from './financial-ledger-coverage';
import type { ProblemaIntegridadReverso } from './financial-ledger-reversal-integrity';
import type { MotivoIndisponibilidadFormal } from './formal-financial-report-contract';

/**
 * @description Decide si el reporte formal puede publicarse a partir de la
 * evidencia reunida.
 *
 * El criterio es estricto: sin cobertura global acreditada, o con vínculos de
 * reversión inconsistentes, el reporte queda no disponible. No se degrada a
 * fuentes legacy ni se publica con evidencia parcial.
 *
 * @param {ResultadoCoberturaGlobal | null} coverage - Cobertura acreditada del período.
 * @param {ProblemaIntegridadReverso[]} problems - Problemas de integridad de reversos.
 * @returns {MotivoIndisponibilidadFormal | null} Motivo que impide publicar o null si puede publicarse.
 */
export function resolveFormalAvailability(
	coverage: ResultadoCoberturaGlobal | null,
	problems: ProblemaIntegridadReverso[],
): MotivoIndisponibilidadFormal | null {
	if (!coverage || coverage.estado !== 'CUBIERTA') return 'COVERAGE_NOT_CREDIFIED';
	if (problems.length > 0) return 'REVERSAL_INTEGRITY_FAILED';
	return null;
}
