/** Motivos por los que un período no puede acreditar cobertura global. */
export type MotivoCobertura =
	| 'REPLAY_AUSENTE' | 'REPLAY_NO_COMPLETADO' | 'FUENTES_OMITIDAS' | 'IDENTIDADES_AMBIGUAS'
	| 'VALORACION_NO_VERIFICABLE' | 'FUERA_DE_PERIODO' | 'RECONCILIACION_NO_CONFORME'
	| 'RECONCILIACION_INCOMPLETA' | 'LIBRO_VACIO';

/** Ejecución de replay que sostiene la evidencia de cobertura de un período. */
export interface EvidenciaReplay {
	/** Identificador de la ejecución de replay. */
	replayRunId: string;
	/** Estado final de la ejecución. */
	status: string;
	/** Fuentes omitidas, ambiguas o sin valoracion verificable. */
	omittedCount: number;
	ambiguousCount: number;
	noFxCount: number;
	noCostCount: number;
	/** Fuentes fuera del período replayado. */
	outOfPeriodCount: number;
	/** Reconciliación persistida por la ejecución, si existe. */
	reconciliacion: { status: string; expectedCount: number; matchedCount: number } | null;
}

/** Evidencia reunida para un período del mayor formal. */
export interface EvidenciaCobertura {
	/** Ejecución de replay del período, si existe. */
	replay: EvidenciaReplay | null;
	/** Asientos formales persistidos en el período. */
	asientosEnPeriodo: number;
}

/** Resultado de la acreditación de cobertura global de un período. */
export interface ResultadoCoberturaGlobal {
	/** Estado: solo `CUBIERTA` habilita publicar el reporte. */
	estado: 'CUBIERTA' | 'NO_CUBIERTA';
	/** Período evaluado. */
	periodoId: string;
	/** Ejecución de replay que sostiene la evidencia, si existe. */
	replayRunId: string | null;
	/** Fuentes esperadas y confirmadas por la reconciliación. */
	fuentesEsperadas: number;
	fuentesCubiertas: number;
	/** Motivos que impiden acreditar la cobertura. */
	motivos: MotivoCobertura[];
}
/**
 * @description Evalúa si la evidencia reunida acredita cobertura global de un
 * período del mayor formal.
 *
 * La cobertura exige una ejecución de replay completada sin omisiones ni
 * ambigüedades, con reconciliación conforme que cubra todas las fuentes
 * esperadas. Un libro sin asientos no acredita cobertura: no hay evidencia de
 * que el período se haya reconstruido.
 *
 * @param {string} periodoId - Período evaluado.
 * @param {EvidenciaCobertura} evidencia - Evidencia del replay y del libro.
 * @returns {ResultadoCoberturaGlobal} Estado y motivos de la cobertura.
 */
export function evaluateCoverageEvidence(
	periodoId: string,
	evidencia: EvidenciaCobertura,
): ResultadoCoberturaGlobal {
	const motivos: MotivoCobertura[] = [];
	let fuentesEsperadas = 0;
	let fuentesCubiertas = 0;
	const { replay } = evidencia;

	if (!replay) {
		motivos.push('REPLAY_AUSENTE');
	} else {
		if (replay.status !== 'COMPLETED') motivos.push('REPLAY_NO_COMPLETADO');
		if (replay.omittedCount > 0) motivos.push('FUENTES_OMITIDAS');
		if (replay.ambiguousCount > 0) motivos.push('IDENTIDADES_AMBIGUAS');
		if (replay.noFxCount > 0 || replay.noCostCount > 0) motivos.push('VALORACION_NO_VERIFICABLE');
		if (replay.outOfPeriodCount > 0) motivos.push('FUERA_DE_PERIODO');

		if (!replay.reconciliacion || replay.reconciliacion.status !== 'CONFORME') {
			motivos.push('RECONCILIACION_NO_CONFORME');
		} else {
			fuentesEsperadas = replay.reconciliacion.expectedCount;
			fuentesCubiertas = replay.reconciliacion.matchedCount;
			if (fuentesCubiertas < fuentesEsperadas) motivos.push('RECONCILIACION_INCOMPLETA');
		}
	}

	if (evidencia.asientosEnPeriodo === 0) motivos.push('LIBRO_VACIO');

	return {
		estado: motivos.length === 0 ? 'CUBIERTA' : 'NO_CUBIERTA',
		periodoId,
		replayRunId: replay?.replayRunId ?? null,
		fuentesEsperadas,
		fuentesCubiertas,
		motivos,
	};
}