'use server'

import { getRF as fetchRF } from '@/lib/api/reportes-financieros'
import type { ReporteFinanciero } from '@/lib/api/reportes-financieros'
import { handleServerActionError } from './_helpers/error-handler'

/**
 * @description Server Action que genera el reporte financiero del período.
 * Cachea con tag 'ReportesFinancieros' para revalidación automática.
 * @param periodo - Período en formato "YYYY-MM" (default: mes actual)
 * @param tipo - Tipo de reporte (default: "mensual")
 * @returns Reporte financiero con ingresos, gastos, utilidad y margen
 */
export async function getRF(
  periodo?: string,
  tipo?: string
): Promise<ReporteFinanciero> {
  try {
    return await fetchRF(periodo, tipo)
  } catch (error) {
    handleServerActionError(error, 'getRF')
  }
}
