import { describe, expect, it } from 'vitest';
import type { ResultadoCoberturaGlobal } from './financial-ledger-coverage';
import type { ProblemaIntegridadReverso } from './financial-ledger-reversal-integrity';
import { resolveFormalAvailability } from './formal-financial-report-availability';

const COBERTURA_CUBIERTA: ResultadoCoberturaGlobal = {
	estado: 'CUBIERTA',
	periodoId: 'periodo-1',
	replayRunId: 'run-1',
	fuentesEsperadas: 3,
	fuentesCubiertas: 3,
	motivos: [],
};

const COBERTURA_NO_CUBIERTA: ResultadoCoberturaGlobal = {
	estado: 'NO_CUBIERTA',
	periodoId: 'periodo-1',
	replayRunId: null,
	fuentesEsperadas: 0,
	fuentesCubiertas: 0,
	motivos: ['REPLAY_AUSENTE'],
};

const PROBLEMA: ProblemaIntegridadReverso = {
	codigo: 'REVERSO_NO_ENCONTRADO',
	asientoId: 'original-1',
	detalle: 'El original declara un reverso que no existe',
};

describe('resolveFormalAvailability', () => {
	it('permite publicar con cobertura acreditada e integridad sin problemas', () => {
		expect(resolveFormalAvailability(COBERTURA_CUBIERTA, [])).toBeNull();
	});

	it('no permite publicar cuando la cobertura no esta acreditada', () => {
		expect(resolveFormalAvailability(COBERTURA_NO_CUBIERTA, [])).toBe('COVERAGE_NOT_CREDIFIED');
	});

	it('no permite publicar cuando no hay cobertura evaluable', () => {
		expect(resolveFormalAvailability(null, [])).toBe('COVERAGE_NOT_CREDIFIED');
	});

	it('no permite publicar cuando la integridad de reversos falla', () => {
		expect(resolveFormalAvailability(COBERTURA_CUBIERTA, [PROBLEMA])).toBe(
			'REVERSAL_INTEGRITY_FAILED',
		);
	});

	it('reporta la falta de cobertura antes que la falla de integridad', () => {
		expect(resolveFormalAvailability(COBERTURA_NO_CUBIERTA, [PROBLEMA])).toBe(
			'COVERAGE_NOT_CREDIFIED',
		);
	});
});
