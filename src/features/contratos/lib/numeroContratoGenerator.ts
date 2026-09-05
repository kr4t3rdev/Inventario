import { prisma } from '@/lib/prisma'

const PREFIJOS_BASE: Record<string, string> = {
  COMPRA_VENTA: 'CV',
  SERVICIO: 'SER',
  SUMINISTROS: 'SUM',
}

function assertTipoContratoValido(tipo: string): asserts tipo is keyof typeof PREFIJOS_BASE {
  if (!(tipo in PREFIJOS_BASE)) {
    throw new Error('Tipo de contrato inválido')
  }
}

/**
 * @description Deriva el prefijo de 3 letras para un tipo de contrato custom.
 * @param {string} tipo - Nombre del tipo custom.
 * @returns {string} Prefijo determinista en mayúsculas o CUS como fallback.
 */
export function derivarPrefijoCustom(tipo: string): string {
  const normalizado = tipo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
  return normalizado.length === 3 ? normalizado : 'CUS'
}

export function generarPrefijo(tipo: string): string {
  if (tipo in PREFIJOS_BASE) {
    return PREFIJOS_BASE[tipo]
  }
  return derivarPrefijoCustom(tipo)
}

/**
 * @description Calcula el próximo consecutivo de contrato scoped por tenant y tipo.
 * Con reintento ante colisión P2002 (máx. 3 intentos) para creaciones concurrentes.
 * @param {string} tenantId - Tenant propietario de la numeración.
 * @param {string} tipo - Tipo de contrato.
 * @returns {Promise<number>} Próximo número consecutivo para ese tenant y tipo.
 */
export async function generarProximoConsecutivo(tenantId: string, tipo: string): Promise<number> {
  const ultimoContrato = await prisma.contrato.findFirst({
    where: { tenantId, tipo },
    orderBy: { numeroConsecutivo: 'desc' },
    select: { numeroConsecutivo: true },
  })
  return (ultimoContrato?.numeroConsecutivo || 0) + 1
}

/**
 * @description Crea el contrato con numeración por tenant y reintento ante P2002.
 * @param {object} input - Datos para prisma.contrato.create (debe incluir tenantId y tipo).
 * @returns {Promise<object>} Contrato creado.
 */
export async function crearContratoConConsecutivo<T>(input: {
  tenantId: string
  tipo: string
  buildData: (numeroConsecutivo: number, numeroContrato: string) => T
  create: (data: T) => Promise<any>
}): Promise<any> {
  let ultimoError: unknown = null
  for (let intento = 0; intento < 3; intento++) {
    const consecutivo = await generarProximoConsecutivo(input.tenantId, input.tipo)
    const numeroContrato = formatearNumeroContrato(input.tipo, consecutivo)
    try {
      return await input.create(input.buildData(consecutivo, numeroContrato))
    } catch (error: any) {
      if (error?.code === 'P2002') {
        ultimoError = error
        continue
      }
      throw error
    }
  }
  throw ultimoError
}

export function formatearNumeroContrato(tipo: string, consecutivo: number): string {
  const prefijo = generarPrefijo(tipo)
  const numeroFormateado = String(consecutivo).padStart(4, '0')
  return `${prefijo}-${numeroFormateado}`
}

export function validarFormatoNumeroContrato(numeroContrato: string): boolean {
  const partes = numeroContrato.split('-')
  if (partes.length !== 2) return false
  const [prefijo, numero] = partes
  if (!/^\d{4}$/.test(numero)) return false
  if (['CV', 'SER', 'SUM'].includes(prefijo)) return true
  return /^[A-Z0-9]{3}$/.test(prefijo)
}

export function extraerTipoDelNumero(numeroContrato: string): string | null {
  const prefijo = numeroContrato.split('-')[0]
  const mapeo: Record<string, string> = {
    CV: 'COMPRA_VENTA',
    SER: 'SERVICIO',
    SUM: 'SUMINISTROS',
  }
  return mapeo[prefijo] || null
}

export { assertTipoContratoValido }
