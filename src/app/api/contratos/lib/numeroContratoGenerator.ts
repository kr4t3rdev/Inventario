import { prisma } from '@/lib/prisma'
import { TipoContrato } from '@/generated/prisma'

/**
 * @description Obtiene el próximo número consecutivo para un tipo de contrato
 * @param tipo Tipo de contrato (COMPRA_VENTA | SERVICIO | SUMINISTROS)
 * @returns Número consecutivo siguiente (1, 2, 3, etc)
 * @example
 * const siguiente = await generarProximoConsecutivo('COMPRA_VENTA');
 * // Returns: 5 (si hay 4 contratos COMPRA_VENTA)
 */
export async function generarProximoConsecutivo(
  tipo: TipoContrato
): Promise<number> {
  const ultimoContrato = await prisma.contrato.findFirst({
    where: { tipo },
    orderBy: { numeroConsecutivo: 'desc' },
    select: { numeroConsecutivo: true },
  })

  return (ultimoContrato?.numeroConsecutivo || 0) + 1
}

/**
 * @description Prefijos de números de contrato por tipo
 * @internal
 */
const PREFIJOS_TIPO: Record<TipoContrato, string> = {
  COMPRA_VENTA: 'CV',
  SERVICIO: 'SER',
  SUMINISTROS: 'SUM',
}

/**
 * @description Formatea un número de contrato con su tipo y consecutivo
 * @param tipo Tipo de contrato
 * @param consecutivo Número consecutivo
 * @returns String formateado (ej: "CV-0001", "SER-0042", "SUM-0157")
 * @example
 * const numero = formatearNumeroContrato('COMPRA_VENTA', 1);
 * // Returns: "CV-0001"
 *
 * const numero = formatearNumeroContrato('SERVICIO', 42);
 * // Returns: "SER-0042"
 */
export function formatearNumeroContrato(
  tipo: TipoContrato,
  consecutivo: number
): string {
  const prefijo = PREFIJOS_TIPO[tipo]
  if (!prefijo) {
    throw new Error(`Tipo de contrato inválido: ${tipo}`)
  }

  const numeroFormateado = String(consecutivo).padStart(4, '0')
  return `${prefijo}-${numeroFormateado}`
}

/**
 * @description Valida que un número de contrato tenga el formato correcto
 * @param numeroContrato Número a validar (ej: "CV-0001")
 * @returns true si es válido, false en caso contrario
 * @example
 * validarFormatoNumeroContrato("CV-0001") // true
 * validarFormatoNumeroContrato("XX-0001") // false
 */
export function validarFormatoNumeroContrato(numeroContrato: string): boolean {
  const regex = /^(CV|SER|SUM)-\d{4}$/
  return regex.test(numeroContrato)
}

/**
 * @description Extrae el tipo de contrato desde el número
 * @param numeroContrato Número de contrato (ej: "CV-0001")
 * @returns Tipo de contrato o null si no coincide
 * @example
 * extraerTipoDelNumero("CV-0001") // "COMPRA_VENTA"
 * extraerTipoDelNumero("SER-0042") // "SERVICIO"
 */
export function extraerTipoDelNumero(numeroContrato: string): TipoContrato | null {
  const prefijo = numeroContrato.split('-')[0]
  const mapeo: Record<string, TipoContrato> = {
    CV: 'COMPRA_VENTA',
    SER: 'SERVICIO',
    SUM: 'SUMINISTROS',
  }
  return mapeo[prefijo] || null
}
