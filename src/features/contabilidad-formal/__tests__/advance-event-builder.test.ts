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

  it('construye un asiento compensatorio anclado al movimiento de reverso', () => {
    const event = buildAnticipoEvent({
      anticipoMovimientoId: 'movement-reverse-1',
      tipo: 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA',
      fecha: new Date('2026-11-01T12:00:00.000Z'),
      monto: 40,
      moneda: 'USD',
      montoFuncional: 1200,
      monedaFuncional: 'CUP',
      tasaCambio: 30,
      fxEvidenceFingerprint: 'fx-fingerprint',
    })

    expect(event).toMatchObject({
      tipo: 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA',
      descripcion: 'Reverso de aplicación de anticipo a proveedor',
      origen: { tipo: 'anticipo_movimiento', id: 'movement-reverse-1' },
      montoFuncional: 1200,
    })
    expect(event.medioCobro).toBeUndefined()
  })

  it('expone la devolución monetaria de cliente con efectivo y diferencia FX', () => {
    const event = buildAnticipoEvent({
      anticipoMovimientoId: 'refund-1',
      tipo: 'ANTICIPO_CLIENTE_DEVUELTO',
      fecha: new Date('2026-11-01T12:00:00.000Z'),
      monto: 20,
      moneda: 'USD',
      montoFuncional: 700,
      monedaFuncional: 'CUP',
      tasaCambio: 35,
      fxEvidenceFingerprint: 'refund-fx',
      diferenciaFx: 100,
      treasuryAccountType: 'CORRIENTE',
    })

    expect(event).toMatchObject({
      tipo: 'ANTICIPO_CLIENTE_DEVUELTO',
      origen: { tipo: 'anticipo_movimiento', id: 'refund-1' },
      medioCobro: 'BANCOS',
      auxiliares: { diferenciaFx: 100 },
    })
  })
})
