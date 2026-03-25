import { describe, expect, it } from 'vitest'

import { 
  calcularCostoProduccion, 
  validarDisponibilidadMateriales,
  calcularRendimientoConMerma
} from '@/lib/utils/produccion'

describe('produccion utilities', () => {
  describe('calcularCostoProduccion', () => {
    it('calcula el costo total correctamente', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 100
          }
        },
        {
          productoId: 'prod-2',
          cantidad: 1,
          producto: {
            nombre: 'Azúcar',
            precioCosto: 5,
            stock: 50
          }
        }
      ]

      const resultado = calcularCostoProduccion(ingredientes, 10)

      // 2 * 10 = 20 unidades de harina a 10 = 200
      // 1 * 10 = 10 unidades de azúcar a 5 = 50
      // Total = 250
      expect(resultado.costoMateriales).toBe(250)
      expect(resultado.costoUnitario).toBe(25) // 250 / 10
      expect(resultado.detalle).toHaveLength(2)
    })

    it('maneja cantidad cero correctamente', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 100
          }
        }
      ]

      const resultado = calcularCostoProduccion(ingredientes, 0)

      expect(resultado.costoMateriales).toBe(0)
      expect(resultado.costoUnitario).toBe(0)
    })

    it('calcula correctamente con producto sin precio de costo', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: {
            nombre: 'Harina',
            precioCosto: 0,
            stock: 100
          }
        }
      ]

      const resultado = calcularCostoProduccion(ingredientes, 5)

      expect(resultado.costoMateriales).toBe(0)
      expect(resultado.costoUnitario).toBe(0)
    })
  })

  describe('validarDisponibilidadMateriales', () => {
    it('retorna array vacío cuando hay materiales suficientes', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 100
          }
        },
        {
          productoId: 'prod-2',
          cantidad: 1,
          producto: {
            nombre: 'Azúcar',
            precioCosto: 5,
            stock: 50
          }
        }
      ]

      // Producir 10 unidades requiere: harina 20, azúcar 10
      // Stock disponible: harina 100, azúcar 50
      const faltantes = validarDisponibilidadMateriales(ingredientes, 10)

      expect(faltantes).toHaveLength(0)
    })

    it('retorna materiales faltantes cuando haystock insuficiente', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 10
          }
        },
        {
          productoId: 'prod-2',
          cantidad: 1,
          producto: {
            nombre: 'Azúcar',
            precioCosto: 5,
            stock: 50
          }
        }
      ]

      // Producir 10 unidades requiere: harina 20, azúcar 10
      // Stock disponible: harina 10, azúcar 50
      const faltantes = validarDisponibilidadMateriales(ingredientes, 10)

      expect(faltantes).toHaveLength(1)
      expect(faltantes[0].productoId).toBe('prod-1')
      expect(faltantes[0].requerido).toBe(20)
      expect(faltantes[0].disponible).toBe(10)
    })

    it('detecta múltiples materiales faltantes', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 5,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 20
          }
        },
        {
          productoId: 'prod-2',
          cantidad: 3,
          producto: {
            nombre: 'Azúcar',
            precioCosto: 5,
            stock: 10
          }
        }
      ]

      // Producir 10 unidades requiere: harina 50, azúcar 30
      // Stock disponible: harina 20, azúcar 10
      const faltantes = validarDisponibilidadMateriales(ingredientes, 10)

      expect(faltantes).toHaveLength(2)
    })

    it('maneja producto sin información de stock', () => {
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          producto: undefined
        }
      ]

      const faltantes = validarDisponibilidadMateriales(ingredientes, 10)

      expect(faltantes).toHaveLength(1)
      expect(faltantes[0].disponible).toBe(0)
    })
  })

  describe('calcularRendimientoConMerma', () => {
    it('calcula rendimiento sin merma', () => {
      const resultado = calcularRendimientoConMerma(100, 0)
      expect(resultado).toBe(100)
    })

    it('calcula rendimiento con merma del 10%', () => {
      const resultado = calcularRendimientoConMerma(100, 10)
      expect(resultado).toBe(90)
    })

    it('calcula rendimiento con merma del 50%', () => {
      const resultado = calcularRendimientoConMerma(100, 50)
      expect(resultado).toBe(50)
    })

    it('calcula rendimiento con merma del 100%', () => {
      const resultado = calcularRendimientoConMerma(100, 100)
      expect(resultado).toBe(0)
    })

    it('lanza error con merma negativa', () => {
      expect(() => calcularRendimientoConMerma(100, -10)).toThrow()
    })

    it('lanza error con merma mayor a 100', () => {
      expect(() => calcularRendimientoConMerma(100, 110)).toThrow()
    })
  })
})
