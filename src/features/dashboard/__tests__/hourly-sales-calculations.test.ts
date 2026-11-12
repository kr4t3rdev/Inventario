import { describe, expect, it } from 'vitest'

// Pure aggregation functions — no prisma dependency
interface VentaMock {
  ventaId: string
  total: number | null
  cantidad: number
  createdAt: Date
  reconciliaciones: Array<{ monto: number; montoConvertido: number | null }>
}

interface VentaServicioMock {
  ventaServicioId: string
  total: number | null
  cantidad: number
  createdAt: Date
  reconciliaciones: Array<{ monto: number; montoConvertido: number | null }>
}

interface HourlyRow {
  hora: string
  total: number
  cantidad: number
}

interface DayHourRow {
  dia: string
  horas: HourlyRow[]
}

/**
 * Replicate the aggregation logic as pure functions for testing.
 * These mirror the implementation in wanda.ts.
 */
function calcularVentasPorHora(
  ventas: VentaMock[],
  ventasServicios: VentaServicioMock[],
): HourlyRow[] {
  const horas: Record<number, { hora: string; total: number; cantidad: number }> = {}
  for (let h = 0; h < 24; h++) {
    horas[h] = { hora: `${h.toString().padStart(2, '0')}:00`, total: 0, cantidad: 0 }
  }

  const procesar = (venta: { createdAt: Date; reconciliaciones: Array<{ monto: number; montoConvertido: number | null }>; total: number | null; cantidad: number }) => {
    const hora = venta.createdAt.getHours()
    const total =
      venta.reconciliaciones.reduce(
        (sum, r) => sum + Number(r.montoConvertido ?? r.monto),
        0,
      ) || (venta.total ?? 0)
    horas[hora].total += total
    horas[hora].cantidad += 1
  }

  ventas.forEach(procesar)
  ventasServicios.forEach(procesar)

  return Object.values(horas)
}

function calcularVentasPorDiaYHora(
  ventas: VentaMock[],
  ventasServicios: VentaServicioMock[],
): DayHourRow[] {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  const mapa: Record<string, Record<number, { hora: string; total: number; cantidad: number }>> = {}
  for (const dia of dias) {
    mapa[dia] = {}
    for (let h = 0; h < 24; h++) {
      mapa[dia][h] = { hora: `${h.toString().padStart(2, '0')}:00`, total: 0, cantidad: 0 }
    }
  }

  const procesar = (venta: { createdAt: Date; reconciliaciones: Array<{ monto: number; montoConvertido: number | null }>; total: number | null }) => {
    const diaIndex = venta.createdAt.getDay()
    const dia = dias[diaIndex]
    const hora = venta.createdAt.getHours()
    const total =
      venta.reconciliaciones.reduce(
        (sum, r) => sum + Number(r.montoConvertido ?? r.monto),
        0,
      ) || (venta.total ?? 0)
    mapa[dia][hora].total += total
    mapa[dia][hora].cantidad += 1
  }

  ventas.forEach(procesar)
  ventasServicios.forEach(procesar)

  return dias.map((dia) => ({
    dia,
    horas: Object.values(mapa[dia]),
  }))
}

describe('calcularVentasPorHora', () => {
  it('retorna 24 horas aunque no haya ventas', () => {
    const resultado = calcularVentasPorHora([], [])
    expect(resultado).toHaveLength(24)
    for (let h = 0; h < 24; h++) {
      expect(resultado[h].hora).toBe(`${h.toString().padStart(2, '0')}:00`)
      expect(resultado[h].total).toBe(0)
      expect(resultado[h].cantidad).toBe(0)
    }
  })

  it('agrega ventas por hora correcta', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 2,
        createdAt: new Date('2026-11-10T09:30:00'),
        reconciliaciones: [{ monto: 1500, montoConvertido: 1500 }],
      },
      {
        ventaId: 'v2',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T09:45:00'),
        reconciliaciones: [{ monto: 800, montoConvertido: 800 }],
      },
      {
        ventaId: 'v3',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T14:00:00'),
        reconciliaciones: [{ monto: 2000, montoConvertido: 2000 }],
      },
    ]
    const resultado = calcularVentasPorHora(ventas, [])

    expect(resultado[9].hora).toBe('09:00')
    expect(resultado[9].total).toBe(2300)
    expect(resultado[9].cantidad).toBe(2)

    expect(resultado[14].hora).toBe('14:00')
    expect(resultado[14].total).toBe(2000)
    expect(resultado[14].cantidad).toBe(1)

    // Las demás horas deben estar en cero
    expect(resultado[0].total).toBe(0)
    expect(resultado[23].cantidad).toBe(0)
  })

  it('combina ventas y servicios en la misma hora', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T10:00:00'),
        reconciliaciones: [{ monto: 500, montoConvertido: 500 }],
      },
    ]
    const servicios: VentaServicioMock[] = [
      {
        ventaServicioId: 's1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T10:30:00'),
        reconciliaciones: [{ monto: 300, montoConvertido: 300 }],
      },
    ]
    const resultado = calcularVentasPorHora(ventas, servicios)

    expect(resultado[10].total).toBe(800)
    expect(resultado[10].cantidad).toBe(2)
  })

  it('usa total como fallback cuando reconciliaciones está vacío', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: 1200,
        cantidad: 1,
        createdAt: new Date('2026-11-10T08:00:00'),
        reconciliaciones: [],
      },
    ]
    const resultado = calcularVentasPorHora(ventas, [])

    expect(resultado[8].total).toBe(1200)
    expect(resultado[8].cantidad).toBe(1)
  })

  it('usa montoConvertido cuando está disponible', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T12:00:00'),
        reconciliaciones: [{ monto: 1000, montoConvertido: 1500 }],
      },
    ]
    const resultado = calcularVentasPorHora(ventas, [])

    expect(resultado[12].total).toBe(1500)
  })

  it('maneja ventas a medianoche (hora 0)', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T00:15:00'),
        reconciliaciones: [{ monto: 200, montoConvertido: 200 }],
      },
    ]
    const resultado = calcularVentasPorHora(ventas, [])

    expect(resultado[0].hora).toBe('00:00')
    expect(resultado[0].total).toBe(200)
    expect(resultado[0].cantidad).toBe(1)
  })
})

describe('calcularVentasPorDiaYHora', () => {
  it('retorna 7 días con 24 horas cada uno aunque no haya ventas', () => {
    const resultado = calcularVentasPorDiaYHora([], [])
    expect(resultado).toHaveLength(7)
    for (const diaRow of resultado) {
      expect(diaRow.horas).toHaveLength(24)
      for (const h of diaRow.horas) {
        expect(h.total).toBe(0)
        expect(h.cantidad).toBe(0)
      }
    }
  })

  it('agrega ventas al día y hora correctos', () => {
    // 2026-11-10 is a Tuesday (Martes)
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T09:00:00'),
        reconciliaciones: [{ monto: 1000, montoConvertido: 1000 }],
      },
    ]
    const resultado = calcularVentasPorDiaYHora(ventas, [])

    const martes = resultado.find((d) => d.dia === 'Martes')!
    expect(martes).toBeDefined()
    expect(martes.horas[9].total).toBe(1000)
    expect(martes.horas[9].cantidad).toBe(1)

    // Otros días deben estar en cero
    const lunes = resultado.find((d) => d.dia === 'Lunes')!
    expect(lunes.horas[9].total).toBe(0)
  })

  it('combina ventas de diferentes días', () => {
    // 2026-11-09 is Monday, 2026-11-10 is Tuesday
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-09T10:00:00'),
        reconciliaciones: [{ monto: 500, montoConvertido: 500 }],
      },
      {
        ventaId: 'v2',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T10:00:00'),
        reconciliaciones: [{ monto: 700, montoConvertido: 700 }],
      },
    ]
    const resultado = calcularVentasPorDiaYHora(ventas, [])

    const lunes = resultado.find((d) => d.dia === 'Lunes')!
    expect(lunes.horas[10].total).toBe(500)

    const martes = resultado.find((d) => d.dia === 'Martes')!
    expect(martes.horas[10].total).toBe(700)
  })

  it('combina ventas y servicios en el mismo día y hora', () => {
    const ventas: VentaMock[] = [
      {
        ventaId: 'v1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T14:00:00'),
        reconciliaciones: [{ monto: 600, montoConvertido: 600 }],
      },
    ]
    const servicios: VentaServicioMock[] = [
      {
        ventaServicioId: 's1',
        total: null,
        cantidad: 1,
        createdAt: new Date('2026-11-10T14:30:00'),
        reconciliaciones: [{ monto: 400, montoConvertido: 400 }],
      },
    ]
    const resultado = calcularVentasPorDiaYHora(ventas, servicios)

    const martes = resultado.find((d) => d.dia === 'Martes')!
    expect(martes.horas[14].total).toBe(1000)
    expect(martes.horas[14].cantidad).toBe(2)
  })

  it('los días están ordenados de Domingo a Sábado', () => {
    const resultado = calcularVentasPorDiaYHora([], [])
    const dias = resultado.map((d) => d.dia)
    expect(dias).toEqual(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'])
  })
})
