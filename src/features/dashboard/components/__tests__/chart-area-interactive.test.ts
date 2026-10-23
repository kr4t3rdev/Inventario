import { describe, expect, it } from 'vitest'

import { formatYAxisTick, transformData } from '../chart-area-interactive'

describe('formatYAxisTick', () => {
  it('mantiene los valores chicos en moneda y compacta miles sin redondear en exceso', () => {
    expect(formatYAxisTick(999)).toBe('$999')
    expect(formatYAxisTick(1250)).toBe('$1,3 mil')
  })
})

describe('transformData', () => {
  it('separa las compras de inventario (salida de caja) de los gastos operativos del beneficio', () => {
    const [point] = transformData([
      {
        mes: 'ene',
        ingresosVentas: 1000,
        ingresosServicios: 200,
        gastosMermas: 50,
        gastosDeExplotacion: 100,
        gastosDeExplotacionCantidad: 1,
        gastosCompras: 800,
        gastosComprasCantidad: 2,
        gastosSalarios: 300,
        gastosSalariosCantidad: 3,
        ventasCantidad: 5,
        ventasServiciosCantidad: 2,
        mermasCantidad: 1,
      },
    ])

    expect(point.ingresos).toBe(1200)
    // Gastos operativos: salarios + mermas + explotación (sin compras)
    expect(point.gastos).toBe(450)
    // Las compras van como serie propia de salida de caja
    expect(point.compras).toBe(800)
    // El beneficio es devengo: las compras NO restan (se reconocen vía COGS al vender)
    expect(point.beneficio).toBe(750)
  })
})
