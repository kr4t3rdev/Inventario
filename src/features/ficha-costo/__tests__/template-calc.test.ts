import { describe, expect, it } from 'vitest'

import { calcularPrecioSugerido } from '../lib/template-calc'

describe('template-calc', () => {
  it('calcula precio sugerido con margen sobre precio de venta', () => {
    expect(calcularPrecioSugerido(100, 0.3)).toBeCloseTo(142.857, 3)
  })

  it('mantiene cero cuando el costo total es cero', () => {
    expect(calcularPrecioSugerido(0, 0.3)).toBe(0)
  })

  it('rechaza margenes fuera del rango valido', () => {
    expect(() => calcularPrecioSugerido(100, 0)).toThrow(
      'margenObjetivo debe estar entre 0 y 1 (exclusivo)',
    )
    expect(() => calcularPrecioSugerido(100, 1)).toThrow(
      'margenObjetivo debe estar entre 0 y 1 (exclusivo)',
    )
  })
})
