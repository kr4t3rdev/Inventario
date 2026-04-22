import { describe, expect, it } from 'vitest'

import { calculateAnticiposTotal } from '../resumen-financiero'

describe('calculateAnticiposTotal', () => {
  it('suma el total de anticipos por moneda', () => {
    expect(
      calculateAnticiposTotal([
        { moneda: 'CUP', total: 1250 },
        { moneda: 'USD', total: 300 },
      ])
    ).toBe(1550)
  })
})
