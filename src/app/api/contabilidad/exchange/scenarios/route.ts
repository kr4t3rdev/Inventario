import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verify_token } from '@/lib/auth-utils'
import { AuditLogService } from '@/lib/services/audit-log-service'

/**
 * @description GET endpoint para listar todos los escenarios guardados
 * @returns Lista de escenarios con información básica
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verify_token(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener parámetros de consulta
    const searchParams = request.nextUrl.searchParams
    const usuario_id = searchParams.get('usuario_id')
    const es_favorito = searchParams.get('es_favorito')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Construir filtros
    const where: any = {}
    
    if (usuario_id) {
      where.creadoPor = usuario_id
    }
    
    if (es_favorito === 'true') {
      where.esFavorito = true
    }

    // Obtener escenarios
    const escenarios = await prisma.scenarioSimulation.findMany({
      where,
      orderBy: [
        { esFavorito: 'desc' },
        { fechaCreacion: 'desc' }
      ],
      take: limit,
      skip: offset,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        tasasSimuladas: true,
        fechaProyeccion: true,
        esFavorito: true,
        etiquetas: true,
        creadoPor: true,
        fechaCreacion: true,
        ultimaModificacion: true
      }
    })

    // Parsear JSON fields
    const escenarios_parseados = escenarios.map((escenario: { id: string; nombre: string; descripcion: string | null; tasasSimuladas: string; fechaProyeccion: Date; esFavorito: boolean; etiquetas: string | null; creadoPor: string; fechaCreacion: Date; ultimaModificacion: Date }) => ({
      ...escenario,
      tasasSimuladas: JSON.parse(escenario.tasasSimuladas),
      etiquetas: escenario.etiquetas ? JSON.parse(escenario.etiquetas) : []
    }))

    // Contar total
    const total = await prisma.scenarioSimulation.count({ where })

    return NextResponse.json({
      escenarios: escenarios_parseados,
      total,
      limit,
      offset
    })

  } catch (error) {
    console.error('Error al obtener escenarios:', error)
    return NextResponse.json(
      { error: 'Error al obtener escenarios' },
      { status: 500 }
    )
  }
}

/**
 * @description POST endpoint para guardar un nuevo escenario
 * @param request - Datos del escenario a guardar
 * @returns Escenario guardado con ID
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verify_token(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener datos del body
    const body = await request.json()
    const {
      nombre,
      descripcion,
      tasas_simuladas,
      fecha_proyeccion,
      resultados,
      alertas,
      etiquetas,
      es_favorito
    } = body

    // Validar campos requeridos
    if (!nombre || !tasas_simuladas || !fecha_proyeccion || !resultados) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre, tasas_simuladas, fecha_proyeccion, resultados' },
        { status: 400 }
      )
    }

    // Validar que tasas_simuladas sea un objeto válido
    if (typeof tasas_simuladas !== 'object' || Array.isArray(tasas_simuladas)) {
      return NextResponse.json(
        { error: 'tasas_simuladas debe ser un objeto con formato { "USD": 22.5, "EUR": 24.8 }' },
        { status: 400 }
      )
    }

    // Validar que todas las tasas sean números positivos
    for (const [moneda, tasa] of Object.entries(tasas_simuladas)) {
      if (typeof tasa !== 'number' || tasa <= 0) {
        return NextResponse.json(
          { error: `La tasa para ${moneda} debe ser un número positivo` },
          { status: 400 }
        )
      }
    }

    // Crear escenario
    const escenario = await prisma.scenarioSimulation.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        tasasSimuladas: JSON.stringify(tasas_simuladas),
        fechaProyeccion: new Date(fecha_proyeccion),
        resultados: JSON.stringify(resultados),
        alertas: alertas ? JSON.stringify(alertas) : null,
        etiquetas: etiquetas ? JSON.stringify(etiquetas) : null,
        esFavorito: es_favorito || false,
        creadoPor: decoded.userId
      }
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'ESCENARIO_EXCHANGE',
      entidadId: escenario.id,
      usuarioId: decoded.userId,
      detalles: { nombre }
    })

    // Parsear JSON fields para respuesta
    const escenario_parseado = {
      ...escenario,
      tasasSimuladas: JSON.parse(escenario.tasasSimuladas),
      resultados: JSON.parse(escenario.resultados),
      alertas: escenario.alertas ? JSON.parse(escenario.alertas) : [],
      etiquetas: escenario.etiquetas ? JSON.parse(escenario.etiquetas) : []
    }

    return NextResponse.json(escenario_parseado, { status: 201 })

  } catch (error) {
    console.error('Error al guardar escenario:', error)
    return NextResponse.json(
      { error: 'Error al guardar escenario' },
      { status: 500 }
    )
  }
}
