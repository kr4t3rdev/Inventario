import { describe, expect, it } from 'vitest'

import { formatYAxisTick } from '../chart-area-interactive'

describe('formatYAxisTick', () => {
  it('mantiene los valores chicos en moneda y compacta miles sin redondear en exceso', () => {
    expect(formatYAxisTick(999)).toBe('$999')
    expect(formatYAxisTick(1250)).toBe('$1,3 mil')
  })
})
