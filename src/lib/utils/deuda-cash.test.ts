import { describe, expect, it } from 'vitest'

import { calcularTotalDeudaConInteres, calcularSaldoPendienteDeuda, normalizarEstadoDeudaCash } from './deuda-cash'
import { calcularSaldoPendientePrestamo } from './prestamo-cash'

describe('deuda-cash utils', () => {
  it('calcula saldo pendiente restando lo pagado', () => {
    expect(calcularSaldoPendienteDeuda(1000, 250)).toBe(750)
  })

  it('preserva precisión de cuatro decimales para pagos parciales', () => {
    expect(calcularSaldoPendienteDeuda(1, 0.0123)).toBe(0.9877)
    expect(calcularSaldoPendientePrestamo(1, 0.0123)).toBe(0.9877)
  })

  it('calcula total deuda con interés', () => {
    expect(calcularTotalDeudaConInteres(1000, 10)).toBe(1100)
  })

  it('mantiene activa una deuda con saldo positivo, aunque sea mínimo', () => {
    expect(
      normalizarEstadoDeudaCash('ACTIVO', {
        montoDeuda: 1000,
        montoPagado: 999.999,
        estado: 'PARCIAL',
      })
    ).toBe('ACTIVO')
  })
})
