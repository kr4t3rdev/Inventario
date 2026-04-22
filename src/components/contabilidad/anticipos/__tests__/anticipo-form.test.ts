import { describe, expect, it } from 'vitest'

import { buildCreateAnticipoPayload } from '../anticipo-form'

describe('buildCreateAnticipoPayload', () => {
  it('incluye referenciaExterna y normaliza vigenciaHasta', () => {
    const payload = buildCreateAnticipoPayload(
      {
        tipo: 'COBRO',
        contratoId: 'ctr-1',
        clienteId: 'cli-form',
        monto: 250.5,
        moneda: 'USD',
        cuentaOrigenId: 'cta-1',
        tipoPagoOrigenId: 'tp-1',
        referenciaExterna: 'FAC-123',
        vigenciaHasta: '',
      },
      undefined,
      'cli-contrato',
    )

    expect(payload).toEqual({
      tipo: 'COBRO',
      contratoId: 'ctr-1',
      proveedorId: undefined,
      clienteId: 'cli-contrato',
      monto: 250.5,
      moneda: 'USD',
      cuentaOrigenId: 'cta-1',
      tipoPagoOrigenId: 'tp-1',
      referenciaExterna: 'FAC-123',
      vigenciaHasta: undefined,
    })
  })
})
