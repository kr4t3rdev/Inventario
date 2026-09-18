import { describe, expect, it } from 'vitest';
import {
  buildMovimientosExportParams,
  type FiltrosGlobalesReporte,
  type FiltrosLocalesMovimientosReporte,
} from './reportes-filters';

const globalesVacio: FiltrosGlobalesReporte = {
  fechaInicio: '',
  fechaFin: '',
  cuentaId: '',
};

const localesVacio: FiltrosLocalesMovimientosReporte = {
  busqueda: '',
  tipoMovimiento: '',
  moneda: '',
  page: 1,
  limit: 10,
};

describe('buildMovimientosExportParams', () => {
  it('incluye solo el formato cuando todos los filtros están vacíos', () => {
    const params = buildMovimientosExportParams('csv', globalesVacio, localesVacio);
    expect(params.toString()).toBe('formato=csv&page=1&limit=10');
  });

  it('preserva solo filtros con valor — nunca emite strings vacíos', () => {
    const params = buildMovimientosExportParams(
      'pdf',
      { fechaInicio: '', fechaFin: '2026-04-30', cuentaId: '' },
      { busqueda: '', tipoMovimiento: '', moneda: 'USD', page: 2, limit: 25 },
    );
    const qs = params.toString();
    expect(qs).toContain('formato=pdf');
    expect(qs).toContain('fechaFin=2026-04-30');
    expect(qs).not.toContain('fechaInicio=');
    expect(qs).toContain('page=2');
    expect(qs).toContain('limit=25');
    expect(qs).toContain('moneda=USD');
    expect(qs).not.toContain('cuentaId=');
    expect(qs).not.toContain('busqueda=');
    expect(qs).not.toContain('tipoMovimiento=');
  });

  it('distingue la cuenta global de la cuenta local de Movimientos', () => {
    const params = buildMovimientosExportParams(
      'csv',
      { fechaInicio: '', fechaFin: '', cuentaId: 'cta-global' },
      { busqueda: '', tipoMovimiento: '', moneda: '', page: 1, limit: 10 },
    );
    const qs = params.toString();
    expect(qs).toContain('cuentaId=cta-global');
    expect(qs).toContain('page=1');
    expect(qs).toContain('limit=10');
    expect(qs).not.toContain('cuentaIdLocal');
  });
});
