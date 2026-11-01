import { describe, expect, it } from 'vitest'
import { buildAnticipoEvent } from '@/features/contabilidad-formal/lib/advance-event-builder'

describe('buildAnticipoEvent', () => {
  it('construye el recibo de cliente con la cuenta de tesorería configurada', () => {
    const event = buildAnticipoEvent({
      anticipoMovimientoId: 'movement-1',
      tipo: 'ANTICIPO_CLIENTE_RECIBIDO',
      fecha: new Date('2026-11-01T12:00:00.000Z'),
      monto: 40,
      moneda: 'CUP',
      montoFuncional: 40,
      monedaFuncional: 'CUP',
      treasuryAccountType: 'EFECTIVO',
    })

    expect(event).toMatchObject({
      tipo: 'ANTICIPO_CLIENTE_RECIBIDO',
      origen: { tipo: 'anticipo_movimiento', id: 'movement-1' },
      monto: 40,
      montoFuncional: 40,
      medioCobro: 'CAJA',
    })
  })

  it('construye la aplicación del proveedor usando la valoración y evidencia persistidas', () => {
    const event = buildAnticipoEvent({
      anticipoMovimientoId: 'movement-2',
      tipo: 'ANTICIPO_PROVEEDOR_APLICADO',
      fecha: new Date('2026-11-01T12:00:00.000Z'),
      monto: 20,
      moneda: 'USD',
      montoFuncional: 800,
      monedaFuncional: 'CUP',
      tasaCambio: 40,
      fxEvidenceFingerprint: 'fx-fingerprint',
    })

    expect(event).toMatchObject({
      tipo: 'ANTICIPO_PROVEEDOR_APLICADO',
      montoFuncional: 800,
      monedaFuncional: 'CUP',
      tasaCambio: 40,
      fxEvidenceFingerprint: 'fx-fingerprint',
      origen: { tipo: 'anticipo_movimiento', id: 'movement-2' },
    })
    expect(event.medioCobro).toBeUndefined()
  })
})
