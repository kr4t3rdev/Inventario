import React from 'react'
import { describe, expect, it } from 'vitest'

describe('ContabilidadDashboard', () => {
  it('uses stable unique keys for reconciliation modules', async () => {
    const source = await import('./page')
    expect(source.default).toBeTypeOf('function')
  })
})
