import { describe, expect, it } from 'vitest';
import { evaluateCoverageEvidence, type EvidenciaReplay } from './financial-ledger-coverage';

function crearReplay(overrides: Partial<EvidenciaReplay> = {}): EvidenciaReplay {
	return {
		replayRunId: 'run-1',
		snapshotAcreditado: true,
		fuentesActualesAcreditadas: true,
		manifiestoAcreditado: true,
		status: 'COMPLETED',
		omittedCount: 0,
		ambiguousCount: 0,
		noFxCount: 0,
		noCostCount: 0,
		outOfPeriodCount: 0,
		reconciliacion: { status: 'CONFORME', expectedCount: 3, matchedCount: 3 },
		...overrides,
	};
}

function evaluar(
  replay: EvidenciaReplay | null,
  asientosEnPeriodo = 2,
  fuentesProduccionNoEvaluables = 0,
) {
  return evaluateCoverageEvidence('periodo-1', {
    replay,
    asientosEnPeriodo,
    fuentesProduccionNoEvaluables,
  });
}

describe('evaluateCoverageEvidence', () => {
	it('acredita cobertura cuando el replay completo y concilia todas las fuentes', () => {
		expect(evaluar(crearReplay())).toEqual({
			estado: 'CUBIERTA',
			periodoId: 'periodo-1',
			replayRunId: 'run-1',
			fuentesEsperadas: 3,
			fuentesCubiertas: 3,
			motivos: [],
		});
	});

  it('no acredita cobertura sin evidencia de replay para el periodo', () => {
		const resultado = evaluar(null);

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('REPLAY_AUSENTE');
  });

  it('no acredita cobertura si hay órdenes históricas de producción sin fecha efectiva', () => {
    const resultado = evaluar(crearReplay(), 2, 1);

    expect(resultado.estado).toBe('NO_CUBIERTA');
    expect(resultado.motivos).toContain('FUENTES_NO_EVALUADAS');
  });

	it('no acredita el mayor cuando el snapshot no explica sus asientos', () => {
		const resultado = evaluar(crearReplay({ snapshotAcreditado: false }));
		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('ASIENTOS_NO_ACREDITADOS');
	});

	it('no acredita cobertura si el replay no evaluó el manifiesto global completo', () => {
		const resultado = evaluar(crearReplay({ manifiestoAcreditado: false }));
		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('MANIFIESTO_INCOMPLETO');
	});

	it('no acredita un replay sin fuentes cuando el periodo contiene asientos', () => {
		const resultado = evaluar(crearReplay({
			reconciliacion: { status: 'CONFORME', expectedCount: 0, matchedCount: 0 },
		}), 1);
		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('REPLAY_SIN_FUENTES');
	});

	it.each([
		{ omittedCount: -1 },
		{ noFxCount: 0.5 },
		{ reconciliacion: { status: 'CONFORME', expectedCount: 1, matchedCount: 2 } },
	])('rechaza contadores contradictorios o invalidos: %o', (override) => {
		expect(evaluar(crearReplay(override)).estado).toBe('NO_CUBIERTA');
	});

	it('no acredita cobertura si el replay no se completo', () => {
		const resultado = evaluar(crearReplay({ status: 'NO_CONFORME' }));

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('REPLAY_NO_COMPLETADO');
	});

	it.each([
		['FUENTES_OMITIDAS', { omittedCount: 1 }],
		['IDENTIDADES_AMBIGUAS', { ambiguousCount: 1 }],
		['VALORACION_NO_VERIFICABLE', { noFxCount: 1 }],
		['VALORACION_NO_VERIFICABLE', { noCostCount: 1 }],
		['FUERA_DE_PERIODO', { outOfPeriodCount: 1 }],
	] as const)('no acredita cobertura con el motivo %s', (motivo, overrides) => {
		const resultado = evaluar(crearReplay(overrides));

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain(motivo);
	});

	it('no acredita cobertura si la reconciliacion persistida no es conforme', () => {
		const resultado = evaluar(crearReplay({
			reconciliacion: { status: 'NO_CONFORME', expectedCount: 3, matchedCount: 2 },
		}));

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('RECONCILIACION_NO_CONFORME');
	});

	it('no acredita cobertura si la reconciliacion no cubrio todas las fuentes', () => {
		const resultado = evaluar(crearReplay({
			reconciliacion: { status: 'CONFORME', expectedCount: 3, matchedCount: 1 },
		}));

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('RECONCILIACION_INCOMPLETA');
	});

	it('no acredita cobertura sin reconciliacion persistida', () => {
		const resultado = evaluar(crearReplay({ reconciliacion: null }));

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('RECONCILIACION_NO_CONFORME');
	});

	it('no acredita cobertura si el periodo no tiene asientos formales', () => {
		const resultado = evaluar(crearReplay(), 0);

		expect(resultado.estado).toBe('NO_CUBIERTA');
		expect(resultado.motivos).toContain('LIBRO_VACIO');
	});
});
