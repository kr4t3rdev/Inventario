import { describe, expect, it } from 'vitest'

import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards'

describe('anticipos-guards', () => {
  it('retorna false cuando no hay movimientos', async () => {
    const db = {
      anticipoMovimiento: {
        findMany: async () => []
      }
    }

    const result = await hasUnrevertedAnticipoExecution(db as any, 'doc-1')
    expect(result).toBe(false)
  })

  it('retorna true cuando existe ejecucion sin reverso', async () => {
    const db = {
      anticipoMovimiento: {
        findMany: async () => [
          { anticipoId: 'ant-1', tipoMovimiento: 'EJECUCION' }
        ]
      }
    }

    const result = await hasUnrevertedAnticipoExecution(db as any, 'doc-2')
    expect(result).toBe(true)
  })

  it('retorna false cuando todas las ejecuciones estan revertidas', async () => {
    const db = {
      anticipoMovimiento: {
        findMany: async () => [
          { anticipoId: 'ant-1', tipoMovimiento: 'EJECUCION' },
          { anticipoId: 'ant-1', tipoMovimiento: 'REVERSO' }
        ]
      }
    }

    const result = await hasUnrevertedAnticipoExecution(db as any, 'doc-3')
    expect(result).toBe(false)
  })
})
