import type { AdminFinance } from '@/features/admin'

/**
 * @description Obtiene el resumen financiero global desde el contrato REST.
 * @returns {Promise<AdminFinance>} Datos financieros normalizados para el panel.
 */
export async function fetchAdminFinance(): Promise<AdminFinance> {
  const response = await fetch('/api/admin/finance', { method: 'GET', cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Finance API request failed (${response.status} ${response.statusText})`)
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new Error('Invalid finance response JSON')
  }

  if (!isAdminFinance(payload)) {
    throw new Error('Invalid finance payload')
  }

  return payload
}

function isAdminFinance(value: unknown): value is AdminFinance {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNumber(value.tenantCount) &&
    isFinanceSection(value.revenue, [
      'totalVentas',
      'totalVentasMonto',
      'totalVentasServicios',
      'totalServiciosMonto',
      'totalIngresos',
    ]) &&
    isFinanceSection(value.gastos, ['totalGastos', 'totalMonto']) &&
    isFinanceSection(value.cuentasPorCobrar, ['total', 'saldoPendiente']) &&
    isFinanceSection(value.cuentasPorPagar, ['total', 'saldoPendiente'])
  )
}

function isFinanceSection(value: unknown, keys: string[]): value is Record<string, number> {
  if (!isRecord(value)) {
    return false
  }

  return keys.every((key) => isNumber(value[key]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
