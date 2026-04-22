import { describe, expect, it } from 'vitest'

import { calcularMontoTotalACobrar, calcularSaldoPendientePrestamo } from './prestamo-cash-utils'
import { normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'

describe('prestamo-cash-utils', () => {
  it('calcula el total a cobrar usando capital más interés', () => {
    expect(calcularMontoTotalACobrar(1000, 10)).toBe(1100)
  })

  it('calcula saldo pendiente restando lo pagado a la deuda total', () => {
    expect(calcularSaldoPendientePrestamo(1100, 250)).toBe(850)
  })

  it('nunca devuelve saldo negativo', () => {
    expect(calcularSaldoPendientePrestamo(100, 120)).toBe(0)
  })

  it('normaliza como pagado un préstamo con saldo despreciable', () => {
    expect(
      normalizarEstadoPrestamoCash('ACTIVO', {
        montoDeuda: 1100,
        montoPagado: 1099.999,
        estado: 'PARCIAL',
      })
    ).toBe('PAGADO')
  })
})
