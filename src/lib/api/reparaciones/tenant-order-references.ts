import type { PrismaClient } from '@/generated/prisma'

type ReferencePrisma = Pick<PrismaClient, 'cliente' | 'equipoReparacion' | 'empleado'>

type MissingReference = {
  ok: false
  message: string
}

type ValidatedReferences = {
  ok: true
  cliente: { clienteId: string; nombre: string }
  equipoTipo: { id: string; nombre: string }
  tecnicoId: string | null
}

/**
 * @description Verifica que todas las referencias de una orden pertenezcan al tenant indicado.
 * @param {ReferencePrisma} prisma - Delegados de Prisma usados para validar las referencias.
 * @param {object} input - Identificadores de cliente, equipos y técnico de la orden.
 * @returns {Promise<ValidatedReferences | MissingReference>} Referencias válidas o la entidad faltante.
 */
export async function validateTenantOrderReferences(
  prisma: ReferencePrisma,
  input: {
    tenantId: string
    clienteId: string
    equipoTipoIds: readonly unknown[]
    tecnicoId: unknown
  },
): Promise<ValidatedReferences | MissingReference> {
  const equipoTipoIds = input.equipoTipoIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  if (equipoTipoIds.length !== input.equipoTipoIds.length || equipoTipoIds.length === 0) {
    return { ok: false, message: 'Tipo de equipo no encontrado' }
  }

  const distinctEquipoTipoIds = [...new Set(equipoTipoIds)]
  const hasTecnicoId = input.tecnicoId !== undefined && input.tecnicoId !== null && input.tecnicoId !== ''
  if (hasTecnicoId && typeof input.tecnicoId !== 'string') {
    return { ok: false, message: 'Técnico no encontrado' }
  }

  const [cliente, equiposTipo, tecnico] = await Promise.all([
    prisma.cliente.findFirst({
      where: { clienteId: input.clienteId, tenantId: input.tenantId },
      select: { clienteId: true, nombre: true },
    }),
    prisma.equipoReparacion.findMany({
      where: { id: { in: distinctEquipoTipoIds }, tenantId: input.tenantId },
      select: { id: true, nombre: true },
    }),
    hasTecnicoId
      ? prisma.empleado.findFirst({
          where: { empleadoId: input.tecnicoId as string, tenantId: input.tenantId },
          select: { empleadoId: true },
        })
      : Promise.resolve(null),
  ])

  if (!cliente) return { ok: false, message: 'Cliente no encontrado' }
  if (equiposTipo.length !== distinctEquipoTipoIds.length) {
    return { ok: false, message: 'Tipo de equipo no encontrado' }
  }
  if (hasTecnicoId && !tecnico) return { ok: false, message: 'Técnico no encontrado' }

  const equipoTipo = equiposTipo.find((equipo) => equipo.id === equipoTipoIds[0])
  if (!equipoTipo) return { ok: false, message: 'Tipo de equipo no encontrado' }

  return {
    ok: true,
    cliente,
    equipoTipo,
    tecnicoId: tecnico?.empleadoId ?? null,
  }
}
