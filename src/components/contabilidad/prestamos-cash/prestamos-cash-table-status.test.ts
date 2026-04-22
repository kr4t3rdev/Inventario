import { describe, expect, it } from 'vitest'

import { calcularSaldoPendientePrestamo, normalizarEstadoPrestamoCash } from '@/lib/utils/prestamo-cash'

describe('prestamos cash table status', () => {
  it('deshabilita pago cuando el saldo es cero aunque el estado crudo sea ACTIVO', () => {
    const estado = normalizarEstadoPrestamoCash('ACTIVO', {
      montoDeuda: 1100,
      montoPagado: 1100,
      estado: 'PAGADA',
    })

    expect(estado).toBe('PAGADO')
    expect(calcularSaldoPendientePrestamo(1100, 1100)).toBe(0)
  })
})
