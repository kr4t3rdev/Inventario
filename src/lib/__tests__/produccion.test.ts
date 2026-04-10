import { describe, expect, it } from 'vitest'

import { 
  calcularCostoProduccion, 
  validarDisponibilidadMateriales,
  calcularRendimientoConMerma
} from '@/lib/utils/produccion'
import {
  convertToBase,
  convertBetweenUnits,
  formatIngrediente,
  formatIngredientesList,
} from '@/lib/utils/unit-converter'

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

    it('incorpora desperdicio en la cantidad efectiva usada', () => {
      // ingrediente: cantidad 10, desperdicio 10% → cantidad efectiva = 10 * 1.10 * cantidadProducir
      const ingredientes = [
        {
          productoId: 'prod-1',
          cantidad: 10,
          desperdicio: 0.10,
          producto: {
            nombre: 'Harina',
            precioCosto: 1,
            stock: 200
          }
        }
      ]

      const resultado = calcularCostoProduccion(ingredientes, 5)

      // cantidad efectiva = 10 * 1.10 * 5 = 55 (no 50)
      expect(resultado.detalle[0].cantidad).toBe(55)
      expect(resultado.costoMateriales).toBe(55) // 55 * 1
      expect(resultado.costoUnitario).toBe(11)   // 55 / 5
    })

    it('desperdicio cero produce el mismo resultado que comportamiento sin desperdicio', () => {
      const ingredientesConDesperdicioCero = [
        {
          productoId: 'prod-1',
          cantidad: 2,
          desperdicio: 0,
          producto: {
            nombre: 'Harina',
            precioCosto: 10,
            stock: 100
          }
        }
      ]

      const ingredientesSinCampoDesperdicio = [
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

      const conCero = calcularCostoProduccion(ingredientesConDesperdicioCero, 10)
      const sinCampo = calcularCostoProduccion(ingredientesSinCampoDesperdicio, 10)

      expect(conCero.costoMateriales).toBe(sinCampo.costoMateriales)
      expect(conCero.costoUnitario).toBe(sinCampo.costoUnitario)
      expect(conCero.detalle[0].cantidad).toBe(sinCampo.detalle[0].cantidad)
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

  describe('unit-converter utilities', () => {
    describe('convertToBase', () => {
      it('convierte libras a gramos', () => {
        expect(convertToBase(2, 'lb')).toBeCloseTo(907.184, 3)
      })

      it('convierte kilogramos a gramos', () => {
        expect(convertToBase(1, 'kg')).toBe(1000)
      })

      it('convierte onzas a gramos', () => {
        expect(convertToBase(1, 'oz')).toBeCloseTo(28.3495, 4)
      })

      it('convierte litros a mililitros', () => {
        expect(convertToBase(1, 'L')).toBe(1000)
      })

      it('convierte cup a mililitros', () => {
        expect(convertToBase(1, 'cup')).toBe(240)
      })

      it('mantiene pass-through con unidad null', () => {
        expect(convertToBase(5, null)).toBe(5)
      })

      it('mantiene pass-through con unidad sin conversion', () => {
        expect(convertToBase(5, 'unidad')).toBe(5)
      })
    })

    describe('convertBetweenUnits', () => {
      it('convierte gramos a kilogramos usando unidad base', () => {
        expect(convertBetweenUnits(500, 'g', 'kg')).toBe(0.5)
      })

      it('convierte litros a mililitros usando unidad base', () => {
        expect(convertBetweenUnits(1.25, 'L', 'ml')).toBe(1250)
      })

      it('mantiene la cantidad cuando origen y destino coinciden', () => {
        expect(convertBetweenUnits(3, 'unidad', 'unidad')).toBe(3)
      })

      it('lanza error cuando origen y destino son incompatibles', () => {
        expect(() => convertBetweenUnits(1, 'kg', 'L')).toThrow('no son compatibles')
      })
    })

    describe('formatIngrediente', () => {
      it('formatea con unidad', () => {
        expect(formatIngrediente(2, 'lb', 'Arroz')).toBe('2 lb Arroz')
      })

      it('formatea sin unidad', () => {
        expect(formatIngrediente(5, null, 'Sal')).toBe('5 Sal')
      })

      it('formatea cantidad decimal', () => {
        expect(formatIngrediente(1.5, 'L', 'Aceite')).toBe('1.5 L Aceite')
      })
    })

    describe('formatIngredientesList', () => {
      it('formatea lista corta', () => {
        const lista = [
          { cantidad: 2, unidadSimbolo: 'lb', Producto: { nombre: 'Arroz' } },
          { cantidad: 5, unidadSimbolo: 'g', Producto: { nombre: 'Sal' } },
        ]

        expect(formatIngredientesList(lista)).toBe('2 lb Arroz, 5 g Sal')
      })

      it('formatea lista larga con truncado', () => {
        const lista = [
          { cantidad: 2, unidadSimbolo: 'lb', Producto: { nombre: 'Arroz' } },
          { cantidad: 5, unidadSimbolo: 'g', Producto: { nombre: 'Sal' } },
          { cantidad: 1, unidadSimbolo: 'oz', Producto: { nombre: 'Aceite' } },
          { cantidad: 3, unidadSimbolo: 'ml', Producto: { nombre: 'Vainilla' } },
          { cantidad: 2, unidadSimbolo: 'kg', Producto: { nombre: 'Harina' } },
        ]

        expect(formatIngredientesList(lista)).toBe('2 lb Arroz, 5 g Sal, 1 oz Aceite ... +2 mas')
      })

      it('retorna etiqueta de vacio', () => {
        expect(formatIngredientesList([])).toBe('Sin ingredientes')
      })
    })
  })
})
