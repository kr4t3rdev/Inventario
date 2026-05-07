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

export function generarPrefijo(tipo: string): string {
  if (tipo in PREFIJOS_BASE) {
    return PREFIJOS_BASE[tipo]
  }
  return tipo
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
}

export async function generarProximoConsecutivo(tipo: string): Promise<number> {
  const ultimoContrato = await prisma.contrato.findFirst({
    where: { tipo },
    orderBy: { numeroConsecutivo: 'desc' },
    select: { numeroConsecutivo: true },
  })
  return (ultimoContrato?.numeroConsecutivo || 0) + 1
}

export function formatearNumeroContrato(tipo: string, consecutivo: number): string {
  const prefijo = generarPrefijo(tipo)
  const numeroFormateado = String(consecutivo).padStart(4, '0')
  return `${prefijo}-${numeroFormateado}`
}

export function validarFormatoNumeroContrato(numeroContrato: string): boolean {
  const regex = /^(CV|SER|SUM)-\d{4}$/
  return regex.test(numeroContrato)
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
