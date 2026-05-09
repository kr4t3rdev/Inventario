import prisma from '@/lib/prisma'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'

export interface ReporteFinanciero {
  periodo: string
  tipoReporte: string
  ingresosVentas: number
  cantidadVentas: number
  gastosCompras: number
  gastosSalarios: number
  gastosServicios: number
  gastosMermas: number
  totalIngresos: number
  totalGastos: number
  utilidadBruta: number
  utilidadNeta: number
  margenUtilidad: number
}

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthRange(periodo: string) {
  const [year, month] = periodo.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  return { startDate, endDate }
}

/**
 * @description Genera un reporte financiero para el período indicado.
 * Replica la lógica del handler existente usando Prisma directo.
 * @param periodo - Período en formato "YYYY-MM" (default: mes actual)
 * @param tipo - Tipo de reporte: "mensual" (default)
 * @returns Reporte financiero con ingresos, gastos, utilidad, etc.
 */
export async function getRF(
  periodo?: string,
  tipo: string = 'mensual'
): Promise<ReporteFinanciero> {
  await getAuthenticatedContext()

  const effectivePeriodo = periodo || getCurrentPeriod()
  const { startDate, endDate } = getMonthRange(effectivePeriodo)

  try {
    const [ventasData, comprasData, salariosData, serviciosData, mermasData] =
      await Promise.all([
        prisma.venta.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          select: {
            cantidad: true,
            producto: {
              select: { id: true, nombre: true, precioVenta: true, precioCosto: true },
            },
          },
        }),
        prisma.gastoCompra.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          select: { total: true },
        }),
        prisma.empleado.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          select: { empleadoId: true, nombre: true, apellido: true, salarioBases: true },
        }),
        prisma.gastosDE.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          select: { monto: true },
        }),
        prisma.merma.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          select: { cantidad: true, costoTotal: true },
        }),
      ])

    const ingresosVentas = ventasData.reduce(
      (acc: number, v: any) => acc + (v?.producto?.precioVenta ?? 0) * v.cantidad,
      0
    )
    const gastosCompras = comprasData.reduce((acc: number, c: { total: number }) => acc + c.total, 0)
    const gastosSalarios = salariosData.reduce(
      (acc: number, e: { salarioBases: number }) => acc + e.salarioBases,
      0
    )
    const gastosServicios = serviciosData.reduce(
      (acc: number, s: { monto: number }) => acc + s.monto,
      0
    )
    const gastosMermas = mermasData.reduce(
      (acc: number, m: { costoTotal: number | null; cantidad: number }) =>
        acc + (m.costoTotal ?? 0) * m.cantidad,
      0
    )

    const totalIngresos = ingresosVentas
    const totalGastos = gastosCompras + gastosSalarios + gastosServicios + gastosMermas
    const utilidadBruta = ingresosVentas - gastosCompras
    const utilidadNeta = totalIngresos - totalGastos
    const margenUtilidad = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0

    return {
      periodo: effectivePeriodo,
      tipoReporte: tipo,
      ingresosVentas,
      cantidadVentas: ventasData.length,
      gastosCompras,
      gastosSalarios,
      gastosServicios,
      gastosMermas,
      totalIngresos,
      totalGastos,
      utilidadBruta,
      utilidadNeta,
      margenUtilidad,
    }
  } catch (error) {
    throw new ServerActionError(
      'getRF',
      'GET',
      500,
      error instanceof Error ? error.message : 'Error al generar reporte financiero',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * @description Crea/genera un reporte financiero para el período indicado.
 * @param periodo - Período en formato "YYYY-MM"
 * @param tipo - Tipo de reporte (ej: "mensual")
 * @returns Reporte financiero
 */
export async function createRF(
  periodo: string,
  tipo: string = 'mensual'
): Promise<ReporteFinanciero> {
  return getRF(periodo, tipo)
}
