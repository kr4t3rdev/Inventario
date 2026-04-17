import { prisma } from '@/lib/prisma'

// Prefijos fijos para los tipos base del sistema
const PREFIJOS_BASE: Record<string, string> = {
  COMPRA_VENTA: 'CV',
  SERVICIO: 'SER',
  SUMINISTROS: 'SUM',
}

/**
 * @description Genera el prefijo para un tipo de contrato.
 * Para tipos base usa el prefijo fijo; para tipos custom usa las primeras 3 letras en mayúsculas.
 */
export function generarPrefijo(tipo: string): string {
  if (PREFIJOS_BASE[tipo]) return PREFIJOS_BASE[tipo]
  // Tipos custom: primeras 3 letras sin espacios, en mayúsculas
  return tipo.replace(/\s+/g, '').substring(0, 3).toUpperCase()
}

/**
 * @description Obtiene el próximo número consecutivo para un tipo de contrato
 */
export async function generarProximoConsecutivo(tipo: string): Promise<number> {
  const ultimoContrato = await prisma.contrato.findFirst({
    where: { tipo },
    orderBy: { numeroConsecutivo: 'desc' },
    select: { numeroConsecutivo: true },
  })

  return (ultimoContrato?.numeroConsecutivo || 0) + 1
}

/**
 * @description Formatea un número de contrato con su tipo y consecutivo
 * @example formatearNumeroContrato('COMPRA_VENTA', 1) // "CV-0001"
 * @example formatearNumeroContrato('Mantenimiento', 1) // "MAN-0001"
 */
export function formatearNumeroContrato(tipo: string, consecutivo: number): string {
  const prefijo = generarPrefijo(tipo)
  const numeroFormateado = String(consecutivo).padStart(4, '0')
  return `${prefijo}-${numeroFormateado}`
}

/**
 * @description Valida que un número de contrato tenga el formato correcto
 */
export function validarFormatoNumeroContrato(numeroContrato: string): boolean {
  const regex = /^[A-Z]{2,4}-\d{4}$/
  return regex.test(numeroContrato)
}

/**
 * @description Extrae el tipo base de contrato desde el número (solo tipos base)
 */
export function extraerTipoDelNumero(numeroContrato: string): string | null {
  const prefijo = numeroContrato.split('-')[0]
  const mapeo: Record<string, string> = {
    CV: 'COMPRA_VENTA',
    SER: 'SERVICIO',
    SUM: 'SUMINISTROS',
  }
  return mapeo[prefijo] || null
}
