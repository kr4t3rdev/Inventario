import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'
import { AuditLogService } from '@/lib/services/audit-log-service'

/**
 * @description GET endpoint para obtener un escenario específico
 * @param request - Request con ID del escenario
 * @param params - Parámetros de ruta con ID
 * @returns Escenario completo con todos los detalles
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verify_token(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Obtener escenario
    const escenario = await prisma.scenarioSimulation.findUnique({
      where: { id }
    })

    if (!escenario) {
      return NextResponse.json(
        { error: 'Escenario no encontrado' },
        { status: 404 }
      )
    }

    // Parsear JSON fields
    const escenario_parseado = {
      ...escenario,
      tasasSimuladas: JSON.parse(escenario.tasasSimuladas),
      resultados: JSON.parse(escenario.resultados),
      alertas: escenario.alertas ? JSON.parse(escenario.alertas) : [],
      etiquetas: escenario.etiquetas ? JSON.parse(escenario.etiquetas) : []
    }

    return NextResponse.json(escenario_parseado)

  } catch (error) {
    console.error('Error al obtener escenario:', error)
    return NextResponse.json(
      { error: 'Error al obtener escenario' },
      { status: 500 }
    )
  }
}

/**
 * @description PATCH endpoint para actualizar un escenario
 * @param request - Request con datos a actualizar
 * @param params - Parámetros de ruta con ID
 * @returns Escenario actualizado
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verify_token(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Verificar que el escenario existe
    const escenario_existente = await prisma.scenarioSimulation.findUnique({
      where: { id }
    })

    if (!escenario_existente) {
      return NextResponse.json(
        { error: 'Escenario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el usuario es el creador
    if (escenario_existente.creadoPor !== decoded.userId) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar este escenario' },
        { status: 403 }
      )
    }

    // Construir datos de actualización
    const datos_actualizacion: any = {}

    if (body.nombre !== undefined) {
      datos_actualizacion.nombre = body.nombre
    }

    if (body.descripcion !== undefined) {
      datos_actualizacion.descripcion = body.descripcion
    }

    if (body.tasas_simuladas !== undefined) {
      // Validar formato
      if (typeof body.tasas_simuladas !== 'object' || Array.isArray(body.tasas_simuladas)) {
        return NextResponse.json(
          { error: 'tasas_simuladas debe ser un objeto' },
          { status: 400 }
        )
      }
      datos_actualizacion.tasasSimuladas = JSON.stringify(body.tasas_simuladas)
    }

    if (body.fecha_proyeccion !== undefined) {
      datos_actualizacion.fechaProyeccion = new Date(body.fecha_proyeccion)
    }

    if (body.resultados !== undefined) {
      datos_actualizacion.resultados = JSON.stringify(body.resultados)
    }

    if (body.alertas !== undefined) {
      datos_actualizacion.alertas = body.alertas ? JSON.stringify(body.alertas) : null
    }

    if (body.etiquetas !== undefined) {
      datos_actualizacion.etiquetas = body.etiquetas ? JSON.stringify(body.etiquetas) : null
    }

    if (body.es_favorito !== undefined) {
      datos_actualizacion.esFavorito = body.es_favorito
    }

    // Actualizar escenario
    const escenario_actualizado = await prisma.scenarioSimulation.update({
      where: { id },
      data: datos_actualizacion
    })

    // Parsear JSON fields
    const escenario_parseado = {
      ...escenario_actualizado,
      tasasSimuladas: JSON.parse(escenario_actualizado.tasasSimuladas),
      resultados: JSON.parse(escenario_actualizado.resultados),
      alertas: escenario_actualizado.alertas ? JSON.parse(escenario_actualizado.alertas) : [],
      etiquetas: escenario_actualizado.etiquetas ? JSON.parse(escenario_actualizado.etiquetas) : []
    }

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'ESCENARIO_EXCHANGE',
      entidadId: id,
      usuarioId: decoded.userId,
      detalles: { nombre: escenario_actualizado.nombre }
    })

    return NextResponse.json(escenario_parseado)

  } catch (error) {
    console.error('Error al actualizar escenario:', error)
    return NextResponse.json(
      { error: 'Error al actualizar escenario' },
      { status: 500 }
    )
  }
}

/**
 * @description DELETE endpoint para eliminar un escenario
 * @param request - Request con ID del escenario
 * @param params - Parámetros de ruta con ID
 * @returns Confirmación de eliminación
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verify_token(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verificar que el escenario existe
    const escenario_existente = await prisma.scenarioSimulation.findUnique({
      where: { id }
    })

    if (!escenario_existente) {
      return NextResponse.json(
        { error: 'Escenario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el usuario es el creador
    if (escenario_existente.creadoPor !== decoded.userId) {
      return NextResponse.json(
        { error: 'No tiene permisos para eliminar este escenario' },
        { status: 403 }
      )
    }

    // Eliminar escenario
    await prisma.scenarioSimulation.delete({
      where: { id }
    })

    await AuditLogService.log({
      accion: 'DELETE',
      entidad: 'ESCENARIO_EXCHANGE',
      entidadId: id,
      usuarioId: decoded.userId,
      detalles: { nombre: escenario_existente.nombre }
    })

    return NextResponse.json({
      mensaje: 'Escenario eliminado exitosamente',
      id
    })

  } catch (error) {
    console.error('Error al eliminar escenario:', error)
    return NextResponse.json(
      { error: 'Error al eliminar escenario' },
      { status: 500 }
    )
  }
}
