import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormalReportUnavailable } from './formal-report-unavailable';

describe('FormalReportUnavailable', () => {
	it('explica la causa y descarta presentar importes parciales', () => {
		render(
			<FormalReportUnavailable
				reason="COVERAGE_NOT_CREDIFIED"
				motivos={[]}
				problems={[]}
			/>,
		);

		expect(screen.getByText('Este reporte no está disponible')).toBeDefined();
		expect(screen.getByText(/no tiene cobertura global acreditada/i)).toBeDefined();
		expect(screen.getByText(/No se presentaron importes parciales/i)).toBeDefined();
	});

	it('traduce los motivos de cobertura a lenguaje comprensible', () => {
		render(
			<FormalReportUnavailable
				reason="COVERAGE_NOT_CREDIFIED"
				motivos={['REPLAY_AUSENTE', 'LIBRO_VACIO']}
				problems={[]}
			/>,
		);

		expect(screen.getByText(/No hay una ejecución de replay/i)).toBeDefined();
		expect(screen.getByText(/no tiene asientos en el mayor formal/i)).toBeDefined();
	});

	it('muestra los problemas de integridad de reversos', () => {
		render(
			<FormalReportUnavailable
				reason="REVERSAL_INTEGRITY_FAILED"
				motivos={[]}
				problems={[{ detalle: 'El original declara un reverso que no existe' }]}
			/>,
		);

		expect(screen.getByText('El original declara un reverso que no existe')).toBeDefined();
		expect(screen.getByText(/inconsistencias en los vínculos de reversión/i)).toBeDefined();
	});
});
