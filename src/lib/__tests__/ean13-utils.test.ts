import { describe, expect, it } from 'vitest'
import { calculateEan13CheckDigit, generateEan13BusinessCode } from '@/lib/ean13-utils'

describe('ean13-utils', () => {
  it('calcula DC para ejemplo 011402850001 -> 2', () => {
    expect(calculateEan13CheckDigit('011402850001')).toBe('2')
  })

  it('calcula DC para ejemplo 012917790010 -> 1', () => {
    expect(calculateEan13CheckDigit('012917790010')).toBe('1')
  })

  it('genera codigo completo con segmentos', () => {
    const result = generateEan13BusinessCode({
      proveedorCodigo: '1',
      idSeccionCodigo: '14',
      especificoCodigo: '285',
      surtidoCodigo: '1',
    })

    expect(result.base12).toBe('011402850001')
    expect(result.dcCodigo).toBe('2')
    expect(result.codigoNegocio).toBe('0114028500012')
  })
})
