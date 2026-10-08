import { describe, expect, it } from 'vitest';
import {
  buildManualAperturaDraftInput,
  canCreateManualAperturaDraft,
  isCurrentAperturaContext,
} from '../periodos-page-client';

describe('buildManualAperturaDraftInput', () => {
  it('builds CUP lines with explicit self-declared evidence and no actor or tenant fields', () => {
    const payload = buildManualAperturaDraftInput({
      periodoId: 'period-1',
      aperturaId: 'opening-1',
      fechaCorte: '2026-01-01',
      lines: [{
        role: 'CAJA', accountId: 'cash-1', label: '101 - Caja', side: 'DEBE',
        amount: '10.00', reference: 'INV-1', note: 'Declarado por el usuario',
      }],
    });

    expect(payload).toMatchObject({
      periodoId: 'period-1', aperturaId: 'opening-1',
      lines: [{
        rolCuenta: 'CAJA', cuentaId: 'cash-1', lado: 'DEBE',
        monedaNativa: 'CUP', importeNativo: '10.00', importeFuncional: '10.00',
        fuenteTipo: 'MANUAL', fuenteId: 'INV-1', evidenciaVersion: 1,
        fuenteSnapshot: expect.objectContaining({
          declaredSource: 'MANUAL_USER_DECLARATION', note: 'Declarado por el usuario',
        }),
      }],
    });
    expect(payload).not.toHaveProperty('tenantId');
    expect(payload).not.toHaveProperty('actorId');
  });
});

describe('canCreateManualAperturaDraft', () => {
  it('does not allow a new draft after approval', () => {
    expect(canCreateManualAperturaDraft('APROBADA')).toBe(false);
  });

  it('allows a first draft and a correction after rejection', () => {
    expect(canCreateManualAperturaDraft(undefined)).toBe(true);
    expect(canCreateManualAperturaDraft('RECHAZADA')).toBe(true);
  });
});

describe('opening context request ordering', () => {
  it('does not let a delayed period A response replace selected period B', async () => {
    let latestRequestId = 0;
    let selectedPeriodId = 'A';
    let displayedPeriodId = '';
    let resolveA!: (value: { periodoId: string }) => void;
    let resolveB!: (value: { periodoId: string }) => void;
    const responseA = new Promise<{ periodoId: string }>((resolve) => { resolveA = resolve; });
    const responseB = new Promise<{ periodoId: string }>((resolve) => { resolveB = resolve; });

    const load = async (periodoId: string, response: Promise<{ periodoId: string }>) => {
      selectedPeriodId = periodoId;
      const requestId = ++latestRequestId;
      await response;
      if (isCurrentAperturaContext(requestId, latestRequestId, periodoId, selectedPeriodId)) {
        displayedPeriodId = periodoId;
      }
    };

    const requestA = load('A', responseA);
    const requestB = load('B', responseB);
    resolveB({ periodoId: 'B' });
    await requestB;
    resolveA({ periodoId: 'A' });
    await requestA;

    expect(displayedPeriodId).toBe('B');
  });
});
