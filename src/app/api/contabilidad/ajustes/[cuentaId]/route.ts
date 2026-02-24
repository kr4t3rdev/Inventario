import { NextRequest, NextResponse } from 'next/server'
import { verify_token } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema para validar parámetros de consulta
const querySchema = z.object({
  page: z.string().nullable().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().nullable().optional().transform(val => val ? parseInt(val) : 50),
  fechaInicio: z.string().nullable().optional(),
  fechaFin: z.string().nullable().optional(),
  tipo: z.enum(['ingreso', 'egreso']).nullable().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cuentaId: string }> }
) {
  try {
    const { cuentaId } = await params
    const user = await verify_token(request)

    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(request.url)

    const queryParams = querySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      fechaInicio: searchParams.get('fechaInicio'),
      fechaFin: searchParams.get('fechaFin'),
      tipo: searchParams.get('tipo')
    })

    // Verificar que la cuenta bancaria existe (solo si no es 'all')
    let cuentaBancaria = null
    if (cuentaId !== 'all') {
      cuentaBancaria = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId }
      })

      if (!cuentaBancaria) {
        return NextResponse.json(
          { error: 'Cuenta bancaria no encontrada', code: 'CUENTA_NO_ENCONTRADA' },
          { status: 404 }
        )
      }
    }

    // Construir filtros para la consulta
    const whereClause: any = {}
    
    // Si cuentaId es 'all', no filtrar por cuenta específica
    if (cuentaId !== 'all') {
      whereClause.cuentaId = cuentaId
    }

    if (queryParams.tipo) {
      whereClause.tipo = queryParams.tipo
    }

    if (queryParams.fechaInicio || queryParams.fechaFin) {
      whereClause.createdAt = {}

      if (queryParams.fechaInicio) {
        whereClause.createdAt.gte = new Date(queryParams.fechaInicio)
      }

      if (queryParams.fechaFin) {
        const fechaFin = new Date(queryParams.fechaFin)
        fechaFin.setHours(23, 59, 59, 999) // Incluir todo el día
        whereClause.createdAt.lte = fechaFin
      }
    }

    // Calcular offset para paginación
    const offset = (queryParams.page - 1) * queryParams.limit

    // Obtener ajustes con paginación
    const [ajustes, totalCount] = await Promise.all([
      prisma.ajusteBancario.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: queryParams.limit,
        include: {
          cuentaBancaria: {
            select: {
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          }
        }
      }),
      prisma.ajusteBancario.count({
        where: whereClause
      })
    ])

    // Obtener información del usuario que realizó cada ajuste
    const ajustesConUsuario = await Promise.all(
      ajustes.map(async (ajuste: any) => {
        // En un sistema real, aquí buscarías la información del usuario
        // Por ahora, solo incluimos el ID
        return {
          ...ajuste,
          realizadoPorInfo: {
            userId: ajuste.realizadoPor,
            // Aquí podrías agregar más información del usuario si tienes un modelo User
          }
        }
      })
    )

    // Calcular estadísticas del período
    const estadisticas = await prisma.ajusteBancario.aggregate({
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        _all: true
      }
    })

    const estadisticasPorTipo = await prisma.ajusteBancario.groupBy({
      by: ['tipo'],
      where: whereClause,
      _sum: {
        monto: true,
        montoConvertido: true
      },
      _count: {
        _all: true
      }
    })

    // Calcular totales por tipo
    const totales = {
      ingresos: 0,
      egresos: 0,
      neto: 0
    }

    estadisticasPorTipo.forEach((stat: any) => {
      const monto = Number(stat._sum.montoConvertido || stat._sum.monto || 0)
      if (stat.tipo === 'ingreso') {
        totales.ingresos += monto
      } else {
        totales.egresos += monto
      }
    })

    totales.neto = totales.ingresos - totales.egresos

    const totalPages = Math.ceil(totalCount / queryParams.limit)

    return NextResponse.json({
      success: true,
      data: {
        ajustes: ajustesConUsuario,
        cuentaBancaria: cuentaId === 'all' ? null : cuentaBancaria ? {
          cuentaId: cuentaBancaria.cuentaId,
          nombreBanco: cuentaBancaria.nombreBanco,
          numeroCuenta: cuentaBancaria.numeroCuenta,
          saldoActual: Number(cuentaBancaria.saldo),
          moneda: cuentaBancaria.moneda
        } : null,
        pagination: {
          currentPage: queryParams.page,
          totalPages,
          totalCount,
          limit: queryParams.limit,
          hasNextPage: queryParams.page < totalPages,
          hasPrevPage: queryParams.page > 1
        },
        estadisticas: {
          totalAjustes: totalCount,
          totales,
          periodo: {
            fechaInicio: queryParams.fechaInicio,
            fechaFin: queryParams.fechaFin
          }
        }
      }
    })

  } catch (error) {
    console.error('Error al obtener historial de ajustes:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}