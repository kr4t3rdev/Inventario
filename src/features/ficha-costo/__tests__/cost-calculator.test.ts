import { describe, it, expect } from 'vitest'
import {
  calcularCPP,
  calcularCostoMateriales,
  calcularMargen,
  normalizarMoneda,
  calcularVariacion,
  type CompraInput,
  type IngredienteInput,
} from '../lib/cost-calculator'

describe('calcularCPP', () => {
  it('promedia compras simples en la misma moneda', () => {
    const compras: CompraInput[] = [
      { cantidad: 100, precioUnitario: 500, gastoProporcional: 0 },
      { cantidad: 200, precioUnitario: 520, gastoProporcional: 0 },
    ]
    const cpp = calcularCPP(compras)
    // (100*500 + 200*520) / 300 = 154000 / 300 = 513.33
    expect(cpp).toBeCloseTo(513.33, 2)
  })

  it('incluye gastos proporcionales en el cálculo', () => {
    // gastoProporcional ya viene prorrateado por línea desde la Server Action.
    const compras: CompraInput[] = [
      { cantidad: 100, precioUnitario: 500, gastoProporcional: 2000 },
      { cantidad: 50, precioUnitario: 480, gastoProporcional: 1000 },
    ]
    const cpp = calcularCPP(compras)
    // (100*500 + 2000 + 50*480 + 1000) / 150 = 77000 / 150 = 513.33
    expect(cpp).toBeCloseTo(513.33, 2)
  })

  it('retorna 0 cuando no hay compras', () => {
    expect(calcularCPP([])).toBe(0)
  })

  it('retorna 0 cuando las cantidades son cero', () => {
    const compras: CompraInput[] = [
      { cantidad: 0, precioUnitario: 100, gastoProporcional: 0 },
    ]
    expect(calcularCPP(compras)).toBe(0)
  })
})

describe('calcularCostoMateriales', () => {
  it('suma cantidad × CPP por ingrediente con desperdicio', () => {
    const ingredientes: IngredienteInput[] = [
      { productoId: 'a', cantidad: 5, desperdicio: 0, cppIngrediente: 100 },
      { productoId: 'b', cantidad: 10, desperdicio: 0, cppIngrediente: 20 },
    ]
    const r = calcularCostoMateriales(ingredientes)
    // (5*100) + (10*20) = 700
    expect(r.total).toBe(700)
    expect(r.ingredientesSinCosto).toBe(0)
  })

  it('aplica desperdicio como porcentaje sobre la cantidad', () => {
    const ingredientes: IngredienteInput[] = [
      { productoId: 'a', cantidad: 10, desperdicio: 10, cppIngrediente: 100 },
    ]
    // cantidad efectiva = 10 * 1.10 = 11; costo = 11 * 100 = 1100
    const r = calcularCostoMateriales(ingredientes)
    expect(r.total).toBe(1100)
  })

  it('excluye ingredientes sin CPP y los reporta', () => {
    const ingredientes: IngredienteInput[] = [
      { productoId: 'a', cantidad: 5, desperdicio: 0, cppIngrediente: 100 },
      { productoId: 'b', cantidad: 8, desperdicio: 0, cppIngrediente: null },
    ]
    const r = calcularCostoMateriales(ingredientes)
    // 5*100 = 500; el null no aporta
    expect(r.total).toBe(500)
    expect(r.ingredientesSinCosto).toBe(1)
  })
})

describe('calcularMargen', () => {
  it('clasifica margen saludable (>10%)', () => {
    const m = calcularMargen(500, 800)
    expect(m.absoluto).toBe(300)
    expect(m.porcentaje).toBeCloseTo(37.5, 2)
    expect(m.estado).toBe('SALUDABLE')
  })

  it('clasifica margen bajo (entre 0% y 10%)', () => {
    const m = calcularMargen(750, 800)
    expect(m.porcentaje).toBeCloseTo(6.25, 2)
    expect(m.estado).toBe('BAJO')
  })

  it('clasifica pérdida (margen negativo)', () => {
    const m = calcularMargen(900, 800)
    expect(m.porcentaje).toBeCloseTo(-12.5, 2)
    expect(m.estado).toBe('PERDIDA')
  })

  it('no divide por cero cuando precioVenta es 0', () => {
    const m = calcularMargen(500, 0)
    expect(m.absoluto).toBeNull()
    expect(m.porcentaje).toBeNull()
    expect(m.estado).toBe('SIN_PRECIO')
  })

  it('margen exactamente 10% queda en SALUDABLE (umbral inclusivo)', () => {
    const m = calcularMargen(720, 800)
    expect(m.porcentaje).toBe(10)
    expect(m.estado).toBe('SALUDABLE')
  })
})

describe('normalizarMoneda', () => {
  it('retorna el mismo monto cuando origen === destino', () => {
    const r = normalizarMoneda(100, 'CUP', 'CUP', () => null)
    expect(r.valor).toBe(100)
    expect(r.nota).toBeUndefined()
  })

  it('convierte usando la tasa del lookup', () => {
    const fecha = new Date('2026-06-15')
    const lookup = (f: Date, o: string, d: string) =>
      f.getTime() === fecha.getTime() && o === 'USD' && d === 'CUP'
        ? { tasa: 120, fechaTasa: fecha }
        : null
    const r = normalizarMoneda(10, 'USD', 'CUP', lookup, fecha)
    expect(r.valor).toBe(1200)
    expect(r.tasaUsada).toBe(120)
    expect(r.nota).toBeNull()
  })

  it('marca TASA_APROXIMADA cuando la fecha difiere más de 1 día', () => {
    const fechaDoc = new Date('2026-06-15')
    const fechaTasa = new Date('2026-06-10')
    const lookup = () => ({ tasa: 118, fechaTasa })
    const r = normalizarMoneda(10, 'USD', 'CUP', lookup, fechaDoc)
    expect(r.valor).toBe(1180)
    expect(r.nota).toBe('TASA_APROXIMADA')
  })

  it('retorna null con SIN_TASA cuando el lookup no devuelve nada', () => {
    const r = normalizarMoneda(10, 'USD', 'CUP', () => null)
    expect(r.valor).toBeNull()
    expect(r.nota).toBe('SIN_TASA')
  })
})

describe('calcularVariacion', () => {
  it('retorna SIN_DATOS si no hay costo estándar', () => {
    const r = calcularVariacion(500, null)
    expect(r.estado).toBe('SIN_DATOS')
  })

  it('retorna SIN_DATOS si el costo estándar es 0', () => {
    const r = calcularVariacion(500, 0)
    expect(r.estado).toBe('SIN_DATOS')
  })

  it('retorna OK si la variación está dentro de ±5%', () => {
    const r = calcularVariacion(510, 500)
    expect(r.porcentaje).toBeCloseTo(2, 1)
    expect(r.estado).toBe('OK')
  })

  it('retorna MAYOR si el real supera al estándar en más del 5%', () => {
    const r = calcularVariacion(600, 500)
    expect(r.porcentaje).toBe(20)
    expect(r.estado).toBe('MAYOR')
  })

  it('retorna MENOR si el real está por debajo del estándar en más del 5%', () => {
    const r = calcularVariacion(400, 500)
    expect(r.porcentaje).toBe(-20)
    expect(r.estado).toBe('MENOR')
  })
})
