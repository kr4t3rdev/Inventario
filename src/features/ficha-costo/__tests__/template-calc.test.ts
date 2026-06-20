import { describe, it, expect } from 'vitest'
import {
  calcularPrecioSugerido,
  calcularCostoTotalPlantilla,
  compararPlantillaVsActual,
} from '../lib/template-calc'

describe('template-calc', () => {
  describe('calcularPrecioSugerido', () => {
    it('calcula precio sugerido con margen 30%', () => {
      const precio = calcularPrecioSugerido(100, 0.30)
      expect(precio).toBeCloseTo(142.857, 2)
    })

    it('calcula precio sugerido con margen 50%', () => {
      const precio = calcularPrecioSugerido(100, 0.50)
      expect(precio).toBe(200)
    })

    it('con margen 0% el precio es igual al costo', () => {
      const precio = calcularPrecioSugerido(100, 0.01)
      expect(precio).toBeCloseTo(101.01, 2)
    })

    it('con costo 0 el precio es 0', () => {
      const precio = calcularPrecioSugerido(0, 0.30)
      expect(precio).toBe(0)
    })

    it('rechaza margen <= 0', () => {
      expect(() => calcularPrecioSugerido(100, 0)).toThrow()
      expect(() => calcularPrecioSugerido(100, -0.1)).toThrow()
    })

    it('rechaza margen >= 1', () => {
      expect(() => calcularPrecioSugerido(100, 1)).toThrow()
      expect(() => calcularPrecioSugerido(100, 1.5)).toThrow()
    })

    it('rechaza costo negativo', () => {
      expect(() => calcularPrecioSugerido(-10, 0.30)).toThrow()
    })

    it('rechaza valores no numéricos', () => {
      expect(() => calcularPrecioSugerido(NaN, 0.30)).toThrow()
      expect(() => calcularPrecioSugerido(100, NaN)).toThrow()
    })
  })

  describe('calcularCostoTotalPlantilla', () => {
    it('suma materiales + MO + indirectos', () => {
      const total = calcularCostoTotalPlantilla(100, 50, 25)
      expect(total).toBe(175)
    })

    it('con valores en 0 devuelve 0', () => {
      const total = calcularCostoTotalPlantilla(0, 0, 0)
      expect(total).toBe(0)
    })

    it('ignora valores no numéricos (los trata como 0)', () => {
      const total = calcularCostoTotalPlantilla(100, NaN, 25)
      expect(total).toBe(125)
    })
  })

  describe('compararPlantillaVsActual', () => {
    it('calcula deltas y margen actual correctamente', () => {
      const result = compararPlantillaVsActual(150, 200, 0.25, 100, 180)
      expect(result.deltaCostoVsActual).toBe(50)
      expect(result.deltaPrecioVsVenta).toBe(20)
      expect(result.margenActual).toBeCloseTo(44.44, 2)
    })

    it('margen actual es null cuando precioVenta es 0', () => {
      const result = compararPlantillaVsActual(100, 150, 0.33, 100, 0)
      expect(result.margenActual).toBeNull()
    })

    it('deltas negativos cuando plantilla es menor', () => {
      const result = compararPlantillaVsActual(80, 100, 0.20, 100, 150)
      expect(result.deltaCostoVsActual).toBe(-20)
      expect(result.deltaPrecioVsVenta).toBe(-50)
    })
  })
})
