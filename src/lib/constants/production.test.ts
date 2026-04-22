import { describe, expect, it } from 'vitest';

import type { EstadoProduccion, EstadoValeSalida } from '@/app/models/model';

import { PRODUCTION_STATES } from './production';

const pendingState: EstadoProduccion = PRODUCTION_STATES.PENDIENTE;
const inProgressState: EstadoProduccion = PRODUCTION_STATES.EN_PROCESO;
const completedState: EstadoProduccion = PRODUCTION_STATES.COMPLETADA;
const cancelledState: EstadoProduccion = PRODUCTION_STATES.CANCELADA;

const completedValeState: EstadoValeSalida = 'COMPLETADA';
const pendingValeState: EstadoValeSalida = 'PENDIENTE';
const cancelledValeState: EstadoValeSalida = 'ANULADA';

/**
 * @description Verifica en runtime los valores compartidos una vez validados por TypeScript.
 * @returns {void}
 */
describe('production constants', () => {
  it('uses uppercase shared order states', () => {
    expect(pendingState).toBe('PENDIENTE');
    expect(inProgressState).toBe('EN_PROCESO');
    expect(completedState).toBe('COMPLETADA');
    expect(cancelledState).toBe('CANCELADA');
  });

  it('uses uppercase vale states', () => {
    expect(completedValeState).toBe('COMPLETADA');
    expect(pendingValeState).toBe('PENDIENTE');
    expect(cancelledValeState).toBe('ANULADA');
  });
});
