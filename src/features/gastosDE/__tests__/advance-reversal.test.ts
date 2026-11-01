import { beforeEach, describe, expect, it, vi } from 'vitest'

const reverseAnticipo = vi.hoisted(() => vi.fn().mockResolvedValue({ movimientoId: 'reverse-1' }))

vi.mock('@/lib/services/anticipos-workflow', () => ({ reverseAnticipo }))

import { reverseExpenseEffects } from '@/features/gastosDE/reversal'

describe('reverseExpenseEffects advance applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reverseAnticipo.mockResolvedValue({ movimientoId: 'reverse-1' })
  })

  it('reverses only the remaining application movements scoped to the tenant', async () => {
    const tx = {
      reconciliacionGasto: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      anticipoMovimiento: {
        findMany: vi.fn().mockResolvedValue([
          { anticipoId: 'advance-1', tipoMovimiento: 'EJECUCION', monto: 80 },
          { anticipoId: 'advance-1', tipoMovimiento: 'REVERSO', monto: 20 },
        ]),
      },
      anticipo: {},
    }

    const result = await reverseExpenseEffects(tx as never, {
      tenantId: 'tenant-1',
      referenciaId: 'service-1',
      tipoGasto: 'servicio',
      usuarioId: 'user-1',
      anticipoContext: true,
    })

    expect(tx.anticipoMovimiento.findMany).toHaveBeenCalledWith({
      where: {
        documentoDestinoId: 'service-1',
        tipoMovimiento: { in: ['EJECUCION', 'REVERSO'] },
        anticipo: { is: { tenantId: 'tenant-1' } },
      },
      select: { anticipoId: true, tipoMovimiento: true, monto: true },
    })
    expect(reverseAnticipo).toHaveBeenCalledWith(tx, {
      anticipoId: 'advance-1',
      tenantId: 'tenant-1',
      documentoDestinoId: 'service-1',
      montoReverso: 60,
      idempotencyKey: 'delete:servicio:service-1:advance:advance-1',
      usuarioId: 'user-1',
      observaciones: 'Reversión por eliminación de servicio service-1',
    })
    expect(result.anticipos).toBe(1)
  })
})
