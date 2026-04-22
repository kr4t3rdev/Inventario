import { describe, expect, it } from 'vitest'

import { calcularTotalDeudaConInteres, calcularSaldoPendienteDeuda, normalizarEstadoDeudaCash } from './deuda-cash'

describe('deuda-cash utils', () => {
  it('calcula saldo pendiente restando lo pagado', () => {
    expect(calcularSaldoPendienteDeuda(1000, 250)).toBe(750)
  })

  it('calcula total deuda con interés', () => {
    expect(calcularTotalDeudaConInteres(1000, 10)).toBe(1100)
  })

  it('normaliza como pagada una deuda con saldo mínimo', () => {
    expect(
      normalizarEstadoDeudaCash('ACTIVO', {
        montoDeuda: 1000,
        montoPagado: 999.999,
        estado: 'PARCIAL',
      })
    ).toBe('PAGADO')
  })
})
