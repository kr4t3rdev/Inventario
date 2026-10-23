import { prisma } from '@/lib/prisma'

const BUILT_IN_CONTRACT_TYPES = new Set([
  'COMPRA_VENTA',
  'SERVICIO',
  'PROVEEDOR',
  'ARRENDAMIENTO',
  'OTRO',
])

/**
 * @description Verifica si el tipo es integrado o pertenece al tenant y puede asignarse.
 * @param {string} tipo - Tipo de contrato recibido para asignación.
 * @param {string} tenantId - Tenant autenticado, resuelto en el servidor.
 * @param {string | undefined} tipoActual - Tipo persistido para preservar una asignación archivada.
 * @returns {Promise<boolean>} true cuando la asignación está autorizada.
 */
export async function isAssignableContratoTipo(
  tipo: string,
  tenantId: string,
  tipoActual?: string,
): Promise<boolean> {
  if (BUILT_IN_CONTRACT_TYPES.has(tipo)) return true

  const activeType = await prisma.tipoContratoCustom.findFirst({
    where: { tipoCustomId: tipo, tenantId, activo: true },
    select: { tipoCustomId: true },
  })
  if (activeType) return true

  if (tipo !== tipoActual) return false

  const archivedType = await prisma.tipoContratoCustom.findFirst({
    where: { tipoCustomId: tipo, tenantId, activo: false },
    select: { tipoCustomId: true },
  })
  return Boolean(archivedType)
}
